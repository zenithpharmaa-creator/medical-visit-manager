import { describe, expect, it } from "vitest";

import { formatArabicDate, isSameLocalDay, localDateKey } from "../lib/visit-utils";

describe("representative daily visit window", () => {
  it("keeps visits on the same local day", () => {
    const beforeMidnight = new Date(2026, 7, 19, 23, 59, 0);
    const sameDay = new Date(2026, 7, 19, 0, 1, 0);
    const nextDay = new Date(2026, 7, 20, 0, 0, 0);
    expect(isSameLocalDay(beforeMidnight, sameDay)).toBe(true);
    expect(isSameLocalDay(beforeMidnight, nextDay)).toBe(false);
    expect(localDateKey(nextDay)).toBe("2026-08-20");
  });

  it("formats visit time with an explicit 24-hour clock", () => {
    const formatted = formatArabicDate(new Date(2026, 7, 19, 17, 14, 0).toISOString());
    expect(formatted).not.toMatch(/ص|م/);
  });
});
