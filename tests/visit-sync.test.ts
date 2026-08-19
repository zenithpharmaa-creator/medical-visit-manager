import { describe, expect, it } from "vitest";

import { synchronizePendingVisits } from "../lib/visit-sync";
import type { AppData, Visit } from "../shared/visit-types";

const pendingVisit = (location: Visit["location"]): Visit => ({
  id: "visit-offline-1",
  representativeId: "rep-1",
  entityId: "entity-1",
  entityName: "عيادة الاختبار",
  entityKind: "عيادة",
  recordedAt: "2026-08-19T09:00:00.000Z",
  location,
  notes: "",
  offlineRecorded: true,
  verificationStatus: "pending",
});

const baseData = (visit: Visit): AppData => ({
  representatives: [],
  representativeLocations: {},
  entities: [{ id: "entity-1", name: "عيادة الاختبار", kind: "عيادة", createdAt: "2026-08-01T00:00:00.000Z", geographicCoordinates: { latitude: 15.3694, longitude: 44.191, accuracy: 5 } }],
  visits: [visit],
  plannedVisits: [],
  settings: { managerName: "مدير النظام", reportEmail: "", reminderTime: "18:00", geofenceRadiusMeters: 200, managerPin: "", visitedItems: [] },
});

describe("manual visit synchronization", () => {
  it("يتحقق من الزيارة المعلقة ويعيد حالة verified وعدد السجلات المعالجة", () => {
    const result = synchronizePendingVisits(baseData(pendingVisit({ latitude: 15.3694, longitude: 44.191, accuracy: 8 })), "2026-08-19T12:00:00.000Z");
    expect(result.processed).toBe(1);
    expect(result.data.visits[0].verificationStatus).toBe("verified");
    expect(result.data.visits[0].verificationCheckedAt).toBe("2026-08-19T12:00:00.000Z");
  });

  it("يرفض الزيارة المعلقة إذا كان موقعها خارج النطاق", () => {
    const result = synchronizePendingVisits(baseData(pendingVisit({ latitude: 15.38, longitude: 44.20, accuracy: 8 })), "2026-08-19T12:00:00.000Z");
    expect(result.processed).toBe(1);
    expect(result.data.visits[0].verificationStatus).toBe("rejected");
  });

  it("لا يعيد معالجة زيارة تمت مراجعتها سابقاً", () => {
    const visit = { ...pendingVisit(null), verificationStatus: "verified" as const };
    const result = synchronizePendingVisits(baseData(visit), "2026-08-19T12:00:00.000Z");
    expect(result.processed).toBe(0);
    expect(result.data).toEqual(baseData(visit));
  });
});
