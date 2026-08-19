import { describe, expect, it } from "vitest";

import { getVisitSyncLabel, getVisitSyncState } from "../lib/visit-sync-status";

describe("visit sync status", () => {
  it("يعرض الزيارة offline بانتظار الرفع والتحقق", () => {
    const state = getVisitSyncState({ offlineRecorded: true, verificationStatus: "pending" });
    expect(state).toBe("pending");
    expect(getVisitSyncLabel(state)).toContain("بانتظار الرفع والتحقق");
  });

  it("يعرض الزيارة offline كمزامنة مكتملة بعد نتيجة التحقق", () => {
    expect(getVisitSyncState({ offlineRecorded: true, verificationStatus: "verified" })).toBe("synced");
    expect(getVisitSyncState({ offlineRecorded: true, verificationStatus: "rejected" })).toBe("synced");
  });

  it("يميز الزيارة المحلية التي لم تسجل كـ offline", () => {
    expect(getVisitSyncState({ offlineRecorded: false, verificationStatus: "verified" })).toBe("local");
  });
});
