import { describe, expect, it } from "vitest";

import { mergeEmbeddedEntities, preserveExistingCoordinates } from "../lib/entity-migration";
import type { MedicalEntity } from "../shared/visit-types";

const entity = (id: string, name: string, coordinates?: MedicalEntity["geographicCoordinates"]): MedicalEntity => ({ id, name, kind: "عيادة", geographicCoordinates: coordinates, createdAt: "2026-08-19T00:00:00.000Z" });

describe("embedded entity migration", () => {
  it("fills missing coordinates and adds missing entities without replacing existing coordinates", () => {
    const saved = [entity("saved-1", "طبيب موجود", { latitude: 15, longitude: 44, accuracy: 50 }), entity("saved-2", "طبيب بلا إحداثيات")];
    const embedded = [entity("embedded-1", "طبيب موجود", { latitude: 15.4, longitude: 44.2, accuracy: null }), entity("embedded-2", "طبيب بلا إحداثيات", { latitude: 15.5, longitude: 44.3, accuracy: null }), entity("embedded-3", "طبيب جديد", { latitude: 15.6, longitude: 44.4, accuracy: null })];
    const merged = mergeEmbeddedEntities(saved, embedded, true);
    expect(merged).toHaveLength(3);
    expect(merged[0].geographicCoordinates?.latitude).toBe(15);
    expect(merged[1].geographicCoordinates?.latitude).toBe(15.5);
    expect(merged[2].id).toBe("embedded-3");
  });

  it("restores embedded coordinates and the recent batch marker", () => {
    const saved = [entity("saved-1", "طبيب موجود")];
    const embedded = [{ ...entity("embedded-1", "طبيب موجود", { latitude: 15.4, longitude: 44.2, accuracy: null }), coordinatesAddedAt: "2026-08-26-map-xlsx" }];
    const merged = mergeEmbeddedEntities(saved, embedded, true);
    expect(merged[0].geographicCoordinates?.latitude).toBe(15.4);
    expect(merged[0].geographicCoordinates?.longitude).toBe(44.2);
    expect(merged[0].coordinatesAddedAt).toBe("2026-08-26-map-xlsx");
  });

  it("preserves existing coordinates when an update omits them", () => {
    const existing = entity("saved-1", "طبيب موجود", { latitude: 15.9, longitude: 44.9, accuracy: 8 });
    const incoming = entity("saved-1", "طبيب موجود");
    const merged = preserveExistingCoordinates(existing, incoming);
    expect(merged.geographicCoordinates).toEqual(existing.geographicCoordinates);
  });

  it("does not overwrite later manual coordinates after migration is complete", () => {
    const saved = [entity("saved-1", "طبيب موجود", { latitude: 15.9, longitude: 44.9, accuracy: 8 })];
    const embedded = [entity("embedded-1", "طبيب موجود", { latitude: 15.4, longitude: 44.2, accuracy: null })];
    const merged = mergeEmbeddedEntities(saved, embedded, false);
    expect(merged[0].geographicCoordinates?.latitude).toBe(15.9);
  });
});
