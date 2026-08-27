import { describe, expect, it } from "vitest";
import { buildMonthlyReportRows, buildMonthlyVisitExcelRows, buildMonthlyVisitPdfHtml, monthlyReportTotals } from "../lib/visit-report-format";

describe("monthly report format", () => {
  const visits = [
    { entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-05T10:00:00.000Z" },
    { entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-20T17:00:00.000Z" },
    { entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-03-04T10:00:00.000Z" },
    { entityId: "doctor-2", entityName: "طبيب ب", recordedAt: "2026-02-08T10:00:00.000Z" },
    { entityId: "doctor-2", entityName: "طبيب ب", recordedAt: "2025-12-31T10:00:00.000Z" },
  ];

  it("groups visits by doctor and month for the selected year", () => {
    const rows = buildMonthlyReportRows(visits, 2026);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.entityName === "طبيب أ")?.counts).toEqual([2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(rows.find((row) => row.entityName === "طبيب ب")?.counts[1]).toBe(1);
  });

  it("calculates and places the automatic monthly total row", () => {
    const rows = buildMonthlyReportRows(visits, 2026);
    expect(monthlyReportTotals(rows)).toEqual([2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const excel = buildMonthlyVisitExcelRows(rows, 2026).rows;
    expect(excel.at(-1)).toEqual(["الإجمالي", 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 4]);
  });

  it("uses the same two header rows and total in PDF and Excel", () => {
    const rows = buildMonthlyReportRows(visits, 2026);
    const pdf = buildMonthlyVisitPdfHtml(rows, 2026);
    expect(pdf).toContain("Jan-2026");
    expect(pdf).toContain("اسم الطبيب");
    expect(pdf).toContain("عدد الزيارات");
    expect(pdf).toContain("الإجمالي");
    expect(buildMonthlyVisitExcelRows(rows, 2026).rows[0]).toContain("Dec-2026");
  });
});
