import { describe, expect, it } from "vitest";
import { formatHijriDate, getYemenOfficialHolidaySeeds, isYemenOfficialHoliday } from "../lib/calendar-date";

describe("calendar date formatting", () => {
  it("formats a Gregorian date with a numeric Hijri day/month in parentheses", () => {
    expect(formatHijriDate(new Date("2026-08-27T12:00:00"))).toMatch(/^\(\d{1,2}\/\d{1,2}\)$/);
  });

  it("provides approved Yemen holiday seeds and detects their dates", () => {
    const holidays = getYemenOfficialHolidaySeeds(2026);
    expect(holidays.some((holiday) => holiday.name === "عيد الوحدة اليمنية" && holiday.status === "approved")).toBe(true);
    expect(isYemenOfficialHoliday(new Date("2026-05-22T12:00:00"), holidays)).toBe(true);
    expect(isYemenOfficialHoliday(new Date("2026-05-23T12:00:00"), holidays)).toBe(false);
  });
});
