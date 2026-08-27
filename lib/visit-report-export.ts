import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as XLSX from "xlsx";

export { buildDailyVisitPdfHtml, buildDailyVisitExcelRows, formatDateArabic, formatDayArabic } from "./visit-report-format";
export type { DailyVisitReportRow, DailyVisitReportHeader } from "./visit-report-format";
import { buildDailyVisitExcelRows, buildDailyVisitPdfHtml, type DailyVisitReportRow } from "./visit-report-format";


async function writeTextFile(fileName: string, contents: string) {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين الهاتف");
  const uri = `${directory}${fileName}-${Date.now()}`;
  await FileSystem.writeAsStringAsync(uri, contents, { encoding: FileSystem.EncodingType.UTF8 });
  return uri;
}

export async function createDailyVisitPdfFile(rows: DailyVisitReportRow[], reportDate: string) {
  const result = await Print.printToFileAsync({
    html: buildDailyVisitPdfHtml(rows, reportDate, "مدير الزيارات الطبية"),
    width: 1123,
    height: 794,
    margins: { left: 28, right: 28, top: 28, bottom: 34 },
  });
  return result.uri;
}

export async function createDailyVisitCsvFile(rows: DailyVisitReportRow[], reportDate: string) {
  const report = buildDailyVisitExcelRows(rows, reportDate, "مدير الزيارات الطبية");
  const csvRows = [
    [report.appName],
    [report.header.reportName],
    ["اليوم", report.header.dayName, "التاريخ", report.header.date, "المندوب", report.header.representativeNames],
    [],
    report.columns,
    ...report.body,
    [],
    ["إجمالي الزيارات", "", "", "", "", `صباح: ${report.summary.morning}`, `مساء: ${report.summary.evening}`, `الكل: ${report.summary.total}`],
  ];
  const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return writeTextFile("تقرير-زيارات.csv", `\uFEFF${csvRows.map((row) => row.map(escapeCell).join(",")).join("\n")}`);
}

export async function createDailyVisitHtmlFile(rows: DailyVisitReportRow[], reportDate: string) {
  return writeTextFile("تقرير-زيارات.html", buildDailyVisitPdfHtml(rows, reportDate, "مدير الزيارات الطبية"));
}

export async function createDailyVisitExcelFile(rows: DailyVisitReportRow[], reportDate: string) {
  const report = buildDailyVisitExcelRows(rows, reportDate, "مدير الزيارات الطبية");
  const worksheetRows = [
    [report.appName],
    [report.header.reportName],
    ["اليوم", report.header.dayName, "التاريخ", report.header.date, "المندوب", report.header.representativeNames],
    [],
    report.columns,
    ...report.body,
    [],
    ["إجمالي الزيارات", "", "", "", "", `صباح: ${report.summary.morning}`, `مساء: ${report.summary.evening}`, `الكل: ${report.summary.total}`],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
  worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }];
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 28 },
    { wch: 24 }, { wch: 14 }, { wch: 30 }, { wch: 34 },
  ];
  worksheet["A1"].s = { font: { bold: true, sz: 15, color: { rgb: "183B63" } }, alignment: { horizontal: "center" } };
  worksheet["A2"].s = { font: { bold: true, sz: 13, color: { rgb: "172B4D" } }, alignment: { horizontal: "center" } };
  for (let column = 0; column < report.columns.length; column += 1) {
    const cell = XLSX.utils.encode_cell({ r: 4, c: column });
    worksheet[cell].s = { font: { bold: true, color: { rgb: "172B4D" } }, fill: { fgColor: { rgb: "E5E8EB" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
  }
  const totalRowIndex = 6 + report.body.length;
  for (let column = 0; column < report.columns.length; column += 1) {
    const cell = XLSX.utils.encode_cell({ r: totalRowIndex, c: column });
    worksheet[cell].s = { font: { bold: true, color: { rgb: "123B68" } }, fill: { fgColor: { rgb: "DBEAFE" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
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
