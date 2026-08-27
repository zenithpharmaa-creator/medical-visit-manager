import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

export { buildDailyVisitPdfHtml, buildDailyVisitExcelRows, formatDateArabic, formatDayArabic } from "./visit-report-format";
export type { DailyVisitReportRow, DailyVisitReportHeader } from "./visit-report-format";
import { buildDailyVisitExcelRows, type DailyVisitReportRow } from "./visit-report-format";


export async function createDailyVisitExcelFile(rows: DailyVisitReportRow[], reportDate: string) {
  const report = buildDailyVisitExcelRows(rows, reportDate, "مدير الزيارات الطبية");
  const worksheetRows = [
    [report.appName],
    [report.header.reportName],
    ["اليوم", report.header.dayName, "التاريخ", report.header.date, "المندوب", report.header.representativeNames],
    [],
    report.columns,
    ...report.body,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
  worksheet["!cols"] = report.columns.map((column) => ({ wch: Math.max(14, Math.min(32, column.length + 6)) }));
  worksheet["A1"].s = { font: { bold: true, sz: 15, color: { rgb: "183B63" } }, alignment: { horizontal: "center" } };
  worksheet["A2"].s = { font: { bold: true, sz: 13, color: { rgb: "172B4D" } }, alignment: { horizontal: "center" } };
  for (let column = 0; column < report.columns.length; column += 1) {
    const cell = XLSX.utils.encode_cell({ r: 4, c: column });
    worksheet[cell].s = { font: { bold: true, color: { rgb: "172B4D" } }, fill: { fgColor: { rgb: "E5E8EB" } }, alignment: { horizontal: "center" } };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الزيارات");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين الهاتف");
  const uri = `${directory}تقرير-زيارات.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
