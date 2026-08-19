import { describe, expect, it } from "vitest";

import { deriveSanaaLocation } from "../lib/geographic-location";

describe("offline geographic location", () => {
  it("resolves coordinates near Hadda to a readable local label", () => {
    const result = deriveSanaaLocation(15.338, 44.198);
    expect(result?.neighborhood).toBe("حدة");
    expect(result?.label).toContain("صنعاء");
    expect(result?.approximate).toBe(true);
  });

  it("rejects invalid coordinates", () => {
    expect(deriveSanaaLocation(Number.NaN, 44.2)).toBeNull();
  });
});
