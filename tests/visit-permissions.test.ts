import { describe, expect, it } from "vitest";

import { canManageVisit } from "../lib/visit-permissions";
import type { Visit } from "../shared/visit-types";

const visit = { id: "v1", representativeId: "rep-1", recordedAt: "2026-08-19T10:00:00.000Z" } as Visit;

describe("visit permissions", () => {
  it("allows the manager at any time", () => {
    expect(canManageVisit(visit, "manager", undefined, new Date("2030-01-01T00:00:00.000Z"))).toBe(true);
  });
  it("allows the same representative during the 24-hour window", () => {
    expect(canManageVisit(visit, "representative", "rep-1", new Date("2026-08-19T22:00:00.000Z"))).toBe(true);
  });
  it("denies another representative and visits outside the window", () => {
    expect(canManageVisit(visit, "representative", "rep-2", new Date("2026-08-19T12:00:00.000Z"))).toBe(false);
    expect(canManageVisit(visit, "representative", "rep-1", new Date("2026-08-20T10:00:01.000Z"))).toBe(false);
  });
});
