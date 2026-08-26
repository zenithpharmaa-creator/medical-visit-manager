import { describe, expect, it } from "vitest";

import { EMBEDDED_ENTITIES } from "../data/embedded-entities";

describe("embedded Excel entities", () => {
  it("contains the merged Map.xlsx rows without duplicate identities", () => {
    expect(EMBEDDED_ENTITIES).toHaveLength(924);
    expect(EMBEDDED_ENTITIES.filter((entity) => entity.geographicCoordinates)).toHaveLength(856);
    expect(EMBEDDED_ENTITIES.filter((entity) => !entity.geographicCoordinates)).toHaveLength(68);
    expect(new Set(EMBEDDED_ENTITIES.map((entity) => `${entity.name}|${entity.address ?? ""}|${entity.specialty ?? ""}|${entity.category ?? ""}`)).size).toBe(924);
    expect(EMBEDDED_ENTITIES.every((entity) => entity.geographicCoordinates ? Number.isFinite(entity.geographicCoordinates.latitude) && Number.isFinite(entity.geographicCoordinates.longitude) : true)).toBe(true);
  });
});
