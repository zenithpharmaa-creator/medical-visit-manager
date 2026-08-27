import { describe, expect, it } from "vitest";

import { buildDailyVisitPdfHtml } from "../lib/visit-report-export";

describe("daily visit PDF export", () => {
  it("builds an Arabic A4 landscape report with the requested columns", () => {
    const html = buildDailyVisitPdfHtml([
      {
        representativeName: "مندوب تجريبي",
        entityName: "د. أحمد",
        category: "A",
        specialty: "Gyno",
        entityAddress: "صنعاء",
        nearestPharmacy: "صيدلية قريبة",
        shift: "صباح",
        visitedItems: "منتج 1، منتج 2",
        notes: "ملاحظة",
      },
    ], "2026-08-24", "مدير الزيارات الطبية");

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("@page { size: A4 landscape;");
    expect(html).toContain("تقرير الزيارات اليومية");
    expect(html).toContain("أقرب صيدلية");
    expect(html).toContain("الأصناف المزارة");
    expect(html).toContain("د. أحمد");
  });

  it("renders an explicit empty-state message", () => {
    const html = buildDailyVisitPdfHtml([], "2026-08-24");
    expect(html).toContain("لا توجد زيارات في التاريخ أو الفلاتر المحددة.");
  });
});
