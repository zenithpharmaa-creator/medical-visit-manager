import { describe, expect, it } from "vitest";

import { EMBEDDED_ENTITIES } from "../data/embedded-entities";

describe("embedded Excel entities", () => {
  it("contains all imported rows and preserves the coordinate split", () => {
    expect(EMBEDDED_ENTITIES).toHaveLength(906);
    expect(EMBEDDED_ENTITIES.filter((entity) => entity.geographicCoordinates)).toHaveLength(505);
    expect(EMBEDDED_ENTITIES.filter((entity) => !entity.geographicCoordinates)).toHaveLength(401);
    expect(new Set(EMBEDDED_ENTITIES.map((entity) => entity.name)).size).toBe(906);
    expect(EMBEDDED_ENTITIES.every((entity) => entity.kind === "عيادة")).toBe(true);
  });
});
