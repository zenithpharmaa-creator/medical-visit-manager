import type { AppData, SyncLogEntry } from "@/shared/visit-types";

export function appendSyncLog(data: AppData, entry: SyncLogEntry): AppData {
  return { ...data, syncHistory: [entry, ...(data.syncHistory ?? [])].slice(0, 100) };
}

export function summarizeSyncHistory(history: SyncLogEntry[]) {
  return history.reduce((summary, item) => ({
    success: summary.success + (item.status === "success" ? 1 : 0),
    errors: summary.errors + (item.status === "error" ? 1 : 0),
    conflicts: summary.conflicts + item.conflicts,
  }), { success: 0, errors: 0, conflicts: 0 });
}
