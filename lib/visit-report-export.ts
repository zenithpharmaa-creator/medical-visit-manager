import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

export { buildDailyVisitPdfHtml } from "./visit-report-format";
export type { DailyVisitReportRow } from "./visit-report-format";
import { type DailyVisitReportRow } from "./visit-report-format";

function createReportSerial() {
  const stamp = new Date();
  const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  return `MV-${datePart}-${String(Date.now()).slice(-6)}`;
}

function formatDateArabic(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-YE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export async function createDailyVisitExcelFile(rows: DailyVisitReportRow[], reportDate: string, reportSerial = createReportSerial()) {
  const worksheetRows = rows.map((row) => ({
    "الطبيب": row.entityName,
    "التصنيف": row.category || "",
    "التخصص": row.specialty || "",
    "عنوان الطبيب": row.entityAddress || "",
    "أقرب صيدلية": row.nearestPharmacy || "",
    "الفترة": row.shift,
    "الأصناف المزارة": row.visitedItems,
    "ملاحظات الزيارة": row.notes || "",
    "تاريخ التقرير": formatDateArabic(reportDate),
    "الرقم التسلسلي": reportSerial,
  }));
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
  worksheet["!cols"] = Object.keys(worksheetRows[0] ?? { "الطبيب": "" }).map((key) => ({ wch: Math.max(14, Math.min(32, key.length + 6)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الزيارات");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين الهاتف");
  const uri = `${directory}تقرير-زيارات-${reportSerial}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
