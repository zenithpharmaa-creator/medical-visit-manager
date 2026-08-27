import { describe, expect, it } from "vitest";
import { buildMonthlyReportRows, buildMonthlyVisitExcelRows, buildMonthlyVisitPdfHtml, buildRepresentativeTotalReportRows, buildRepresentativeTotalVisitExcelRows, buildRepresentativeTotalVisitPdfHtml, monthlyReportTotals } from "../lib/visit-report-format";

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

  it("switches the displayed data between 2025 and 2026", () => {
    expect(buildMonthlyReportRows(visits, 2025)).toEqual([{ entityName: "طبيب ب", counts: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] }]);
    expect(buildMonthlyReportRows(visits, 2026)).toHaveLength(2);
  });

  it("calculates and places the automatic monthly total row", () => {
    const rows = buildMonthlyReportRows(visits, 2026);
    expect(monthlyReportTotals(rows)).toEqual([2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const excel = buildMonthlyVisitExcelRows(rows, 2026).rows;
    expect(excel.at(-1)).toEqual(["الإجمالي", 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 4]);
  });

  it("groups representative totals by doctor and representative and matches both export headers", () => {
    const representatives = [{ id: "rep-1", name: "مندوب أ" }, { id: "rep-2", name: "مندوب ب" }];
    const totalRows = buildRepresentativeTotalReportRows([
      { representativeId: "rep-1", representativeName: "مندوب أ", entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-01T10:00:00.000Z" },
      { representativeId: "rep-1", representativeName: "مندوب أ", entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-02T10:00:00.000Z" },
      { representativeId: "rep-2", representativeName: "مندوب ب", entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-03T10:00:00.000Z" },
    ], representatives);
    expect(totalRows).toEqual([{ entityName: "طبيب أ", counts: [2, 1] }]);
    expect(buildRepresentativeTotalVisitExcelRows(totalRows, representatives).rows.slice(0, 2)).toEqual([["", "مندوب أ", "مندوب ب"], ["اسم الطبيب", "عدد الزيارات", "عدد الزيارات"]]);
    const pdf = buildRepresentativeTotalVisitPdfHtml(totalRows, representatives);
    expect(pdf).toContain("مندوب أ");
    expect(pdf).toContain("مندوب ب");
    expect(pdf).toContain("اسم الطبيب");
    expect(pdf).toContain("الإجمالي");
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

  it("keeps the representatives-total layout stable for display and exports", () => {
    const representatives = [{ id: "rep-1", name: "مندوب أ" }, { id: "rep-2", name: "مندوب ب" }];
    const rows = buildRepresentativeTotalReportRows([
      { representativeId: "rep-1", representativeName: "مندوب أ", entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-01T10:00:00.000Z" },
      { representativeId: "rep-2", representativeName: "مندوب ب", entityId: "doctor-1", entityName: "طبيب أ", recordedAt: "2026-01-02T10:00:00.000Z" },
    ], representatives);
    const excel = buildRepresentativeTotalVisitExcelRows(rows, representatives).rows;
    const pdf = buildRepresentativeTotalVisitPdfHtml(rows, representatives);
    expect(excel[0]).toEqual(["", "مندوب أ", "مندوب ب"]);
    expect(excel[1]).toEqual(["اسم الطبيب", "عدد الزيارات", "عدد الزيارات"]);
    expect(excel[2]).toEqual(["طبيب أ", 1, 1]);
    expect(pdf.indexOf("اسم الطبيب")).toBeLessThan(pdf.indexOf("طبيب أ"));
    expect(pdf).toContain("مندوب ب");
  });
});
