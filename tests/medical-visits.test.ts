import { describe, expect, it } from "vitest";

import { parseEntitiesFromRows } from "../lib/entity-import";
import { getPeriodVisits } from "../lib/reporting";
import { distanceBetweenMeters, isWithinGeofence } from "../lib/visit-utils";
import { ENTITY_CATEGORIES, ENTITY_KINDS, normalizeEntityKind, SPECIALTIES } from "../lib/visit-utils";
import type { Visit } from "../shared/visit-types";
import { SANAA_OFFLINE_AREAS } from "../data/sanaa-offline";
import { buildVisitExportRows, buildVisitsCsv, buildVisitsExcelBase64 } from "../lib/visit-export";
import { mergeAppData, parseBackupJson } from "../lib/backup-validation";

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
  it("يحافظ على سجل المواقع المشتركة داخل النسخة المستوردة", () => {
    const sharedLocation = { id: "location-1", name: "مستشفى جامعة العلوم", address: "صنعاء", coordinates: { latitude: 15.3, longitude: 44.2, accuracy: null }, usageCount: 3, createdAt: "2026-08-01T00:00:00.000Z" };
    const parsed = parseBackupJson(JSON.stringify({ data: { ...backup.data, savedLocations: [sharedLocation] } }));
    expect(parsed.data.savedLocations).toEqual([sharedLocation]);
  });
  it("يدمج المواقع المشتركة حسب الإحداثيات دون تكرار", () => {
    const sharedLocation = { id: "location-1", name: "مستشفى جامعة العلوم", coordinates: { latitude: 15.3, longitude: 44.2, accuracy: null }, usageCount: 3, createdAt: "2026-08-01T00:00:00.000Z" };
    const current = { data: { ...backup.data, savedLocations: [sharedLocation] } };
    const incoming = { data: { ...backup.data, savedLocations: [{ ...sharedLocation, id: "location-imported", usageCount: 1 }, { ...sharedLocation, id: "location-2", name: "مركز جديد", coordinates: { latitude: 15.31, longitude: 44.21, accuracy: null }, usageCount: 2 }] } };
    const result = mergeAppData(parseBackupJson(JSON.stringify(current)).data, parseBackupJson(JSON.stringify(incoming)).data);
    expect(result.data.savedLocations).toHaveLength(2);
    expect(result.data.savedLocations?.find((item) => item.coordinates.latitude === 15.3)?.usageCount).toBe(3);
    expect(result.data.savedLocations?.find((item) => item.coordinates.latitude === 15.31)?.name).toBe("مركز جديد");
  });
  it("يرفض ملفاً لا يحتوي على بيانات التطبيق", () => {
    expect(() => parseBackupJson(JSON.stringify({ hello: "world" }))).toThrow();
  });
  it("يدمج السجلات الجديدة ويحافظ على السجل الحالي عند تكرار المعرّف", () => {
    const current = { data: { representatives: [{ id: "rep-1", name: "الحالي" }], representativeLocations: {}, entities: [{ id: "entity-1" }], visits: [{ id: "visit-1" }], plannedVisits: [], settings: {} } };
    const incoming = { data: { representatives: [{ id: "rep-1", name: "مستورد" }], representativeLocations: {}, entities: [{ id: "entity-2" }], visits: [{ id: "visit-2" }], plannedVisits: [], settings: {} } };
    const result = mergeAppData(parseBackupJson(JSON.stringify(current)).data, parseBackupJson(JSON.stringify(incoming)).data);
    expect(result.data.representatives).toEqual([{ id: "rep-1", name: "الحالي" }]);
    expect(result.data.entities).toHaveLength(2);
    expect(result.data.visits).toHaveLength(2);
    expect(result.summary.skippedRepresentatives).toBe(1);
  });
});

describe("entity dropdown options", () => {
  it("يوفر خيارات الجهات بالترتيب الجديد دون الصيدلية", () => {
    expect(ENTITY_KINDS).toEqual(["عيادة", "مستشفى حكومي", "مستشفى خاص", "مركز حكومي", "مركز خاص", "برج طبي"]);
    expect(ENTITY_KINDS).not.toContain("صيدلية");
  });

  it("يحافظ على أقرب صيدلية كحقل مستقل عند تحويل القيم القديمة", () => {
    expect(normalizeEntityKind("صيدلية")).toBe("عيادة");
    expect(normalizeEntityKind("مستشفى خاص")).toBe("مستشفى خاص");
    expect(normalizeEntityKind("مركز حكومي")).toBe("مركز حكومي");
    expect(normalizeEntityKind("برج طبي")).toBe("برج طبي");
  });

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
    expect(imported[0]).toMatchObject({ name: "د. خالد", kind: "عيادة", contactName: "", address: "الرياض", specialty: "I.M", category: "A", nearestPharmacy: "صيدلية الشفاء", geographicLocation: "الرياض - العليا" });
  });

  it("يقرأ قالب ملف اسمالطبيب.xlsx مع المسافات الزائدة في العناوين", () => {
    const imported = parseEntitiesFromRows([{ "اسم الطبيب": "نسر العبسي", "نوع الجهة": "عيادة", "التخصص": "I.M", "الفئة": "A", "منطقة  الزيارة": "جنوب صنعاء", "الموقع الجغرافي ": "حي الخمسين", "خط الطول": "44.19", "خط العرض": "15.30", "اقرب صيدلية": "الخمسين", "العنوان": "شارع الخمسين", "الملاحضات": "ملاحظة" }]);
    expect(imported[0]).toMatchObject({ name: "نسر العبسي", region: "south", geographicLocation: "حي الخمسين", nearestPharmacy: "الخمسين", address: "شارع الخمسين", notes: "ملاحظة", geographicCoordinates: { latitude: 15.3, longitude: 44.19 } });
  });

  it("يتجاهل الصفوف الخالية من اسم الجهة", () => {
    expect(parseEntitiesFromRows([{ "نوع الجهة": "مستشفى" }])).toHaveLength(0);
  });
});
