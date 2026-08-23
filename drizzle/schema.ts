import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const syncDevices = mysqlTable("sync_devices", {
  deviceId: varchar("deviceId", { length: 128 }).primaryKey(),
  userId: int("userId").notNull(),
  representativeId: varchar("representativeId", { length: 128 }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  revokedAt: timestamp("revokedAt"),
  deviceLabel: varchar("deviceLabel", { length: 255 }),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("sync_devices_user_idx").on(table.userId),
  representativeIdx: index("sync_devices_representative_idx").on(table.representativeId),
}));

export const syncActivationCodes = mysqlTable("sync_activation_codes", {
  codeHash: varchar("codeHash", { length: 128 }).primaryKey(),
  representativeId: varchar("representativeId", { length: 128 }).notNull(),
  createdBy: int("createdBy").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  usedDeviceId: varchar("usedDeviceId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  representativeIdx: index("sync_activation_representative_idx").on(table.representativeId),
  expiryIdx: index("sync_activation_expiry_idx").on(table.expiresAt),
}));

export const syncRecords = mysqlTable("sync_records", {
  recordType: varchar("recordType", { length: 64 }).notNull(),
  recordId: varchar("recordId", { length: 191 }).notNull(),
  payload: text("payload").notNull(),
  version: int("version").default(1).notNull(),
  updatedBy: int("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
}, (table) => ({
  recordKeyUnique: uniqueIndex("sync_records_record_key_unique").on(table.recordType, table.recordId),
  typeVersionIdx: index("sync_records_type_version_idx").on(table.recordType, table.version),
}));

export const syncChanges = mysqlTable("sync_changes", {
  id: int("id").autoincrement().primaryKey(),
  changeId: varchar("changeId", { length: 128 }).notNull().unique(),
  deviceId: varchar("deviceId", { length: 128 }).notNull(),
  userId: int("userId").notNull(),
  recordType: varchar("recordType", { length: 64 }).notNull(),
  recordId: varchar("recordId", { length: 191 }).notNull(),
  operation: mysqlEnum("operation", ["upsert", "delete"]).notNull(),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  deviceIdx: index("sync_changes_device_idx").on(table.deviceId, table.id),
  recordIdx: index("sync_changes_record_idx").on(table.recordType, table.recordId, table.id),
}));

export type SyncDevice = typeof syncDevices.$inferSelect;
export type InsertSyncDevice = typeof syncDevices.$inferInsert;
export type SyncActivationCode = typeof syncActivationCodes.$inferSelect;
export type InsertSyncActivationCode = typeof syncActivationCodes.$inferInsert;
export type SyncRecord = typeof syncRecords.$inferSelect;
export type InsertSyncRecord = typeof syncRecords.$inferInsert;
export type SyncChange = typeof syncChanges.$inferSelect;
export type InsertSyncChange = typeof syncChanges.$inferInsert;
