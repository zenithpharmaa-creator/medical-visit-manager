import type { Representative, Visit } from "@/shared/visit-types";
import { formatArabicDate } from "@/lib/visit-utils";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);

export function buildOverrideReportHtml(visits: Visit[], representatives: Representative[], managerName: string) {
  const rows = visits.map((visit, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(visit.entityName)}</td><td>${escapeHtml(representatives.find((rep) => rep.id === visit.representativeId)?.name ?? "غير محدد")}</td><td>${escapeHtml(formatArabicDate(visit.recordedAt))}</td><td>${escapeHtml(visit.overrideReason ?? "غير مسجل")}</td></tr>`).join("");
  return `<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><style>body{font-family:Arial;color:#172033}h1{color:#102A43}table{width:100%;border-collapse:collapse}th{background:#102A43;color:white;padding:8px;text-align:right}td{padding:8px;border-bottom:1px solid #ddd;text-align:right}tr:nth-child(even){background:#f5f8fb}.meta{color:#64748b}</style><h1>تقرير تجاوزات الموقع</h1><div class="meta">مدير النظام: ${escapeHtml(managerName)} · إجمالي التجاوزات: ${visits.length}</div><table><thead><tr><th>#</th><th>اسم الطبيب</th><th>المندوب</th><th>الوقت</th><th>سبب التجاوز</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد تجاوزات</td></tr>'}</tbody></table></html>`;
}

export function overrideRows(visits: Visit[], representatives: Representative[]) {
  return visits.map((visit, index) => ({ الرقم: index + 1, "اسم الطبيب": visit.entityName, "نوع الجهة": visit.entityKind, المندوب: representatives.find((rep) => rep.id === visit.representativeId)?.name ?? "غير محدد", الوقت: formatArabicDate(visit.recordedAt), "سبب التجاوز": visit.overrideReason ?? "غير مسجل" }));
}


export function monthlyOverrideCounts(visits: Visit[], representatives: Representative[], date = new Date()) {
  const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const monthly = visits.filter((visit) => visit.managerOverride && visit.recordedAt.startsWith(prefix));
  return representatives.map((representative) => {
    const count = monthly.filter((visit) => visit.representativeId === representative.id).length;
    return { representative, count, rate: monthly.length ? Math.round((count / monthly.length) * 100) : 0 };
  });
}
