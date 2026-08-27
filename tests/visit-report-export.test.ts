import { describe, expect, it } from "vitest";

import { buildDailyVisitExcelRows, buildDailyVisitPdfHtml } from "../lib/visit-report-format";

describe("daily visit PDF export", () => {
  it("builds an Arabic A4 landscape report with the requested columns", () => {
    const html = buildDailyVisitPdfHtml([
      {
        representativeName: "مندوب تجريبي",
        entityName: "د. أحمد",
        category: "A",
        specialty: "Gyno",
        entityAddress: "صنعاء",
        geographicLocation: "شارع الجامعة (15.36944, 44.19102)",
        shift: "صباح",
        visitedItems: "منتج 1، منتج 2",
        notes: "ملاحظة صباحية",
      },
      {
        representativeName: "مندوب تجريبي",
        entityName: "د. سارة",
        category: "B",
        specialty: "Cardiology",
        entityAddress: "صنعاء",
        geographicLocation: "مستشفى العلوم (15.37000, 44.19200)",
        shift: "مساء",
        visitedItems: "منتج 3",
        notes: "ملاحظة مسائية",
      },
    ], "2026-08-24", "مدير الزيارات الطبية");

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("@page { size: A4 landscape;");
    expect(html).toContain("التقرير اليومي");
    expect(html).toContain("عنوان الطبيب");
    expect(html).not.toContain("الموقع الجغرافي");
    expect(html).not.toContain("15.36944");
    expect(html).not.toContain("أقرب صيدلية");
    expect(html).toContain("الأصناف المزارة");
    expect(html).toContain("الفترة");
    expect(html).toContain("صباح");
    expect(html).toContain("مساء");
    expect(html).toContain("ملاحظة صباحية");
    expect(html).toContain("ملاحظة مسائية");
    expect(html).toContain("إجمالي الزيارات");
    expect(html).toContain("صباح: 1");
    expect(html).toContain("مساء: 1");
    expect(html).toContain("الكل: 2");
    expect(html).toContain("د. أحمد");
    expect(html).not.toContain("الرقم التسلسلي");
    expect(html).not.toContain("serial-banner");
    expect(html).not.toContain("MV-");
    expect(html).not.toContain("\\\\n");
    expect((html.match(/<strong>التاريخ:<\/strong>/g) ?? []).length).toBe(1);
  });

  it("adds separate morning and evening totals to Excel rows", () => {
    const report = buildDailyVisitExcelRows([
      { representativeName: "مندوب", entityName: "طبيب 1", shift: "صباح", visitedItems: "صنف", notes: "" },
      { representativeName: "مندوب", entityName: "طبيب 2", shift: "مساء", visitedItems: "صنف", notes: "" },
      { representativeName: "مندوب", entityName: "طبيب 3", shift: "مساء", visitedItems: "صنف", notes: "" },
    ], "2026-08-24");
    expect(report.summary).toEqual({ total: 3, morning: 1, evening: 2 });
    expect(report.columns).toContain("الكلاس");
    expect(report.columns).toContain("الموقع الجغرافي");
    expect(report.body[0]).toContain("صنف");
    expect(report.columns).not.toContain("أقرب صيدلية");
  });

  it("renders an explicit empty-state message", () => {
    const html = buildDailyVisitPdfHtml([], "2026-08-24");
    expect(html).toContain("لا توجد زيارات في التاريخ أو الفلاتر المحددة.");
  });
});
