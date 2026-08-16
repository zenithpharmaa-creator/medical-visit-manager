import { describe, expect, it } from "vitest";

import { parseEntitiesFromRows } from "../lib/entity-import";
import { getPeriodVisits } from "../lib/reporting";
import { ENTITY_CATEGORIES, SPECIALTIES } from "../lib/visit-utils";
import type { Visit } from "../shared/visit-types";

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
    expect(SPECIALTIES).toContain("قلب");
    expect(SPECIALTIES).toContain("صيدلة");
    expect(ENTITY_CATEGORIES).toEqual(expect.arrayContaining(["الفئة أ", "الفئة ب", "VIP"]));
  });
});

describe("Excel entity import", () => {
  it("يقرأ الأعمدة العربية ويصنّف جهة الزيارة", () => {
    const imported = parseEntitiesFromRows([{ "اسم الجهة": "صيدلية الشفاء", "نوع الجهة": "صيدلية", "اسم الطبيب": "د. خالد", "العنوان": "الرياض", "التخصص": "تغذية", "الفئة": "أ", "الموقع الجغرافي": "الرياض - العليا" }]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: "صيدلية الشفاء", kind: "صيدلية", contactName: "د. خالد", address: "الرياض", specialty: "تغذية", category: "أ", geographicLocation: "الرياض - العليا" });
  });

  it("يتجاهل الصفوف الخالية من اسم الجهة", () => {
    expect(parseEntitiesFromRows([{ "نوع الجهة": "مستشفى" }])).toHaveLength(0);
  });
});
