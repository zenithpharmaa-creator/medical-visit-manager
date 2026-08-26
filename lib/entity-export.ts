import * as FileSystem from "expo-file-system/legacy";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

export { buildEntityExportRows, buildEntitiesPdfHtml } from "./entity-export-format";
import { buildEntitiesPdfHtml, buildEntityExportRows, type EntityExportRow } from "./entity-export-format";

export async function createEntitiesExcelFile(rows: EntityExportRow[], filePrefix = "جهات-الزيارة") {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] ?? {}).map((key) => ({ wch: Math.max(16, Math.min(32, key.length + 4)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "جهات الزيارة");
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين الهاتف");
  const uri = `${directory}${filePrefix}-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function createEntitiesPdfFile(rows: EntityExportRow[]) {
  const result = await Print.printToFileAsync({ html: buildEntitiesPdfHtml(rows) });
  return result.uri;
}

export async function shareOrDownloadFile(uri: string, mimeType: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("المشاركة غير متاحة على هذا الجهاز");
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: "مشاركة أو تحميل سجل جهات الزيارة" });
}

export async function emailEntitiesFile(uri: string) {
  if (!(await MailComposer.isAvailableAsync())) throw new Error("البريد الإلكتروني غير متاح على هذا الجهاز");
  await MailComposer.composeAsync({
    subject: "سجل جهات الزيارة الطبية",
    body: "مرفق سجل جهات الزيارة المصدّر من برنامج مدير الزيارات الطبية.",
    attachments: [uri],
    recipients: [],
  });
}
