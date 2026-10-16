import { describe, expect, it } from "vitest";

import { getSendableQueue, markQueueFailure, markQueueSending, retryDelayMs, SYNC_QUEUE_MAX_ATTEMPTS } from "../lib/sync-queue-storage";
import type { SyncQueueEntry } from "../shared/visit-types";

const entry = (changeId: string): SyncQueueEntry => ({
  changeId,
  recordType: "visit",
  recordId: changeId,
  operation: "upsert",
  baseVersion: 0,
  payload: { id: changeId },
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("persistent sync queue retry policy", () => {
  it("uses exponential backoff capped at fifteen minutes", () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(10_000);
    expect(retryDelayMs(20)).toBe(15 * 60_000);
  });

  it("marks a batch as sending and excludes it from another send", () => {
    const sending = markQueueSending([entry("a"), entry("b")], new Set(["a"]), new Date("2026-01-01T00:00:00.000Z"));
    expect(sending[0]).toMatchObject({ state: "sending", attempts: 1 });
    expect(getSendableQueue(sending)).toEqual([sending[1]]);
  });

  it("keeps a failed item until its retry time and stops after the attempt limit", () => {
    const failed = markQueueFailure([entry("a")], new Set(["a"]), "network", new Date("2026-01-01T00:00:00.000Z"));
    expect(failed[0].state).toBe("failed");
    expect(getSendableQueue(failed, new Date("2026-01-01T00:00:04.000Z"))).toHaveLength(0);
    expect(getSendableQueue(failed, new Date("2026-01-01T00:00:06.000Z"))).toHaveLength(1);

    const exhausted = Array.from({ length: SYNC_QUEUE_MAX_ATTEMPTS }, (_, index) => ({
      ...entry("a"),
      state: "failed" as const,
      attempts: SYNC_QUEUE_MAX_ATTEMPTS,
      nextAttemptAt: new Date(index).toISOString(),
    }));
    expect(getSendableQueue(exhausted)).toHaveLength(0);
  });
});
