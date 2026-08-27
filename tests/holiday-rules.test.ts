import { describe, expect, it } from "vitest";

import { expandApprovedHolidayDates, findPendingEmptyDays, isApprovedHolidayOnDate } from "../lib/holiday-rules";
import type { AppData, OfficialHoliday } from "../shared/visit-types";

const holiday = (overrides: Partial<OfficialHoliday> = {}): OfficialHoliday => ({
  id: "holiday-1",
  name: "إجازة وطنية",
  kind: "national",
  startDate: "2026-08-20",
  endDate: "2026-08-22",
  status: "approved",
  createdAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const baseData = (overrides: Partial<AppData> = {}): Pick<AppData, "representatives" | "plannedVisits" | "visits" | "officialHolidays" | "emptyDayReviews"> => ({
  representatives: [{ id: "rep-1", name: "مندوب 1", active: true }],
  plannedVisits: [
    { id: "plan-1", representativeId: "rep-1", entityId: "entity-1", entityName: "طبيب 1", entityKind: "عيادة", scheduledDate: "2026-08-19", shift: "morning" },
    { id: "plan-2", representativeId: "rep-1", entityId: "entity-2", entityName: "طبيب 2", entityKind: "عيادة", scheduledDate: "2026-08-20", shift: "morning" },
    { id: "plan-3", representativeId: "rep-1", entityId: "entity-3", entityName: "طبيب 3", entityKind: "عيادة", scheduledDate: "2026-08-21", shift: "morning" },
  ],
  visits: [{ id: "visit-1", representativeId: "rep-1", entityId: "entity-1", entityName: "طبيب 1", entityKind: "عيادة", recordedAt: "2026-08-19T09:00:00.000Z", location: null, notes: "", visitedItems: [] }],
  officialHolidays: [],
  emptyDayReviews: [],
  ...overrides,
});

describe("holiday rules", () => {
  it("يتحقق من الإجازة المعتمدة فقط ضمن نطاقها", () => {
    expect(isApprovedHolidayOnDate([holiday()], "2026-08-21")).toBe(true);
    expect(isApprovedHolidayOnDate([holiday({ status: "pending" })], "2026-08-21")).toBe(false);
    expect(isApprovedHolidayOnDate([holiday()], "2026-08-23")).toBe(false);
  });

  it("يوسع نطاق الإجازة المعتمدة إلى أيام الشهر المطلوب", () => {
    expect(expandApprovedHolidayDates([holiday()], "2026-08")).toEqual(["2026-08-20", "2026-08-21", "2026-08-22"]);
    expect(expandApprovedHolidayDates([holiday({ status: "excluded" })], "2026-08")).toEqual([]);
  });

  it("يكتشف الأيام المخططة السابقة بلا زيارة ويستثني العطلة والقرار المحفوظ", () => {
    const data = baseData({ officialHolidays: [holiday({ startDate: "2026-08-20", endDate: "2026-08-20" })] });
    expect(findPendingEmptyDays(data, "2026-08-21")).toEqual([{ representativeId: "rep-1", date: "2026-08-21" }]);
    const reviewed = { ...data, emptyDayReviews: [{ id: "review-1", representativeId: "rep-1", date: "2026-08-21", decision: "exception" as const, manualEntryAllowed: true, decidedBy: "مدير النظام", decidedAt: "2026-08-21T18:00:00.000Z" }] };
    expect(findPendingEmptyDays(reviewed, "2026-08-21")).toEqual([]);
  });
});
