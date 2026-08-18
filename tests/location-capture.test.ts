import { describe, expect, it } from "vitest";

import { isFiniteLocation, isRecentLocation, normalizeLocation } from "../lib/location-capture";

describe("offline location capture", () => {
  it("accepts valid Sana'a coordinates and rejects invalid values", () => {
    expect(isFiniteLocation({ latitude: 15.3694, longitude: 44.191 })).toBe(true);
    expect(isFiniteLocation({ latitude: 150, longitude: 44.191 })).toBe(false);
    expect(isFiniteLocation({ latitude: 15.3694, longitude: Number.NaN })).toBe(false);
  });

  it("normalizes a native location sample for local persistence", () => {
    const sample = normalizeLocation({ latitude: 15.3694, longitude: 44.191, accuracy: 18 }, 1000);
    expect(sample).toEqual({ latitude: 15.3694, longitude: 44.191, accuracy: 18, capturedAt: 1000 });
  });

  it("recognizes only a recent local GPS sample", () => {
    const sample = normalizeLocation({ latitude: 15.3694, longitude: 44.191 }, 1000);
    expect(isRecentLocation(sample, 1000 + 60_000)).toBe(true);
    expect(isRecentLocation(sample, 1000 + 6 * 60_000)).toBe(false);
  });
});
