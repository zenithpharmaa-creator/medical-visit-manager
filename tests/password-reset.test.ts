import { describe, expect, it } from "vitest";

import { mergeAppData } from "../lib/backup-validation";
import { createPasswordResetRequest, resolvePasswordResetRequest } from "../lib/password-reset";
import { createSyncChange, enqueueSyncChange } from "../lib/sync-queue";
import type { AppData, PasswordResetRequest } from "../shared/visit-types";

const emptyData = (): AppData => ({
  representatives: [],
  representativeLocations: {},
  entities: [],
  visits: [],
  plannedVisits: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] },
  passwordResetRequests: [],
});

describe("password reset requests", () => {
  it("creates a pending request and resolves it to the default password flow", () => {
    const request = createPasswordResetRequest({ accountType: "representative", representativeId: "rep-1", accountLabel: "علي الشعيبي", requestedAt: "2026-08-27T07:00:00.000Z" });
    const resolved = resolvePasswordResetRequest(request, "approved", "اعتمد المدير إعادة الضبط إلى 123.", "2026-08-27T07:01:00.000Z");

    expect(request.status).toBe("pending");
    expect(resolved.status).toBe("approved");
    expect(resolved.resolutionNote).toContain("123");
    expect(resolved).not.toHaveProperty("password");
  });

  it("prevents duplicate save queue entries for the same visit", () => {
    const first = createSyncChange({ recordType: "visit", recordId: "visit-1", operation: "upsert", baseVersion: 0, payload: { id: "visit-1" } });
    const second = createSyncChange({ recordType: "visit", recordId: "visit-1", operation: "upsert", baseVersion: 0, payload: { id: "visit-1", notes: "updated" } });

    const queue = enqueueSyncChange(enqueueSyncChange([], first), second);

    expect(queue).toHaveLength(1);
    expect(queue[0].recordId).toBe("visit-1");
    expect(queue[0].payload).toEqual({ id: "visit-1", notes: "updated" });
  });

  it("keeps the newest request when backup data is merged", () => {
    const current = emptyData();
    const incoming = emptyData();
    const request: PasswordResetRequest = {
      id: "reset-1",
      accountType: "representative",
      representativeId: "rep-1",
      accountLabel: "علي الشعيبي",
      requestedAt: "2026-08-27T08:00:00.000Z",
      status: "pending",
    };
    incoming.passwordResetRequests = [request];

    const result = mergeAppData(current, incoming);

    expect(result.data.passwordResetRequests).toEqual([request]);
  });

  it("preserves an approved request status during a later merge", () => {
    const current = emptyData();
    const incoming = emptyData();
    const approved: PasswordResetRequest = {
      id: "reset-2",
      accountType: "manager",
      accountLabel: "مدير النظام",
      requestedAt: "2026-08-27T09:00:00.000Z",
      status: "approved",
      resolvedAt: "2026-08-27T09:01:00.000Z",
      resolutionNote: "تمت إعادة الضبط إلى 123.",
    };
    current.passwordResetRequests = [approved];
    incoming.passwordResetRequests = [{ ...approved, status: "pending", resolvedAt: undefined, resolutionNote: undefined }];

    const result = mergeAppData(current, incoming);

    expect(result.data.passwordResetRequests?.[0]).toEqual(approved);
  });
});
