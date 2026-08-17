import { describe, expect, it } from "vitest";

import { parseEntitiesFromRows } from "../lib/entity-import";
import { getPeriodVisits } from "../lib/reporting";
import { distanceBetweenMeters, isWithinGeofence } from "../lib/visit-utils";
import { ENTITY_CATEGORIES, SPECIALTIES } from "../lib/visit-utils";
import type { Visit } from "../shared/visit-types";
import { SANAA_OFFLINE_AREAS } from "../data/sanaa-offline";
import { buildVisitExportRows, buildVisitsCsv, buildVisitsExcelBase64 } from "../lib/visit-export";
import { parseBackupJson } from "../lib/backup-validation";

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

describe("visit export", () => {
  it("يبني صفوفاً عربية تتضمن بيانات الطبيب والموقع والحالة", () => {
    const rows = buildVisitExportRows([{ ...visit("2026-08-17T09:00:00.000Z"), entityRegion: "south", entityAddress: "شارع حدة", nearestPharmacy: "الخمسين", geographicLocation: "حي الخمسين", verificationStatus: "verified", location: { latitude: 15.3, longitude: 44.19, accuracy: 8 } }], [{ id: "rep-1", name: "علي الشعيبي", active: true }]);
    expect(rows[0]).toMatchObject({ "اسم الطبيب": "عيادة المثال", "المنطقة": "جنوب صنعاء", "العنوان": "شارع حدة", "أقرب صيدلية": "الخمسين", "خط عرض موقع الزيارة": "15.3", "حالة التحقق": "مقبولة" });
  });

  it("ينشئ CSV بترميز UTF-8 وملف Excel بصيغة base64", () => {
    const rows = buildVisitExportRows([visit("2026-08-17T09:00:00.000Z")], [{ id: "rep-1", name: "علي الشعيبي", active: true }]);
    expect(buildVisitsCsv(rows)).toContain("اسم الطبيب");
    expect(buildVisitsCsv(rows).startsWith("\uFEFF")).toBe(true);
    expect(buildVisitsExcelBase64(rows).length).toBeGreaterThan(40);
  });
});

describe("JSON backup restore validation", () => {
  const backup = { data: { representatives: [{ id: "rep-1" }], representativeLocations: {}, entities: [{ id: "entity-1" }], visits: [{ id: "visit-1" }], plannedVisits: [{ id: "plan-1" }], settings: {} } };
  it("يقرأ النسخة الصحيحة ويحسب ملخص السجلات", () => {
    expect(parseBackupJson(JSON.stringify(backup)).summary).toEqual({ representatives: 1, entities: 1, visits: 1, plannedVisits: 1 });
  });
  it("يرفض ملفاً لا يحتوي على بيانات التطبيق", () => {
    expect(() => parseBackupJson(JSON.stringify({ hello: "world" }))).toThrow();
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

  it("يقرأ قالب ملف اسمالطبيب.xlsx مع المسافات الزائدة في العناوين", () => {
    const imported = parseEntitiesFromRows([{ "اسم الطبيب": "نسر العبسي", "نوع الجهة": "عيادة", "التخصص": "I.M", "الفئة": "A", "منطقة  الزيارة": "جنوب صنعاء", "الموقع الجغرافي ": "حي الخمسين", "خط الطول": "44.19", "خط العرض": "15.30", "اقرب صيدلية": "الخمسين", "العنوان": "شارع الخمسين", "الملاحضات": "ملاحظة" }]);
    expect(imported[0]).toMatchObject({ name: "نسر العبسي", region: "south", geographicLocation: "حي الخمسين", nearestPharmacy: "الخمسين", address: "شارع الخمسين", notes: "ملاحظة", geographicCoordinates: { latitude: 15.3, longitude: 44.19 } });
  });

  it("يتجاهل الصفوف الخالية من اسم الجهة", () => {
    expect(parseEntitiesFromRows([{ "نوع الجهة": "مستشفى" }])).toHaveLength(0);
  });
});
