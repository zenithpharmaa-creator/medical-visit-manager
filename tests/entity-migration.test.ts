import { describe, expect, it } from "vitest";

import { mergeEmbeddedEntities } from "../lib/entity-migration";
import type { MedicalEntity } from "../shared/visit-types";

const entity = (id: string, name: string, coordinates?: MedicalEntity["geographicCoordinates"]): MedicalEntity => ({ id, name, kind: "عيادة", geographicCoordinates: coordinates, createdAt: "2026-08-19T00:00:00.000Z" });

describe("embedded entity migration", () => {
  it("updates coordinates once while preserving the saved entity and adding missing entities", () => {
    const saved = [entity("saved-1", "طبيب موجود", { latitude: 15, longitude: 44, accuracy: 50 })];
    const embedded = [entity("embedded-1", "طبيب موجود", { latitude: 15.4, longitude: 44.2, accuracy: null }), entity("embedded-2", "طبيب جديد", { latitude: 15.5, longitude: 44.3, accuracy: null })];
    const merged = mergeEmbeddedEntities(saved, embedded, true);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("saved-1");
    expect(merged[0].geographicCoordinates?.latitude).toBe(15.4);
    expect(merged[1].id).toBe("embedded-2");
  });

  it("does not overwrite later manual coordinates after migration is complete", () => {
    const saved = [entity("saved-1", "طبيب موجود", { latitude: 15.9, longitude: 44.9, accuracy: 8 })];
    const embedded = [entity("embedded-1", "طبيب موجود", { latitude: 15.4, longitude: 44.2, accuracy: null })];
    const merged = mergeEmbeddedEntities(saved, embedded, false);
    expect(merged[0].geographicCoordinates?.latitude).toBe(15.9);
  });
});
