import { describe, expect, it } from "vitest";

import { hasRequiredVisitedItems } from "../lib/visit-form-rules";

describe("visit form rules", () => {
  it("requires at least one non-empty visited item", () => {
    expect(hasRequiredVisitedItems(["Akisol 2mg tab"])).toBe(true);
    expect(hasRequiredVisitedItems([])).toBe(false);
    expect(hasRequiredVisitedItems(["", "   "])).toBe(false);
    expect(hasRequiredVisitedItems(["", "Losart 50mg tab"])).toBe(true);
  });
});
