import * as XLSX from "xlsx";

import type { Representative, Visit } from "@/shared/visit-types";

export type VisitExportRow = {
  "اسم الطبيب": string;
  "نوع الجهة": string;
  "التخصص": string;
  "الفئة": string;
  "المنطقة": string;
  "الموقع الجغرافي": string;
  "العنوان": string;
  "أقرب صيدلية": string;
  "المندوب": string;
  "وقت الزيارة": string;
  "حالة التحقق": string;
  "خط عرض موقع الزيارة": string;
  "خط طول موقع الزيارة": string;
  "خط عرض الجهة": string;
  "خط طول الجهة": string;
  "الأصناف المزارة": string;
  "الملاحظات": string;
};

function regionLabel(region?: string, fallback?: string) {
  if (region === "north") return "شمال صنعاء";
  if (region === "south") return "جنوب صنعاء";
  return fallback || "صنعاء";
}

function statusLabel(status?: string) {
  if (status === "verified") return "مقبولة";
  if (status === "rejected") return "مرفوضة";
  if (status === "override") return "مقبولة بتجاوز المدير";
  return "بانتظار التحقق";
}

export function buildVisitExportRows(visits: Visit[], representatives: Representative[]): VisitExportRow[] {
  return visits.map((visit) => {
    const representative = representatives.find((item) => item.id === visit.representativeId)?.name ?? "غير محدد";
    return {
      "اسم الطبيب": visit.entityName,
      "نوع الجهة": visit.entityKind,
      "التخصص": visit.specialty || "",
      "الفئة": visit.category || "",
      "المنطقة": regionLabel(visit.entityRegion, visit.geographicLocation),
      "الموقع الجغرافي": visit.geographicLocation || "",
      "العنوان": visit.entityAddress || "",
      "أقرب صيدلية": visit.nearestPharmacy || "",
      "المندوب": representative,
      "وقت الزيارة": visit.recordedAt,
      "حالة التحقق": statusLabel(visit.verificationStatus),
      "خط عرض موقع الزيارة": visit.location ? String(visit.location.latitude) : "",
      "خط طول موقع الزيارة": visit.location ? String(visit.location.longitude) : "",
      "خط عرض الجهة": visit.geographicCoordinates ? String(visit.geographicCoordinates.latitude) : "",
      "خط طول الجهة": visit.geographicCoordinates ? String(visit.geographicCoordinates.longitude) : "",
      "الأصناف المزارة": visit.visitedItems?.join("، ") || "",
      "الملاحظات": visit.notes || "",
    };
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function buildVisitsCsv(rows: VisitExportRow[]) {
  const headers = Object.keys(rows[0] ?? {
    "اسم الطبيب": "",
    "نوع الجهة": "",
    "التخصص": "",
    "الفئة": "",
    "المنطقة": "",
    "الموقع الجغرافي": "",
    "العنوان": "",
    "أقرب صيدلية": "",
    "المندوب": "",
    "وقت الزيارة": "",
    "حالة التحقق": "",
    "خط عرض موقع الزيارة": "",
    "خط طول موقع الزيارة": "",
    "خط عرض الجهة": "",
    "خط طول الجهة": "",
    "الأصناف المزارة": "",
    "الملاحظات": "",
  });
  return `\uFEFF${headers.map(csvCell).join(",")}\n${rows.map((row) => headers.map((header) => csvCell(String(row[header as keyof VisitExportRow] ?? ""))).join(",")).join("\n")}`;
}

export function buildVisitsExcelBase64(rows: VisitExportRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] ?? {}).map((key) => ({ wch: Math.max(16, Math.min(32, key.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الزيارات");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}
