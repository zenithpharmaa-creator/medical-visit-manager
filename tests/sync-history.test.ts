import { describe, expect, it } from "vitest";
import { appendSyncLog, summarizeSyncHistory } from "../lib/sync-history";
import type { AppData, SyncLogEntry } from "../shared/visit-types";

const data = (): AppData => ({ representatives: [], representativeLocations: {}, entities: [], visits: [], plannedVisits: [], settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] } });
const entry = (id: string, status: SyncLogEntry["status"], conflicts = 0): SyncLogEntry => ({ id, status, conflicts, startedAt: "2026-08-23T00:00:00.000Z", completedAt: "2026-08-23T00:01:00.000Z", pushed: 1, pulled: 2, message: status });

describe("sync history", () => {
  it("keeps the newest 100 entries", () => {
    const result = Array.from({ length: 105 }, (_, index) => entry(String(index), "success")).reduce((current, item) => appendSyncLog(current, item), data());
    expect(result.syncHistory).toHaveLength(100);
    expect(result.syncHistory?.[0].id).toBe("104");
  });
  it("summarizes successful, failed, and conflicted operations", () => {
    const summary = summarizeSyncHistory([entry("1", "success"), entry("2", "error"), entry("3", "conflict", 2)]);
    expect(summary).toEqual({ success: 1, errors: 1, conflicts: 2 });
  });
});
