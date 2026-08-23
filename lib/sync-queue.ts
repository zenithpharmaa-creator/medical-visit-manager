import type { AppData, SyncConflict, SyncQueueEntry, SyncRecordType } from "@/shared/visit-types";

type RemoteRecord = { recordType: SyncRecordType; recordId: string; payload: string; version: number; deletedAt: Date | string | null };
type RemoteConflict = { changeId: string; recordType: SyncRecordType; recordId: string; serverRecord: RemoteRecord | null };

export const syncKey = (recordType: SyncRecordType, recordId: string) => `${recordType}:${recordId}`;

export function createSyncChange(input: Omit<SyncQueueEntry, "changeId" | "createdAt">): SyncQueueEntry {
  return {
    ...input,
    changeId: `change-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
  };
}

export function enqueueSyncChange(queue: SyncQueueEntry[], entry: SyncQueueEntry) {
  const key = syncKey(entry.recordType, entry.recordId);
  const existingIndex = queue.findIndex((item) => syncKey(item.recordType, item.recordId) === key);
  if (existingIndex < 0) return [...queue, entry];
  const existing = queue[existingIndex];
  const next = [...queue];
  next[existingIndex] = { ...entry, baseVersion: existing.baseVersion, createdAt: existing.createdAt };
  return next;
}

function replaceRecord(data: AppData, record: RemoteRecord): AppData {
  let payload: unknown;
  try { payload = JSON.parse(record.payload); } catch { return data; }
  const listKey = record.recordType === "entity" ? "entities" : record.recordType === "visit" ? "visits" : record.recordType === "plannedVisit" ? "plannedVisits" : "savedLocations";
  const currentList = (data[listKey] ?? []) as Array<{ id: string }>;
  const filtered = currentList.filter((item) => item.id !== record.recordId);
  const nextList = record.deletedAt ? filtered : [...filtered, payload as { id: string }];
  return { ...data, [listKey]: nextList, syncVersions: { ...(data.syncVersions ?? {}), [syncKey(record.recordType, record.recordId)]: record.version } };
}

export function applyRemoteRecords(data: AppData, records: RemoteRecord[], protectedKeys: Set<string>) {
  return records.reduce((current, record) => protectedKeys.has(syncKey(record.recordType, record.recordId)) ? current : replaceRecord(current, record), data);
}

export function buildConflicts(existing: SyncConflict[], conflicts: RemoteConflict[], queue: SyncQueueEntry[]) {
  const now = new Date().toISOString();
  const additions = conflicts.flatMap((conflict) => {
    const local = queue.find((item) => item.changeId === conflict.changeId);
    if (!local || !conflict.serverRecord) return [];
    let serverPayload: unknown;
    try { serverPayload = JSON.parse(conflict.serverRecord.payload); } catch { serverPayload = conflict.serverRecord.payload; }
    return [{
      id: `conflict-${conflict.changeId}`,
      changeId: conflict.changeId,
      recordType: conflict.recordType,
      recordId: conflict.recordId,
      localPayload: local.payload,
      serverPayload,
      serverVersion: conflict.serverRecord.version,
      detectedAt: now,
      status: "pending" as const,
    }];
  });
  const byId = new Map([...existing, ...additions].map((item) => [item.id, item]));
  return Array.from(byId.values());
}
