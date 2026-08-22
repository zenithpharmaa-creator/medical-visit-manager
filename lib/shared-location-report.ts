import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as XLSX from "xlsx";

import { buildSharedLocationReportPdfHtml, buildSharedLocationReportRows, type SharedLocationReportRow } from "./shared-location-report-format";
import type { SharedLocation } from "@/shared/visit-types";

export { buildSharedLocationReportPdfHtml, buildSharedLocationReportRows } from "./shared-location-report-format";
export type { SharedLocationReportRow } from "./shared-location-report-format";

export async function createSharedLocationExcelFile(location: SharedLocation, rows: SharedLocationReportRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] ?? {}).map((key) => ({ wch: Math.max(16, Math.min(32, key.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "الجهات المرتبطة");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين الهاتف");
  const uri = `${directory}تقرير-الجهات-${location.id}-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function createSharedLocationPdfFile(location: SharedLocation, rows: SharedLocationReportRow[]) {
  const result = await Print.printToFileAsync({ html: buildSharedLocationReportPdfHtml(location, rows) });
  return result.uri;
}
