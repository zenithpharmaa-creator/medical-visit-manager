import { Representative, Visit } from "../shared/visit-types";
import { formatArabicDate, localDateKey } from "./visit-utils";

export type ReportPeriod = "daily" | "monthly";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getPeriodVisits(visits: Visit[], period: ReportPeriod, date = new Date()) {
  const targetDay = localDateKey(date);
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  return visits.filter((visit) => {
    const recordedDate = new Date(visit.recordedAt);
    if (Number.isNaN(recordedDate.getTime())) return false;
    if (period === "daily") return localDateKey(recordedDate) === targetDay;
    return recordedDate.getFullYear() === targetYear && recordedDate.getMonth() === targetMonth;
  });
}

export function sortVisitsByRecordedAt(visits: Visit[]) {
  return [...visits].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

export function formatVisitTime(recordedAt: string) {
  return new Intl.DateTimeFormat("ar-YE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(recordedAt));
}

export function reportTitle(period: ReportPeriod, date = new Date()) {
  if (period === "daily") return `تقرير الزيارات اليومي — ${new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(date)}`;
  return `تقرير الزيارات الشهري — ${new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

export function buildReportHtml({ visits, representatives, title, managerName, logoUri }: { visits: Visit[]; representatives: Representative[]; title: string; managerName: string; logoUri?: string }) {
  const orderedVisits = sortVisitsByRecordedAt(visits);
  const reportRepresentatives = [...new Set(orderedVisits.map((visit) => representatives.find((item) => item.id === visit.representativeId)?.name).filter(Boolean))].join("، ") || "جميع المندوبين";
  const reportDate = orderedVisits[0]?.recordedAt || new Date().toISOString();
  const visitDay = new Intl.DateTimeFormat("ar-YE", { weekday: "long" }).format(new Date(reportDate));
  const visitDate = new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(new Date(reportDate));
  const rows = orderedVisits.map((visit, index) => {
    const hour = new Date(visit.recordedAt).getHours();
    const visitPeriod = hour >= 8 && hour < 14 ? "صباح" : hour >= 16 && hour < 21 ? "مساء" : "خارج الدوام";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(formatVisitTime(visit.recordedAt))}</td><td>${escapeHtml(visit.entityName)}</td><td>${escapeHtml(visit.category || "—")}</td><td>${escapeHtml(visit.specialty || "—")}</td><td>${escapeHtml(visit.entityAddress || visit.geographicLocation || "—")}</td><td>${escapeHtml(visit.nearestPharmacy || "—")}</td><td>${visitPeriod}</td><td>${escapeHtml(visit.visitedItems?.join("، ") || "—")}</td><td>${escapeHtml(visit.notes || "—")}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><style>@page { size: A4 landscape; margin: 10mm 12mm 14mm; } body { font-family: Arial, sans-serif; color:#172033; direction:rtl; } .header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1257A6;padding-bottom:10px;margin-bottom:12px;} .logo{width:52px;height:52px;object-fit:contain;border-radius:10px;} h1{font-size:19px;margin:0 0 5px;color:#102A43;} .meta{color:#526176;font-size:11px;margin-bottom:12px;} .summary{background:#EAF3FF;border-right:4px solid #1257A6;padding:9px;margin-bottom:12px;font-weight:bold;} table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;} thead{display:table-header-group;} tr{page-break-inside:avoid;} th{background:#102A43;color:#fff;padding:5px 4px;text-align:right;font-size:9px;} td{padding:5px 4px;border:1px solid #DFE5EE;text-align:right;vertical-align:top;word-break:break-word;} th:first-child,td:first-child{width:28px;text-align:center;} th:nth-child(2),td:nth-child(2){width:55px;text-align:center;} tr:nth-child(even){background:#F7FAFC;} .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:20px;page-break-inside:avoid;} .signature{border-top:1px solid #172033;padding-top:7px;text-align:center;font-size:10px;min-height:32px;} .footer{margin-top:10px;color:#64748B;font-size:9px;text-align:center;}</style></head><body><div class="header">${logoUri ? `<img class="logo" src="${escapeHtml(logoUri)}" />` : ""}<div><h1>${escapeHtml(title)}</h1><div class="meta">المندوب: ${escapeHtml(reportRepresentatives)} · يوم الزيارة: ${escapeHtml(visitDay)} · التاريخ: ${escapeHtml(visitDate)} · تم إنشاء التقرير في ${escapeHtml(formatArabicDate(new Date().toISOString()))}</div></div></div><div class="summary">إجمالي الزيارات: ${orderedVisits.length} زيارة · الترتيب: تصاعدي حسب وقت الزيارة</div><table><thead><tr><th>#</th><th>وقت الزيارة</th><th>اسم الطبيب</th><th>الفئة</th><th>التخصص</th><th>عنوان الجهة</th><th>أقرب صيدلية</th><th>الفترة</th><th>الأصناف المزارة</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="10" style="text-align:center">لا توجد زيارات ضمن هذه الفترة.</td></tr>'}</tbody></table><div class="signatures"><div class="signature">توقيع المشرف<br /><span>الاسم: ${escapeHtml(managerName)}</span></div><div class="signature">توقيع المندوب<br /><span>الاسم: ${escapeHtml(reportRepresentatives)}</span></div></div><div class="footer">تقرير الزيارات اليومية — ورق A4 بالوضع العرضي</div></body></html>`;
}
