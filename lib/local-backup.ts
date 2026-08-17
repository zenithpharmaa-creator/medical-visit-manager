import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as MailComposer from "expo-mail-composer";

import type { AppData } from "@/shared/visit-types";

export const LOCAL_BACKUP_META_KEY = "medical-visit-manager-local-backup-meta-v1";
export const BACKUP_RECIPIENT = "nagibrasea@gmail.com";

export type BackupMeta = { dateKey: string; createdAt: string; uri: string; size: number };

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getLocalBackupMeta(): Promise<BackupMeta | null> {
  const saved = await AsyncStorage.getItem(LOCAL_BACKUP_META_KEY);
  if (!saved) return null;
  try { return JSON.parse(saved) as BackupMeta; } catch { return null; }
}

export async function createLocalBackup(data: AppData): Promise<BackupMeta> {
  const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!directory) throw new Error("تعذر الوصول إلى مساحة تخزين التطبيق");
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({ backupVersion: 1, createdAt, app: "مدير الزيارات الطبية", data }, null, 2);
  const uri = `${directory}medical-visit-manager-backup-${createdAt.replace(/[:.]/g, "-")}.json`;
  await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
  const meta: BackupMeta = { dateKey: localDateKey(), createdAt, uri, size: payload.length };
  await AsyncStorage.setItem(LOCAL_BACKUP_META_KEY, JSON.stringify(meta));
  return meta;
}

export async function ensureDailyLocalBackup(data: AppData): Promise<BackupMeta> {
  const existing = await getLocalBackupMeta();
  if (existing?.dateKey === localDateKey()) {
    const info = await FileSystem.getInfoAsync(existing.uri);
    if (info.exists) return existing;
  }
  return createLocalBackup(data);
}

export async function composeBackupEmail(uri: string, createdAt: string) {
  if (!(await MailComposer.isAvailableAsync())) throw new Error("لا يوجد تطبيق بريد مهيأ على الجهاز");
  return MailComposer.composeAsync({
    recipients: [BACKUP_RECIPIENT],
    subject: `نسخة احتياطية لمدير الزيارات الطبية — ${new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(new Date(createdAt))}`,
    body: "مرفق النسخة الاحتياطية المحلية لبيانات مدير الزيارات الطبية. يرجى حفظ المرفق في مكان آمن.",
    attachments: [uri],
  });
}
