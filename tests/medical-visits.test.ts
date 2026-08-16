import { describe, expect, it } from "vitest";

import { parseEntitiesFromRows } from "../lib/entity-import";
import { getPeriodVisits } from "../lib/reporting";
import { distanceBetweenMeters, isWithinGeofence } from "../lib/visit-utils";
import { ENTITY_CATEGORIES, SPECIALTIES } from "../lib/visit-utils";
import type { Visit } from "../shared/visit-types";
import { SANAA_OFFLINE_AREAS } from "../data/sanaa-offline";

const visit = (recordedAt: string): Visit => ({
  id: recordedAt,
  representativeId: "rep-1",
  entityId: "entity-1",
  entityName: "عيادة المثال",
  entityKind: "عيادة",
  recordedAt,
  location: null,
  notes: "",
});

describe("geofence validation", () => {
  it("يقبل الموقع القريب ويرفض الموقع البعيد", () => {
    const distance = distanceBetweenMeters({ latitude: 15.3694, longitude: 44.191 }, { latitude: 15.3694, longitude: 44.192 });
    expect(distance).toBeGreaterThan(50);
    expect(isWithinGeofence(distance, 200)).toBe(true);
    expect(isWithinGeofence(distance, 50)).toBe(false);
  });
});

describe("Sana'a offline location catalog", () => {
  it("يحتوي على مديريات ومناطق صنعاء محلياً", () => {
    expect(SANAA_OFFLINE_AREAS.length).toBeGreaterThan(10);
    expect(SANAA_OFFLINE_AREAS.map((area) => area.value)).toContain("صنعاء القديمة");
    expect(SANAA_OFFLINE_AREAS.map((area) => area.value)).toContain("بني الحارث");
  });
});

describe("medical visit reports", () => {
  it("يجمع التقرير اليومي الزيارات الموجودة في اليوم المختار فقط", () => {
    const visits = [visit("2026-08-16T09:00:00.000Z"), visit("2026-08-16T14:00:00.000Z"), visit("2026-08-15T14:00:00.000Z")];
    expect(getPeriodVisits(visits, "daily", new Date("2026-08-16T12:00:00.000Z"))).toHaveLength(2);
  });

  it("يجمع التقرير الشهري جميع زيارات الشهر نفسه", () => {
    const visits = [visit("2026-08-01T09:00:00.000Z"), visit("2026-08-31T14:00:00.000Z"), visit("2026-07-31T14:00:00.000Z")];
    expect(getPeriodVisits(visits, "monthly", new Date("2026-08-16T12:00:00.000Z"))).toHaveLength(2);
  });
});

describe("entity dropdown options", () => {
  it("يوفر خيارات محددة للتخصص والفئة", () => {
    expect(SPECIALTIES).toContain("I.M");
    expect(SPECIALTIES).toContain("Gyno");
    expect(ENTITY_CATEGORIES).toEqual(expect.arrayContaining(["A", "B", "C"]));
  });
});

describe("Excel entity import", () => {
  it("يقرأ الأعمدة العربية ويصنّف جهة الزيارة", () => {
    const imported = parseEntitiesFromRows([{ "اسم الجهة": "صيدلية الشفاء", "نوع الجهة": "صيدلية", "اسم الطبيب": "د. خالد", "العنوان": "الرياض", "التخصص": "I.M", "الفئة": "A", "أقرب صيدلية": "صيدلية الشفاء", "الموقع الجغرافي": "الرياض - العليا" }]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: "د. خالد", kind: "صيدلية", contactName: "", address: "الرياض", specialty: "I.M", category: "A", nearestPharmacy: "صيدلية الشفاء", geographicLocation: "الرياض - العليا" });
  });

  it("يتجاهل الصفوف الخالية من اسم الجهة", () => {
    expect(parseEntitiesFromRows([{ "نوع الجهة": "مستشفى" }])).toHaveLength(0);
  });
});
