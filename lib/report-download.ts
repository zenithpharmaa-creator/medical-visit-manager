import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { getReportDownloadBaseName, getReportDownloadMeta, type DownloadableReportFormat } from "./report-download-utils";

const DOWNLOAD_DIRECTORY_KEY = "medical-visit-manager:report-download-directory";

type DownloadResult = {
  mode: "download" | "share";
  message: string;
  uri?: string;
};

function timestampedFileName(format: DownloadableReportFormat) {
  const meta = getReportDownloadMeta(format);
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${getReportDownloadBaseName(meta.fileName)}-${stamp}.${meta.fileName.split(".").pop()}`;
}

async function downloadOnWeb(uri: string, format: DownloadableReportFormat): Promise<DownloadResult> {
  if (typeof document === "undefined") throw new Error("التنزيل المباشر غير متاح في هذه البيئة.");
  const meta = getReportDownloadMeta(format);
  const link = document.createElement("a");
  link.href = uri;
  link.download = meta.fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { mode: "download", message: `بدأ تنزيل ملف ${meta.fileName}.`, uri };
}

async function getAndroidDownloadDirectory() {
  const savedDirectory = await AsyncStorage.getItem(DOWNLOAD_DIRECTORY_KEY);
  if (savedDirectory) return savedDirectory;
  const suggestedDirectory = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(suggestedDirectory);
  if (!permission.granted) throw new Error("تم إلغاء اختيار مجلد التنزيل. اختر مجلد Download للمتابعة.");
  await AsyncStorage.setItem(DOWNLOAD_DIRECTORY_KEY, permission.directoryUri);
  return permission.directoryUri;
}

async function downloadOnAndroid(uri: string, format: DownloadableReportFormat): Promise<DownloadResult> {
  const meta = getReportDownloadMeta(format);
  const directoryUri = await getAndroidDownloadDirectory();
  const contents = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  try {
    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, timestampedFileName(format), meta.mimeType);
    await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, contents, { encoding: FileSystem.EncodingType.Base64 });
    return { mode: "download", message: `تم تنزيل ملف ${meta.fileName} داخل مجلد Download.`, uri: targetUri };
  } catch (error) {
    await AsyncStorage.removeItem(DOWNLOAD_DIRECTORY_KEY);
    throw error;
  }
}

export async function downloadReportFile(uri: string, format: DownloadableReportFormat): Promise<DownloadResult> {
  if (Platform.OS === "web") return downloadOnWeb(uri, format);
  if (Platform.OS === "android") return downloadOnAndroid(uri, format);
  if (!(await Sharing.isAvailableAsync())) throw new Error("التنزيل أو المشاركة غير متاحين على هذا الجهاز.");
  await Sharing.shareAsync(uri, { mimeType: getReportDownloadMeta(format).mimeType, dialogTitle: "حفظ أو مشاركة تقرير الزيارات" });
  return { mode: "share", message: "تم فتح نافذة الحفظ أو المشاركة على هذا الجهاز.", uri };
}
