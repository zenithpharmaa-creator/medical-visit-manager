import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, syncActivationCodes, syncChanges, syncDevices, syncRecords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


const hashActivationValue = (value: string) => createHash("sha256").update(value).digest("hex");

const createActivationCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};

export async function issueRepresentativeActivationCode(input: {
  createdBy: number;
  representativeId: string;
  ttlMinutes?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const code = createActivationCode();
  const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 15) * 60_000);
  await db.insert(syncActivationCodes).values({
    codeHash: hashActivationValue(code),
    representativeId: input.representativeId,
    createdBy: input.createdBy,
    expiresAt,
  });

  return { code, representativeId: input.representativeId, expiresAt };
}

export async function redeemRepresentativeActivationCode(input: {
  code: string;
  deviceId: string;
  deviceLabel?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const codeHash = hashActivationValue(input.code.trim().toUpperCase());
  const now = new Date();
  const deviceToken = randomBytes(32).toString("hex");
  const tokenHash = hashActivationValue(deviceToken);

  return db.transaction(async (tx) => {
    const rows = await tx.select().from(syncActivationCodes).where(and(
      eq(syncActivationCodes.codeHash, codeHash),
      isNull(syncActivationCodes.usedAt),
      gt(syncActivationCodes.expiresAt, now),
    )).limit(1);
    const activation = rows[0];
    if (!activation) return null;

    await tx.update(syncActivationCodes).set({
      usedAt: now,
      usedDeviceId: input.deviceId,
    }).where(eq(syncActivationCodes.codeHash, codeHash));

    await tx.insert(syncDevices).values({
      deviceId: input.deviceId,
      userId: activation.createdBy,
      representativeId: activation.representativeId,
      tokenHash,
      deviceLabel: input.deviceLabel ?? null,
      lastSeenAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        userId: activation.createdBy,
        representativeId: activation.representativeId,
        tokenHash,
        deviceLabel: input.deviceLabel ?? null,
        revokedAt: null,
        lastSeenAt: now,
      },
    });

    return {
      deviceId: input.deviceId,
      representativeId: activation.representativeId,
      deviceToken,
    };
  });
}

export async function listRepresentativeDevices(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    deviceId: syncDevices.deviceId,
    representativeId: syncDevices.representativeId,
    deviceLabel: syncDevices.deviceLabel,
    lastSeenAt: syncDevices.lastSeenAt,
    lastSyncAt: syncDevices.lastSyncAt,
    revokedAt: syncDevices.revokedAt,
    createdAt: syncDevices.createdAt,
  }).from(syncDevices).where(eq(syncDevices.userId, userId));
}

export async function revokeRepresentativeDevice(userId: number, deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(syncDevices).set({ revokedAt: new Date() }).where(and(
    eq(syncDevices.userId, userId),
    eq(syncDevices.deviceId, deviceId),
  ));
}


type SyncChangeInput = {
  changeId: string;
  recordType: string;
  recordId: string;
  operation: "upsert" | "delete";
  baseVersion?: number;
  payload?: unknown;
  createdAt?: string;
};

export async function syncDeviceChanges(input: {
  deviceId: string;
  deviceToken: string;
  changes: SyncChangeInput[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const tokenHash = hashActivationValue(input.deviceToken);
  const deviceRows = await db.select().from(syncDevices).where(and(
    eq(syncDevices.deviceId, input.deviceId),
    eq(syncDevices.tokenHash, tokenHash),
    isNull(syncDevices.revokedAt),
  )).limit(1);
  const device = deviceRows[0];
  if (!device) return { authorized: false as const, accepted: [], conflicts: [], records: [] };

  const accepted: string[] = [];
  const conflicts: Array<{ changeId: string; recordType: string; recordId: string; serverRecord: typeof syncRecords.$inferSelect | null }> = [];
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const change of input.changes) {
      const currentRows = await tx.select().from(syncRecords).where(and(
        eq(syncRecords.recordType, change.recordType),
        eq(syncRecords.recordId, change.recordId),
      )).limit(1);
      const current = currentRows[0] ?? null;
      if (current && change.baseVersion !== undefined && change.baseVersion !== current.version) {
        conflicts.push({ changeId: change.changeId, recordType: change.recordType, recordId: change.recordId, serverRecord: current });
        continue;
      }

      const nextVersion = (current?.version ?? 0) + 1;
      const payload = change.operation === "delete" ? (current?.payload ?? "null") : JSON.stringify(change.payload ?? null);
      if (current) {
        await tx.update(syncRecords).set({
          payload,
          version: nextVersion,
          updatedBy: device.userId,
          updatedAt: now,
          deletedAt: change.operation === "delete" ? now : null,
        }).where(and(
          eq(syncRecords.recordType, change.recordType),
          eq(syncRecords.recordId, change.recordId),
        ));
      } else {
        await tx.insert(syncRecords).values({
          recordType: change.recordType,
          recordId: change.recordId,
          payload,
          version: nextVersion,
          updatedBy: device.userId,
          updatedAt: now,
          deletedAt: change.operation === "delete" ? now : null,
        });
      }

      await tx.insert(syncChanges).values({
        changeId: change.changeId,
        deviceId: input.deviceId,
        userId: device.userId,
        recordType: change.recordType,
        recordId: change.recordId,
        operation: change.operation,
        baseVersion: change.baseVersion ?? null,
        payload: change.operation === "delete" ? null : JSON.stringify(change.payload ?? null),
        createdAt: change.createdAt ? new Date(change.createdAt) : now,
      }).onDuplicateKeyUpdate({ set: { changeId: change.changeId } });
      accepted.push(change.changeId);
    }

    await tx.update(syncDevices).set({ lastSeenAt: now, lastSyncAt: now }).where(eq(syncDevices.deviceId, input.deviceId));
  });

  const records = await db.select().from(syncRecords).orderBy(desc(syncRecords.updatedAt));
  return { authorized: true as const, accepted, conflicts, records };
}
