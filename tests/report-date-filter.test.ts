import { describe, expect, it } from "vitest";
import { isSingleDateReport, reportDateMatches } from "../lib/report-date-filter";
import { getReportVisits, TEMPORARY_REPORT_SOURCE_INFO } from "../lib/temporary-report-source";

describe("report date filters", () => {
  it("uses one date for print and daily analysis", () => {
    expect(isSingleDateReport("daily")).toBe(true);
    expect(isSingleDateReport("daily-analysis")).toBe(true);
    expect(reportDateMatches("daily", "2026-08-26", "2026-08-26", "2026-08-30")).toBe(true);
    expect(reportDateMatches("daily", "2026-08-30", "2026-08-26", "2026-08-30")).toBe(false);
  });

  it("loads the temporary Excel rows into reports without changing local visits", () => {
    expect(TEMPORARY_REPORT_SOURCE_INFO.rowCount).toBe(5072);
    const rows = getReportVisits([]);
    expect(rows).toHaveLength(5072);
    expect(new Set(rows.map((row) => row.representativeId))).toEqual(new Set(["rep-1", "rep-2", "rep-3"]));
    expect(rows.every((row) => row.notes.includes("زيارات2026.xlsx"))).toBe(true);
  });

  it("keeps range filtering for other reports", () => {
    expect(isSingleDateReport("monthly-representative")).toBe(false);
    expect(reportDateMatches("monthly-representative", "2026-08-28", "2026-08-26", "2026-08-30")).toBe(true);
    expect(reportDateMatches("monthly-representative", "2026-08-31", "2026-08-26", "2026-08-30")).toBe(false);
  });
});
