import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const PERMISSION_KEY = "medical-visit-manager-sync-notification-permission-v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensurePermission() {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("sync-status", {
      name: "حالة المزامنة",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#1257A6",
    });
  }
  const cached = await AsyncStorage.getItem(PERMISSION_KEY);
  if (cached === "granted") return true;
  const current = await Notifications.getPermissionsAsync();
  const result = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (result.status === "granted") await AsyncStorage.setItem(PERMISSION_KEY, "granted");
  return result.status === "granted";
}

export async function notifySyncStatus(input: { success: boolean; pushed: number; pulled: number; conflicts?: number; message?: string }) {
  try {
    if (!(await ensurePermission())) return;
    const hasConflicts = Boolean(input.conflicts);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: hasConflicts ? "مزامنة تحتاج مراجعة" : input.success ? "اكتملت المزامنة" : "تعذر إكمال المزامنة",
        body: input.message ?? (hasConflicts ? `${input.conflicts} تعارض يحتاج قراراً من شاشة سجل المزامنة.` : input.success ? `تم رفع ${input.pushed} وسحب ${input.pulled} تغيير.` : "تحقق من الاتصال وحاول المزامنة مرة أخرى."),
        data: { screen: "/(tabs)/sync-history" },
      },
      trigger: null,
    });
  } catch {
    // لا تُعطل المزامنة إذا كانت الإشعارات مرفوضة أو غير مدعومة.
  }
}
