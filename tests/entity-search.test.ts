import { describe, expect, it } from "vitest";
import { rankEntitiesForSearch } from "../lib/entity-search";
import type { MedicalEntity } from "../shared/visit-types";

const makeEntity = (id: string, name: string, address = "صنعاء", nearestPharmacy?: string): MedicalEntity => ({
  id,
  name,
  kind: "مستشفى",
  address,
  nearestPharmacy,
  createdAt: "2026-08-22T00:00:00.000Z",
});

describe("entity map search", () => {
  it("prioritizes names that start with the typed letters", () => {
    const result = rankEntitiesForSearch([
      makeEntity("1", "العلوم المركزي"),
      makeEntity("2", "جامعة العلوم الطبية"),
      makeEntity("3", "مركز آخر", "العلوم"),
    ], "العلوم");
    expect(result.map((entity) => entity.id)).toEqual(["1", "2", "3"]);
  });

  it("searches supporting fields and limits suggestions", () => {
    const result = rankEntitiesForSearch([makeEntity("1", "مستشفى أ", "حي الجامعة"), makeEntity("2", "مركز ب")], "الجامعة", 1);
    expect(result.map((entity) => entity.id)).toEqual(["1"]);
  });

  it("finds an entity by its nearest pharmacy", () => {
    const result = rankEntitiesForSearch([makeEntity("1", "مستشفى أ", "حي الجامعة", "صيدلية الشفاء"), makeEntity("2", "مركز ب")], "الشفاء");
    expect(result.map((entity) => entity.id)).toEqual(["1"]);
  });
});
