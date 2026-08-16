import { formatArabicDate } from "./visit-utils";
import { Representative, Visit } from "../shared/visit-types";

export type ReportPeriod = "daily" | "monthly";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getPeriodVisits(visits: Visit[], period: ReportPeriod, date = new Date()) {
  const key = period === "daily"
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return visits.filter((visit) => visit.recordedAt.startsWith(key));
}

export function reportTitle(period: ReportPeriod, date = new Date()) {
  if (period === "daily") return `تقرير الزيارات اليومي — ${new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(date)}`;
  return `تقرير الزيارات الشهري — ${new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

export function buildReportHtml({ visits, representatives, title, managerName }: { visits: Visit[]; representatives: Representative[]; title: string; managerName: string }) {
  const rows = visits.map((visit, index) => {
    const representative = representatives.find((item) => item.id === visit.representativeId)?.name ?? "غير محدد";
    const location = visit.location ? "موثّق" : "غير متوفر";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(visit.entityName)}</td><td>${escapeHtml(visit.entityKind)}</td><td>${escapeHtml(visit.specialty || "—")}</td><td>${escapeHtml(visit.category || "—")}</td><td>${escapeHtml(visit.geographicLocation || "—")}</td><td>${escapeHtml(representative)}</td><td>${escapeHtml(formatArabicDate(visit.recordedAt))}</td><td>${location}</td><td>${escapeHtml(visit.notes || "—")}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><style>@page { margin: 18px; } body { font-family: Arial, sans-serif; color:#172033; direction:rtl; } h1{font-size:20px;margin:0 0 6px;color:#102A43;} .meta{color:#526176;font-size:12px;margin-bottom:18px;} .summary{background:#EAF3FF;border-right:4px solid #1565C0;padding:12px;margin-bottom:18px;font-weight:bold;} table{width:100%;border-collapse:collapse;font-size:11px;} th{background:#102A43;color:#fff;padding:8px;text-align:right;} td{padding:8px;border-bottom:1px solid #DFE5EE;text-align:right;vertical-align:top;} tr:nth-child(even){background:#F7FAFC;} .footer{margin-top:20px;color:#64748B;font-size:10px;}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">إعداد: ${escapeHtml(managerName)} · تم إنشاء التقرير في ${escapeHtml(formatArabicDate(new Date().toISOString()))}</div><div class="summary">إجمالي الزيارات: ${visits.length} زيارة</div><table><thead><tr><th>#</th><th>الجهة</th><th>النوع</th><th>التخصص</th><th>الفئة</th><th>الموقع الجغرافي</th><th>المندوب</th><th>الوقت</th><th>GPS</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="10" style="text-align:center">لا توجد زيارات ضمن هذه الفترة.</td></tr>'}</tbody></table><div class="footer">مدير الزيارات الطبية</div></body></html>`;
}
