import { describe, expect, it } from "vitest";
import type { MedicalEntity, Visit } from "../shared/visit-types";
import { duplicateEntityGroups, findDuplicateEntityName, missingEntityFields } from "../lib/entity-validation";

const entity = (id: string, name: string): MedicalEntity => ({
  id,
  name,
  kind: "عيادة",
  address: "",
  specialty: "",
  category: "",
  region: "north",
  nearestPharmacy: "",
  createdAt: new Date(0).toISOString(),
});

describe("entity validation", () => {
  it("detects Arabic duplicate names despite diacritics and spacing", () => {
    const existing = entity("1", "أحمد  محمد");
    expect(findDuplicateEntityName([existing], " احمد محمد ")?.id).toBe("1");
    expect(duplicateEntityGroups([existing, entity("2", "احمد محمد")])).toHaveLength(1);
    expect(findDuplicateEntityName([existing], "احمد محمد", "1")).toBeUndefined();
  });

  it("reports missing entity data and missing visited items", () => {
    const current = entity("1", "د. سارة");
    const visits: Visit[] = [];
    expect(missingEntityFields(current, visits)).toEqual([
      "الموقع الجغرافي",
      "العنوان",
      "التخصص",
      "الفئة",
      "أقرب صيدلية",
      "الأصناف المزارة",
    ]);
  });
});
