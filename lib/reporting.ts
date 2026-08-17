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

export function buildReportHtml({ visits, representatives, title, managerName, logoUri }: { visits: Visit[]; representatives: Representative[]; title: string; managerName: string; logoUri?: string }) {
  const itemCounts = new Map<string, number>();
  visits.forEach((visit) => visit.visitedItems?.forEach((item) => itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1)));
  const popularItems = [...itemCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar")).slice(0, 10);
  const popularItemsHtml = popularItems.length ? `<section class="popular"><h2>الأصناف الأكثر استخداماً</h2><div class="popular-grid">${popularItems.map(([item, count], index) => `<div class="popular-item"><span class="rank">${index + 1}</span><span class="item-name">${escapeHtml(item)}</span><strong>${count} زيارة</strong></div>`).join("")}</div></section>` : "";
  const reportRepresentatives = [...new Set(visits.map((visit) => representatives.find((item) => item.id === visit.representativeId)?.name).filter(Boolean))].join("، ") || "جميع المندوبين";
  const reportDate = visits[0]?.recordedAt || new Date().toISOString();
  const visitDay = new Intl.DateTimeFormat("ar-YE", { weekday: "long" }).format(new Date(reportDate));
  const visitDate = formatArabicDate(reportDate);
  const rows = visits.map((visit, index) => {
    const hour = new Date(visit.recordedAt).getHours();
    const visitPeriod = hour >= 8 && hour < 14 ? "صباح" : hour >= 16 && hour < 21 ? "مساء" : "خارج الدوام";
    return `<tr><td>${index + 1}</td><td>${escapeHtml(visit.entityName)}</td><td>${escapeHtml(visit.category || "—")}</td><td>${escapeHtml(visit.specialty || "—")}</td><td>${escapeHtml(visit.entityAddress || visit.geographicLocation || "—")}</td><td>${escapeHtml(visit.nearestPharmacy || "—")}</td><td>${visitPeriod}</td><td>${escapeHtml(visit.visitedItems?.join("، ") || "—")}</td><td>${escapeHtml(visit.notes || "—")}</td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><style>@page { size: A4 portrait; margin: 14mm 12mm 18mm; } body { font-family: Arial, sans-serif; color:#172033; direction:rtl; } .header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1565C0;padding-bottom:12px;margin-bottom:14px;} .logo{width:58px;height:58px;object-fit:contain;border-radius:12px;} h1{font-size:20px;margin:0 0 6px;color:#102A43;} h2{font-size:15px;margin:0 0 10px;color:#102A43;} .meta{color:#526176;font-size:12px;margin-bottom:18px;} .summary{background:#EAF3FF;border-right:4px solid #1565C0;padding:12px;margin-bottom:18px;font-weight:bold;} .popular{background:#FFF7E6;border-right:4px solid #D97706;padding:12px;margin-bottom:18px;page-break-inside:avoid;} .popular-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;} .popular-item{display:flex;align-items:center;gap:7px;background:#fff;padding:7px;border:1px solid #F2D49B;border-radius:7px;font-size:11px;} .rank{background:#D97706;color:#fff;border-radius:50%;width:20px;height:20px;text-align:center;line-height:20px;font-weight:bold;} .item-name{flex:1;font-weight:bold;} table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed;} thead{display:table-header-group;} tr{page-break-inside:avoid;} th{background:#102A43;color:#fff;padding:7px;text-align:right;font-size:10px;} td{padding:7px;border:1px solid #DFE5EE;text-align:right;vertical-align:top;word-break:break-word;} th:first-child,td:first-child{width:34px;text-align:center;} tr:nth-child(even){background:#F7FAFC;} .signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px;page-break-inside:avoid;} .signature{border-top:1px solid #172033;padding-top:9px;text-align:center;font-size:11px;min-height:42px;} .footer{margin-top:16px;color:#64748B;font-size:10px;text-align:center;}</style></head><body><div class="header">${logoUri ? `<img class="logo" src="${escapeHtml(logoUri)}" />` : ""}<div><h1>${escapeHtml(title)}</h1><div class="meta">المندوب: ${escapeHtml(reportRepresentatives)} · يوم الزيارة: ${escapeHtml(visitDay)} · التاريخ: ${escapeHtml(visitDate)} · تم إنشاء التقرير في ${escapeHtml(formatArabicDate(new Date().toISOString()))}</div></div></div><div class="summary">إجمالي الزيارات: ${visits.length} زيارة</div>${popularItemsHtml}<table><thead><tr><th>#</th><th>اسم الطبيب</th><th>الفئة</th><th>التخصص</th><th>عنوان الجهة</th><th>أقرب صيدلية</th><th>الفترة</th><th>الأصناف المزارة</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center">لا توجد زيارات ضمن هذه الفترة.</td></tr>'}</tbody></table><div class="signatures"><div class="signature">توقيع المشرف<br /><span>الاسم: ${escapeHtml(managerName)}</span></div><div class="signature">توقيع المندوب<br /><span>الاسم: ${escapeHtml(reportRepresentatives)}</span></div></div><div class="footer">تقرير الزيارات اليومية — نسخة للطباعة على ورق A4</div></body></html>`;
}
