export type DailyVisitReportRow = {
  representativeName: string;
  entityName: string;
  category?: string;
  specialty?: string;
  entityAddress?: string;
  geographicLocation?: string;
  shift: string;
  visitedItems: string;
  notes?: string;
};

export type ComprehensiveDailyTableInput = {
  id: string;
  visitDate: string;
  doctor: string;
  specialty: string;
  shift: string;
  address: string;
  prescribedItems: string;
  representative: string;
  region: string;
};

export type ComprehensiveDailyTableRow = ComprehensiveDailyTableInput;

export function buildComprehensiveDailyTableRows(rows: ComprehensiveDailyTableInput[]): ComprehensiveDailyTableRow[] {
  return rows.map((row) => ({ ...row }));
}

export type RepresentativeSummaryInput = {
  id: string;
  name: string;
  visits: { recordedAt: string; entityId?: string; entityName: string }[];
};

export type RepresentativeSummaryRow = {
  id: string;
  representative: string;
  total: number;
  morning: number;
  evening: number;
  doctors: number;
};

export function buildRepresentativeSummaryRows(inputs: RepresentativeSummaryInput[]): RepresentativeSummaryRow[] {
  return inputs.map((input) => {
    const morning = input.visits.filter((visit) => new Date(visit.recordedAt).getHours() < 16).length;
    return {
      id: input.id,
      representative: input.name,
      total: input.visits.length,
      morning,
      evening: input.visits.length - morning,
      doctors: new Set(input.visits.map((visit) => visit.entityId || visit.entityName)).size,
    };
  });
}

export type DailyVisitReportHeader = {
  reportName: string;
  dayName: string;
  date: string;
  representativeNames: string;
};

export type DailyVisitReportSummary = { total: number; morning: number; evening: number };

export function summarizeDailyVisitRows(rows: DailyVisitReportRow[]): DailyVisitReportSummary {
  return rows.reduce<DailyVisitReportSummary>((summary, row) => {
    if (row.shift === "مساء") summary.evening += 1;
    else summary.morning += 1;
    summary.total += 1;
    return summary;
  }, { total: 0, morning: 0, evening: 0 });
}

