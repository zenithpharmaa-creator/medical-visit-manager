import type { Representative, Visit } from "@/shared/visit-types";
import { formatArabicDate } from "@/lib/visit-utils";

export function rejectedVisitRows(visits: Visit[], representatives: Representative[]) {
  return visits.map((visit) => ({
    "اسم الطبيب": visit.entityName,
    "نوع الجهة": visit.entityKind,
    "المندوب": representatives.find((item) => item.id === visit.representativeId)?.name ?? "غير محدد",
    "وقت الزيارة": formatArabicDate(visit.recordedAt),
    "الموقع المحفوظ": visit.location ? `${visit.location.latitude}, ${visit.location.longitude}` : "غير متوفر",
    "موقع الجهة": visit.geographicCoordinates ? `${visit.geographicCoordinates.latitude}, ${visit.geographicCoordinates.longitude}` : "غير متوفر",
    "المسافة بالمتر": visit.verificationDistanceMeters ?? "غير محسوبة",
    "سبب الرفض": visit.verificationReason ?? "غير مسجل",
  }));
}

export function buildRejectedVisitReportHtml(visits: Visit[], representatives: Representative[], managerName: string) {
  const rows = rejectedVisitRows(visits, representatives).map((row) => `<tr>${Object.values(row).map((value) => `<td>${String(value)}</td>`).join("")}</tr>`).join("");
  return `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;color:#102A43;padding:24px}h1{color:#1565C0}p{color:#64748B}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#C0392B;color:white;padding:7px}td{border:1px solid #DDE6EF;padding:6px;text-align:right}tr:nth-child(even){background:#FFF5F5}</style></head><body><h1>تقرير الزيارات المرفوضة بعد التحقق</h1><p>مدير النظام: ${managerName} · عدد الزيارات: ${visits.length}</p><table><thead><tr><th>الطبيب</th><th>الجهة</th><th>المندوب</th><th>الوقت</th><th>موقع الزيارة</th><th>موقع الجهة</th><th>المسافة</th><th>سبب الرفض</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
