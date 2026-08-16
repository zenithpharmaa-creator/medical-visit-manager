import * as MailComposer from "expo-mail-composer";
import * as Notifications from "expo-notifications";

import type { AppSettings, Visit } from "@/shared/visit-types";

export async function notifyManagerOfOverride({ settings, visit, representativeName }: { settings: AppSettings; visit: Visit; representativeName: string }) {
  const body = `تم تسجيل تجاوز جغرافي للطبيب ${visit.entityName} بواسطة ${representativeName}. السبب: ${visit.overrideReason ?? "غير مسجل"}`;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title: "تنبيه تجاوز الموقع", body, data: { visitId: visit.id } }, trigger: null });
  } catch {
    // يظل تسجيل الزيارة ناجحاً حتى إذا لم يكن إذن الإشعارات مفعلاً.
  }
  if (settings.reportEmail && await MailComposer.isAvailableAsync()) {
    await MailComposer.composeAsync({ recipients: [settings.reportEmail], subject: "تنبيه تجاوز شرط الموقع", body });
  }
}
