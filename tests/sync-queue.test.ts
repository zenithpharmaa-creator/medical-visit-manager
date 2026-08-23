import { describe, expect, it } from "vitest";

import { applyRemoteRecords, buildConflicts, createSyncChange, enqueueSyncChange } from "../lib/sync-queue";
import type { AppData } from "../shared/visit-types";

const baseData = (): AppData => ({
  representatives: [],
  representativeLocations: {},
  entities: [{ id: "e1", name: "طبيب 1", kind: "عيادة", createdAt: "2026-01-01T00:00:00.000Z" }],
  visits: [],
  plannedVisits: [],
  savedLocations: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] },
});

describe("sync queue", () => {
  it("collapses repeated edits for the same record while keeping the original base version", () => {
    const first = createSyncChange({ recordType: "entity", recordId: "e1", operation: "upsert", baseVersion: 2, payload: { id: "e1", name: "قديم" } });
    const second = createSyncChange({ recordType: "entity", recordId: "e1", operation: "upsert", baseVersion: 7, payload: { id: "e1", name: "أحدث" } });
    const queue = enqueueSyncChange(enqueueSyncChange([], first), second);
    expect(queue).toHaveLength(1);
    expect(queue[0].baseVersion).toBe(2);
    expect(queue[0].payload).toEqual({ id: "e1", name: "أحدث" });
  });

  it("applies remote records when the record is not locally protected", () => {
    const remote = { recordType: "entity" as const, recordId: "e2", payload: JSON.stringify({ id: "e2", name: "طبيب 2", kind: "عيادة", createdAt: "2026-01-02T00:00:00.000Z" }), version: 1, deletedAt: null };
    const result = applyRemoteRecords(baseData(), [remote], new Set());
    expect(result.entities.some((entity) => entity.id === "e2")).toBe(true);
    expect(result.syncVersions?.["entity:e2"]).toBe(1);
  });

  it("keeps a local record untouched when it is protected by a pending change", () => {
    const remote = { recordType: "entity" as const, recordId: "e1", payload: JSON.stringify({ id: "e1", name: "من الخادم", kind: "عيادة", createdAt: "2026-01-01T00:00:00.000Z" }), version: 3, deletedAt: null };
    const result = applyRemoteRecords(baseData(), [remote], new Set(["entity:e1"]));
    expect(result.entities[0].name).toBe("طبيب 1");
  });

  it("creates a pending conflict containing both local and server payloads", () => {
    const local = createSyncChange({ recordType: "entity", recordId: "e1", operation: "upsert", baseVersion: 1, payload: { id: "e1", name: "محلي" } });
    const conflicts = buildConflicts([], [{ changeId: local.changeId, recordType: "entity", recordId: "e1", serverRecord: { recordType: "entity", recordId: "e1", payload: JSON.stringify({ id: "e1", name: "خادم" }), version: 2, deletedAt: null } }], [local]);
    expect(conflicts[0]).toMatchObject({ recordId: "e1", serverVersion: 2, status: "pending", localPayload: { name: "محلي" }, serverPayload: { name: "خادم" } });
  });
});
