export type DownloadableReportFormat = "pdf" | "xlsx" | "csv" | "html";

export const REPORT_DOWNLOAD_META: Record<DownloadableReportFormat, { fileName: string; mimeType: string }> = {
  pdf: { fileName: "تقرير-الزيارات.pdf", mimeType: "application/pdf" },
  xlsx: { fileName: "تقرير-الزيارات.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { fileName: "تقرير-الزيارات.csv", mimeType: "text/csv" },
  html: { fileName: "تقرير-الزيارات.html", mimeType: "text/html" },
};

export function getReportDownloadMeta(format: DownloadableReportFormat) {
  return REPORT_DOWNLOAD_META[format];
}

export function getReportDownloadBaseName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}
