import type { MedicalEntity, SharedLocation } from "@/shared/visit-types";

export type SharedLocationReportRow = {
  "الموقع المشترك": string;
  "اسم الجهة": string;
  "نوع الجهة": string;
  "المنطقة": string;
  "العنوان": string;
  "التخصص": string;
  "الهاتف أو المسؤول": string;
  "خط العرض": string;
  "خط الطول": string;
};

function regionLabel(region?: MedicalEntity["region"]) {
  if (region === "north") return "شمال صنعاء";
  if (region === "south") return "جنوب صنعاء";
  return "صنعاء";
}

export function buildSharedLocationReportRows(location: SharedLocation, entities: MedicalEntity[]): SharedLocationReportRow[] {
  return entities.map((entity) => ({
    "الموقع المشترك": location.name,
    "اسم الجهة": entity.name,
    "نوع الجهة": entity.kind,
    "المنطقة": regionLabel(entity.region),
    "العنوان": entity.address ?? "",
    "التخصص": entity.specialty ?? "",
    "الهاتف أو المسؤول": entity.contactName ?? "",
    "خط العرض": entity.geographicCoordinates ? String(entity.geographicCoordinates.latitude) : "",
    "خط الطول": entity.geographicCoordinates ? String(entity.geographicCoordinates.longitude) : "",
  }));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildSharedLocationReportPdfHtml(location: SharedLocation, rows: SharedLocationReportRow[]) {
  const headers = Object.keys(rows[0] ?? {
    "الموقع المشترك": "", "اسم الجهة": "", "نوع الجهة": "", "المنطقة": "", "العنوان": "", "التخصص": "", "الهاتف أو المسؤول": "", "خط العرض": "", "خط الطول": "",
  });
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header as keyof SharedLocationReportRow] ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page { size: A4 landscape; margin: 12mm; } body { font-family: Arial, sans-serif; color: #102A43; direction: rtl; } h1 { text-align: center; color: #1565C0; margin: 0 0 5px; font-size: 20px; } .meta { text-align: center; color: #52606D; margin-bottom: 12px; font-size: 11px; } table { border-collapse: collapse; width: 100%; font-size: 9px; } th { background: #1565C0; color: #fff; padding: 6px 4px; border: 1px solid #0D47A1; } td { padding: 5px 4px; border: 1px solid #CBD5E1; vertical-align: top; } tr:nth-child(even) { background: #F5F9FC; }</style></head><body><h1>تقرير الجهات المرتبطة بالموقع</h1><div class="meta">${escapeHtml(location.name)} · عدد الجهات: ${rows.length} · تاريخ التصدير: ${escapeHtml(new Date().toLocaleString("ar-YE"))}</div><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
}
