import { describe, expect, it } from "vitest";
import { buildSharedLocationReportRows } from "../lib/shared-location-report-format";
import type { MedicalEntity, SharedLocation } from "../shared/visit-types";

const location: SharedLocation = {
  id: "shared-1",
  name: "مستشفى جامعة العلوم",
  address: "حي الجامعة",
  coordinates: { latitude: 15.30, longitude: 44.20, accuracy: null },
  usageCount: 2,
  createdAt: "2026-08-22T00:00:00.000Z",
};

const entity: MedicalEntity = {
  id: "entity-1",
  name: "د. أحمد",
  kind: "عيادة",
  region: "north",
  address: "شارع الجامعة",
  specialty: "باطنية",
  contactName: "777000000",
  geographicCoordinates: { latitude: 15.30, longitude: 44.20, accuracy: null },
  sharedLocationId: "shared-1",
  createdAt: "2026-08-22T00:00:00.000Z",
};

describe("shared location report", () => {
  it("builds an Arabic row with linked location and entity details", () => {
    const [row] = buildSharedLocationReportRows(location, [entity]);
    expect(row).toMatchObject({ "الموقع المشترك": "مستشفى جامعة العلوم", "اسم الجهة": "د. أحمد" });
    expect(row["نوع الجهة"]).toBe("عيادة");
    expect(row["خط العرض"]).toBe("15.3");
    expect(row["خط الطول"]).toBe("44.2");
  });
});
