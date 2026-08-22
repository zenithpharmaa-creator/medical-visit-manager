import { describe, expect, it } from "vitest";
import { countEntitiesUsingSharedLocation, deriveSharedLocations, normalizeSharedLocations, sortSharedLocations } from "../lib/shared-locations";
import type { MedicalEntity, SharedLocation } from "../shared/visit-types";

const entity = (id: string, name: string, latitude: number, longitude: number, geographicLocation = "موقع مشترك"): MedicalEntity => ({
  id,
  name,
  kind: "مستشفى",
  address: "صنعاء",
  geographicLocation,
  geographicCoordinates: { latitude, longitude, accuracy: null },
  createdAt: `2026-08-${id === "one" ? "01" : "02"}T00:00:00.000Z`,
});

describe("shared locations", () => {
  it("derives one shared location and counts entities using the same coordinates", () => {
    const locations = deriveSharedLocations([entity("one", "مستشفى جامعة العلوم", 15.30, 44.20), entity("two", "طبيب جديد", 15.30, 44.20), entity("three", "مركز آخر", 15.31, 44.21, "موقع آخر")]);
    expect(locations).toHaveLength(2);
    expect(locations[0].usageCount).toBe(2);
    expect(locations[0].name).toBe("موقع مشترك");
  });

  it("sorts most-used locations before less-used locations", () => {
    const locations: SharedLocation[] = [
      { id: "a", name: "مستشفى أ", coordinates: { latitude: 15, longitude: 44, accuracy: null }, usageCount: 1, createdAt: "2026-01-01" },
      { id: "b", name: "مستشفى ب", coordinates: { latitude: 15.1, longitude: 44.1, accuracy: null }, usageCount: 4, createdAt: "2026-01-01" },
    ];
    expect(sortSharedLocations(locations).map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("falls back to deriving locations when an imported saved-location list is invalid", () => {
    const entities = [entity("one", "مستشفى جامعة العلوم", 15.30, 44.20)];
    expect(normalizeSharedLocations([{ id: "bad", name: "غير صالح" }], entities)[0].coordinates.latitude).toBe(15.30);
  });

  it("counts linked entities before a shared location can be deleted", () => {
    const location: SharedLocation = { id: "location-1", name: "مستشفى جامعة العلوم", coordinates: { latitude: 15.30, longitude: 44.20, accuracy: null }, usageCount: 2, createdAt: "2026-01-01" };
    expect(countEntitiesUsingSharedLocation([entity("one", "الجهة المرتبطة", 15.30, 44.20), entity("two", "جهة أخرى", 15.31, 44.21)], location)).toBe(1);
  });
});
