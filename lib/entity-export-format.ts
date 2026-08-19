import type { MedicalEntity } from "@/shared/visit-types";

export type EntityExportRow = {
  "اسم الطبيب": string;
  "نوع الجهة": string;
  "التخصص": string;
  "الفئة": string;
  "المنطقة": string;
  "الموقع الجغرافي": string;
  "العنوان": string;
  "أقرب صيدلية": string;
  "المسؤول أو الهاتف": string;
  "خط العرض": string;
  "خط الطول": string;
  "الملاحظات": string;
};

function regionLabel(region?: MedicalEntity["region"]) {
  if (region === "north") return "شمال صنعاء";
  if (region === "south") return "جنوب صنعاء";
  return "صنعاء";
}

export function buildEntityExportRows(entities: MedicalEntity[]): EntityExportRow[] {
  return entities.map((entity) => ({
    "اسم الطبيب": entity.name,
    "نوع الجهة": entity.kind,
    "التخصص": entity.specialty ?? "",
    "الفئة": entity.category ?? "",
    "المنطقة": regionLabel(entity.region),
    "الموقع الجغرافي": entity.geographicLocation ?? "",
    "العنوان": entity.address ?? "",
    "أقرب صيدلية": entity.nearestPharmacy ?? "",
    "المسؤول أو الهاتف": entity.contactName ?? "",
    "خط العرض": entity.geographicCoordinates ? String(entity.geographicCoordinates.latitude) : "",
    "خط الطول": entity.geographicCoordinates ? String(entity.geographicCoordinates.longitude) : "",
    "الملاحظات": entity.notes ?? "",
  }));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

export function buildEntitiesPdfHtml(rows: EntityExportRow[]) {
  const headers = Object.keys(rows[0] ?? {
    "اسم الطبيب": "", "نوع الجهة": "", "التخصص": "", "الفئة": "", "المنطقة": "",
    "الموقع الجغرافي": "", "العنوان": "", "أقرب صيدلية": "", "المسؤول أو الهاتف": "",
    "خط العرض": "", "خط الطول": "", "الملاحظات": "",
  });
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header as keyof EntityExportRow] ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page { size: A4 landscape; margin: 12mm; } body { font-family: Arial, sans-serif; color: #102A43; direction: rtl; } h1 { text-align: center; color: #1565C0; margin: 0 0 6px; font-size: 20px; } .meta { text-align: center; color: #52606D; margin-bottom: 12px; font-size: 11px; } table { border-collapse: collapse; width: 100%; font-size: 8px; } th { background: #1565C0; color: #fff; padding: 5px 3px; border: 1px solid #0D47A1; } td { padding: 4px 3px; border: 1px solid #CBD5E1; vertical-align: top; } tr:nth-child(even) { background: #F5F9FC; }</style></head><body><h1>سجل جهات الزيارة</h1><div class="meta">عدد الجهات: ${rows.length} · تاريخ التصدير: ${new Date().toLocaleString("ar-YE")}</div><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
}