function escapeHtml(value: string | undefined) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDateArabic(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-YE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDayArabic(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-YE", { weekday: "long" }).format(date);
}


const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" aria-label="شعار مدير الزيارات الطبية"><rect width="42" height="42" rx="10" fill="#1257A6"/><path d="M21 8c-6.3 0-11.4 5.1-11.4 11.4 0 8.2 11.4 14.7 11.4 14.7s11.4-6.5 11.4-14.7C32.4 13.1 27.3 8 21 8Z" fill="#fff"/><circle cx="21" cy="19.4" r="3.8" fill="#1257A6"/><path d="M18 25h6M21 22v6" stroke="#1257A6" stroke-width="1.8" stroke-linecap="round"/></svg>`;

export function buildDailyVisitPdfHtml(rows: DailyVisitReportRow[], reportDate: string, appName = "مدير الزيارات الطبية") {
  const representativeNames = [...new Set(rows.map((row) => row.representativeName).filter(Boolean))].join("، ") || "جميع المندوبين";
  const dayName = formatDayArabic(reportDate);
  const summary = summarizeDailyVisitRows(rows);
  const tableRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.entityName)}</td>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.specialty)}</td>
      <td>${escapeHtml(row.entityAddress)}</td>
      <td>${escapeHtml(row.shift)}</td>
      <td>${escapeHtml(row.visitedItems)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #182230; background: #fff; font-family: Arial, "Tahoma", sans-serif; direction: rtl; font-size: 10px; }
    .report { width: 100%; }
    .header { display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: center; border-bottom: 2px solid #25364a; padding: 0 0 8px; margin-bottom: 10px; gap: 14px; }
    .brand { display: flex; flex-direction: row; align-items: center; gap: 7px; min-width: 190px; font-size: 14px; font-weight: 800; color: #183b63; }
    .brand img { width: 42px; height: 42px; }
    .title { text-align: center; flex: 1; font-size: 16px; font-weight: 800; color: #172b4d; }
    .meta { min-width: 245px; font-size: 10px; line-height: 1.8; color: #465466; }
    .meta strong { color: #172b4d; }
    .summary { display: flex; flex-direction: row-reverse; gap: 8px; margin-bottom: 9px; }
    .total-row td { background: #dbeafe; color: #123b68; font-weight: 800; text-align: center; border-top: 2px solid #4b78a8; }
    .total-row td:first-child { text-align: right; }

    .summary span { border: 1px solid #aeb8c4; border-radius: 3px; padding: 4px 8px; background: #f4f6f8; color: #334155; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; direction: rtl; font-size: 9px; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
    tr { page-break-inside: avoid; }
    th { background: #e5e8eb; color: #172b4d; border: 1px solid #6b7280; font-weight: 800; padding: 5px 3px; line-height: 1.3; text-align: center; vertical-align: middle; }
    td { border: 1px solid #8b949e; padding: 5px 3px; min-height: 24px; line-height: 1.35; vertical-align: middle; text-align: right; overflow-wrap: anywhere; word-break: break-word; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .col-doctor { width: 15%; } .col-category { width: 9%; } .col-specialty { width: 13%; } .col-address { width: 20%; }
    .col-shift { width: 8%; } .col-items { width: 21%; } .col-notes { width: 14%; }
    .empty { text-align: center; padding: 24px; border: 1px solid #8b949e; color: #657184; }
    .footer { margin-top: 8px; display: flex; justify-content: space-between; color: #657184; font-size: 9px; }
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      <div class="brand"><img src="data:image/svg+xml;utf8,${encodeURIComponent(logoSvg)}" alt="شعار" /><span>${escapeHtml(appName)}</span></div>
      <div class="title">التقرير اليومي</div>
      <div class="meta"><div><strong>المندوب:</strong> ${escapeHtml(representativeNames)}</div><div><strong>اليوم:</strong> ${escapeHtml(dayName)}</div><div><strong>التاريخ:</strong> ${escapeHtml(formatDateArabic(reportDate))}</div></div>
    </header>
    <div class="summary"><span>عدد السجلات: ${rows.length}</span><span>اتجاه الطباعة: عرضي</span></div>
    ${rows.length ? `<table><thead><tr><th class="col-doctor">الطبيب</th><th class="col-category">الكلاس</th><th class="col-specialty">التخصص</th><th class="col-address">عنوان الطبيب</th><th class="col-shift">الفترة</th><th class="col-items">الأصناف المزارة</th><th class="col-notes">ملاحظات الزيارة</th></tr></thead><tbody>${tableRows}</tbody><tfoot><tr class="total-row"><td colspan="4">إجمالي الزيارات</td><td>صباح: ${summary.morning}</td><td>مساء: ${summary.evening}</td><td>الكل: ${summary.total}</td></tr></tfoot></table>` : `<div class="empty">لا توجد زيارات في التاريخ أو الفلاتر المحددة.</div>`}
    <footer class="footer"><span>تم الإنشاء من ${escapeHtml(appName)}</span><span>التقرير اليومي — ${escapeHtml(dayName)} — ${escapeHtml(formatDateArabic(reportDate))}</span></footer>
  </main>
</body>
</html>`;
}

export function buildDailyVisitExcelRows(rows: DailyVisitReportRow[], reportDate: string, appName = "مدير الزيارات الطبية") {
  const representativeNames = [...new Set(rows.map((row) => row.representativeName).filter(Boolean))].join("، ") || "جميع المندوبين";
  const summary = summarizeDailyVisitRows(rows);
  const header: DailyVisitReportHeader = {
    reportName: "التقرير اليومي",
    dayName: formatDayArabic(reportDate),
    date: formatDateArabic(reportDate),
    representativeNames,
  };
  const columns = ["الطبيب", "الكلاس", "التخصص", "عنوان الطبيب", "الموقع الجغرافي", "الفترة", "الأصناف المزارة", "ملاحظات الزيارة"];
  const body = rows.map((row) => [row.entityName, row.category || "", row.specialty || "", row.entityAddress || "", row.geographicLocation || "", row.shift, row.visitedItems, row.notes || ""]);
  return { appName, header, columns, body, summary };
}


export type MonthlyReportInput = { recordedAt: string; entityId?: string; entityName: string };
export type MonthlyReportRow = { entityName: string; counts: number[] };

export function buildMonthlyReportRows(visits: MonthlyReportInput[], year: number): MonthlyReportRow[] {
  const byDoctor = new Map<string, MonthlyReportRow>();
  visits.forEach((visit) => {
    const date = new Date(visit.recordedAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
    const key = visit.entityId || visit.entityName;
    const row = byDoctor.get(key) ?? { entityName: visit.entityName, counts: Array.from({ length: 12 }, () => 0) };
    row.counts[date.getMonth()] += 1;
    byDoctor.set(key, row);
  });
  return [...byDoctor.values()].sort((left, right) => left.entityName.localeCompare(right.entityName, "ar"));
}

export function monthlyReportTotals(rows: MonthlyReportRow[]): number[] {
  return rows.reduce((totals, row) => totals.map((total, index) => total + row.counts[index]), Array.from({ length: 12 }, () => 0));
}

export function buildMonthlyVisitPdfHtml(rows: MonthlyReportRow[], year: number, appName = "مدير الزيارات الطبية") {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const totals = monthlyReportTotals(rows);
  const header = months.slice().reverse().map((month) => `<th>${month}-${year}</th>`).join("");
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.entityName)}</td>${row.counts.slice().reverse().map((count) => `<td>${count || "—"}</td>`).join("")}<td>${row.counts.reduce((sum, count) => sum + count, 0)}</td></tr>`).join("");
  const totalRow = `<tr class="total"><td>الإجمالي</td>${totals.slice().reverse().map((count) => `<td>${count}</td>`).join("")}<td>${totals.reduce((sum, count) => sum + count, 0)}</td></tr>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#172033;direction:rtl}h1{text-align:center;color:#172b4d;font-size:18px}p{text-align:center;color:#64748b;font-size:11px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}th,td{border:1px solid #536273;padding:7px 4px;text-align:center;min-height:28px}th{background:#cfeeff;color:#1257a6;font-weight:800}th:first-child,td:first-child{width:17%;text-align:right}tr:nth-child(even){background:#f8fbff}.total td{background:#dbeafe;color:#123b68;font-weight:800;border-top:2px solid #4b78a8}</style></head><body><h1>${escapeHtml(appName)} — الزيارات الشهرية حسب المندوب</h1><p>السنة: ${year} | عدد الأطباء: ${rows.length} | اتجاه الطباعة: عرضي</p>${rows.length ? `<table><thead><tr><th></th>${header}<th>إجمالي السنة</th></tr><tr><th>اسم الطبيب</th>${months.map(() => "<th>عدد الزيارات</th>").join("")}<th>عدد الزيارات</th></tr></thead><tbody>${body}</tbody><tfoot>${totalRow}</tfoot></table>` : `<p>لا توجد زيارات للسنة المحددة.</p>`}</body></html>`;
}

export function buildMonthlyVisitExcelRows(rows: MonthlyReportRow[], year: number) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const totals = monthlyReportTotals(rows);
  return { rows: [["", ...months.slice().reverse().map((month) => `${month}-${year}`), "إجمالي السنة"], ["اسم الطبيب", ...months.slice().reverse().map(() => "عدد الزيارات"), "عدد الزيارات"], ...rows.map((row) => [row.entityName, ...row.counts.slice().reverse().map((count) => count || "—"), row.counts.reduce((sum, count) => sum + count, 0)]), ["الإجمالي", ...totals.slice().reverse(), totals.reduce((sum, count) => sum + count, 0)]] };
}


export type RepresentativeTotalInput = { representativeId: string; representativeName: string; entityId?: string; entityName: string; recordedAt: string };
export type RepresentativeTotalReportRow = { entityName: string; counts: number[] };

export function buildRepresentativeTotalReportRows(visits: RepresentativeTotalInput[], representatives: Array<{ id: string; name: string }>): RepresentativeTotalReportRow[] {
  const byDoctor = new Map<string, RepresentativeTotalReportRow>();
  visits.forEach((visit) => {
    const key = visit.entityId || visit.entityName.trim();
    const row = byDoctor.get(key) ?? { entityName: visit.entityName.trim(), counts: Array.from({ length: representatives.length }, () => 0) };
    const representativeIndex = representatives.findIndex((representative) => representative.id === visit.representativeId);
    if (representativeIndex >= 0) row.counts[representativeIndex] += 1;
    byDoctor.set(key, row);
  });
  return [...byDoctor.values()].sort((left, right) => left.entityName.localeCompare(right.entityName, "ar", { sensitivity: "base" }));
}

export function representativeTotalColumnTotals(rows: RepresentativeTotalReportRow[], representativeCount: number) {
  return rows.reduce((totals, row) => totals.map((total, index) => total + (row.counts[index] ?? 0)), Array.from({ length: representativeCount }, () => 0));
}

export function buildRepresentativeTotalVisitPdfHtml(rows: RepresentativeTotalReportRow[], representatives: Array<{ id: string; name: string }>, appName = "مدير الزيارات الطبية") {
  const totals = representativeTotalColumnTotals(rows, representatives.length);
  const representativeHeaders = representatives.map((representative) => `<th>${escapeHtml(representative.name)}</th>`).join("");
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.entityName)}</td>${row.counts.map((count) => `<td>${count || "—"}</td>`).join("")}</tr>`).join("");
  const total = `<tr class="total"><td>الإجمالي</td>${totals.map((count) => `<td>${count}</td>`).join("")}</tr>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#172033;direction:rtl}h1{text-align:center;color:#172b4d;font-size:18px}p{text-align:center;color:#64748b;font-size:11px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}th,td{border:1px solid #536273;padding:7px 4px;text-align:center;min-height:28px}th{background:#cfeeff;color:#1257a6;font-weight:800}th:first-child,td:first-child{width:22%;text-align:right}tr:nth-child(even){background:#f8fbff}.total td{background:#dbeafe;color:#123b68;font-weight:800;border-top:2px solid #4b78a8}</style></head><body><h1>${escapeHtml(appName)} — إجمالي للمندوبين</h1><p>عدد الأطباء: ${rows.length} | عدد المندوبين: ${representatives.length} | اتجاه الطباعة: عرضي</p>${rows.length ? `<table><thead><tr><th></th>${representativeHeaders}</tr><tr><th>اسم الطبيب</th>${representatives.map(() => "<th>عدد الزيارات</th>").join("")}</tr></thead><tbody>${body}</tbody><tfoot>${total}</tfoot></table>` : `<p>لا توجد زيارات ضمن الفلاتر الحالية.</p>`}</body></html>`;
}

export function buildRepresentativeTotalVisitExcelRows(rows: RepresentativeTotalReportRow[], representatives: Array<{ id: string; name: string }>) {
  const totals = representativeTotalColumnTotals(rows, representatives.length);
  return { rows: [["", ...representatives.map((representative) => representative.name)], ["اسم الطبيب", ...representatives.map(() => "عدد الزيارات")], ...rows.map((row) => [row.entityName, ...row.counts.map((count) => count || "—")]), ["الإجمالي", ...totals]] };
}
