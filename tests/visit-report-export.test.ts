import { describe, expect, it } from "vitest";

import { buildDailyVisitPdfHtml } from "../lib/visit-report-format";

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
        notes: "ملاحظة صباحية",
      },
      {
        representativeName: "مندوب تجريبي",
        entityName: "د. سارة",
        category: "B",
        specialty: "Cardiology",
        entityAddress: "صنعاء",
        nearestPharmacy: "صيدلية أخرى",
        shift: "مساء",
        visitedItems: "منتج 3",
        notes: "ملاحظة مسائية",
      },
    ], "2026-08-24", "مدير الزيارات الطبية");

    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain("@page { size: A4 landscape;");
    expect(html).toContain("التقرير اليومي");
    expect(html).toContain("عنوان الطبيب");
    expect(html).toContain("أقرب صيدلية");
    expect(html).toContain("الأصناف المزارة");
    expect(html).toContain("الفترة");
    expect(html).toContain("صباح");
    expect(html).toContain("مساء");
    expect(html).toContain("ملاحظة صباحية");
    expect(html).toContain("ملاحظة مسائية");
    expect(html).toContain("د. أحمد");
    expect(html).not.toContain("الرقم التسلسلي");
    expect(html).not.toContain("serial-banner");
    expect(html).not.toContain("MV-");
    expect(html).not.toContain("\\\\n");
    expect((html.match(/<strong>التاريخ:<\/strong>/g) ?? []).length).toBe(1);
  });

  it("renders an explicit empty-state message", () => {
    const html = buildDailyVisitPdfHtml([], "2026-08-24");
    expect(html).toContain("لا توجد زيارات في التاريخ أو الفلاتر المحددة.");
  });
});
