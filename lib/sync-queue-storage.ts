import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SyncQueueEntry } from "@/shared/visit-types";

export const SYNC_QUEUE_STORAGE_KEY = "medical-visit-manager-sync-queue-v1";
export const SYNC_QUEUE_MAX_ATTEMPTS = 8;
export const SYNC_QUEUE_BASE_RETRY_MS = 5_000;
export const SYNC_QUEUE_MAX_RETRY_MS = 15 * 60_000;

type StoredQueueEntry = SyncQueueEntry & {
  state?: "pending" | "sending" | "failed" | "conflict";
  attempts?: number;
  lastError?: string;
  nextAttemptAt?: string;
};

const asStoredEntry = (entry: SyncQueueEntry): StoredQueueEntry => ({
  ...entry,
  state: entry.state ?? "pending",
  attempts: entry.attempts ?? 0,
});

export const retryDelayMs = (attempts: number) =>
  Math.min(SYNC_QUEUE_MAX_RETRY_MS, SYNC_QUEUE_BASE_RETRY_MS * 2 ** Math.max(0, attempts - 1));

export async function loadPersistedSyncQueue(): Promise<SyncQueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SyncQueueEntry => Boolean(entry && typeof entry === "object" && "changeId" in entry && "recordType" in entry && "recordId" in entry)).map(asStoredEntry);
  } catch {
    return [];
  }
}

export async function persistSyncQueue(queue: SyncQueueEntry[]) {
  await AsyncStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue.map(asStoredEntry)));
}

export function markQueueSending(queue: SyncQueueEntry[], changeIds: Set<string>, now = new Date()) {
  return queue.map((entry) => {
    if (!changeIds.has(entry.changeId)) return entry;
    const stored = asStoredEntry(entry);
    return { ...stored, state: "sending" as const, attempts: (stored.attempts ?? 0) + 1, nextAttemptAt: undefined, lastError: undefined, updatedAt: now.toISOString() };
  });
}

export function markQueueFailure(queue: SyncQueueEntry[], changeIds: Set<string>, error: string, now = new Date()) {
  return queue.map((entry) => {
    if (!changeIds.has(entry.changeId)) return entry;
    const stored = asStoredEntry(entry);
    const attempts = stored.attempts ?? 0;
    return {
      ...stored,
      state: "failed" as const,
      lastError: error,
      nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
      updatedAt: now.toISOString(),
    };
  });
}

export function markQueueConflicts(queue: SyncQueueEntry[], changeIds: Set<string>) {
  return queue.map((entry) => changeIds.has(entry.changeId) ? { ...asStoredEntry(entry), state: "conflict" as const } : entry);
}

export function getSendableQueue(queue: SyncQueueEntry[], now = new Date()) {
  return queue.filter((entry) => {
    const stored = asStoredEntry(entry);
    if (stored.state === "conflict") return false;
    if (stored.state === "sending") return false;
    if (stored.attempts !== undefined && stored.attempts >= SYNC_QUEUE_MAX_ATTEMPTS) return false;
    return !stored.nextAttemptAt || new Date(stored.nextAttemptAt).getTime() <= now.getTime();
  });
}
