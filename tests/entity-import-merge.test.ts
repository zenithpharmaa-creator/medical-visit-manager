import { describe, expect, it } from "vitest";

import { mergeEntitiesSmart } from "../lib/entity-import-merge";
import type { MedicalEntity } from "../shared/visit-types";

const entity = (overrides: Partial<MedicalEntity> = {}): MedicalEntity => ({
  id: "entity-1",
  name: "د. أحمد",
  kind: "عيادة",
  address: "شارع حدة",
  nearestPharmacy: "الخمسين",
  createdAt: "2026-08-23T00:00:00.000Z",
  ...overrides,
});

describe("smart entity import merge", () => {
  it("يمنع التكرار عند تطابق الاسم ويملأ الحقول الناقصة", () => {
    const result = mergeEntitiesSmart([entity({ geographicLocation: "حي حدة" })], [entity({ id: "imported-1", geographicCoordinates: { latitude: 15.3, longitude: 44.19, accuracy: null }, specialty: "I.M" })]);
    expect(result.entities).toHaveLength(1);
    expect(result.added).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({ specialty: "I.M", geographicCoordinates: { latitude: 15.3, longitude: 44.19 } });
  });

  it("يضيف الجهة الجديدة مرة واحدة ويمنع تكرار الصف نفسه داخل الملف", () => {
    const imported = [entity({ id: "imported-1", name: "د. جديد" }), entity({ id: "imported-2", name: "د. جديد" })];
    const result = mergeEntitiesSmart([], imported);
    expect(result.entities).toHaveLength(1);
    expect(result.added).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("يسجل تعارض اختلاف الإحداثيات ويحافظ على الموقع الموجود", () => {
    const result = mergeEntitiesSmart([entity({ geographicCoordinates: { latitude: 15.3, longitude: 44.19, accuracy: 10 } })], [entity({ id: "imported-1", geographicCoordinates: { latitude: 15.31, longitude: 44.2, accuracy: null } })]);
    expect(result.entities[0].geographicCoordinates).toMatchObject({ latitude: 15.3, longitude: 44.19 });
    expect(result.conflicts[0]).toMatchObject({ code: "coordinate-conflict", fields: ["الإحداثيات"] });
  });

  it("يسجل تعارض الإحداثيات المستخدمة لاسم جهة أخرى ويضيفها بمعرّف آمن", () => {
    const result = mergeEntitiesSmart([entity({ name: "د. موجود", geographicCoordinates: { latitude: 15.3, longitude: 44.19, accuracy: null } })], [entity({ id: "imported-1", name: "د. آخر", geographicCoordinates: { latitude: 15.3, longitude: 44.19, accuracy: null } })]);
    expect(result.entities).toHaveLength(2);
    expect(result.conflicts[0].code).toBe("coordinate-name-conflict");
    expect(result.added).toHaveLength(1);
  });
});

  it("يطابق بالسجل عند توفر المعرّف في الملف", async () => {
    const { parseEntitiesFromRows } = await import("../lib/entity-import");
    const imported = parseEntitiesFromRows([{ "المعرّف": "entity-1", "اسم الطبيب": "د. أحمد", "نوع الجهة": "عيادة", "العنوان": "شارع جديد" }]);
    const result = mergeEntitiesSmart([entity({ id: "entity-1", address: undefined })], imported);
    expect(result.entities).toHaveLength(1);
    expect(result.updated).toHaveLength(1);
    expect(result.entities[0].address).toBe("شارع جديد");
  });
