import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const NOTIFIED_PREFIX = "medical-visit-manager-empty-day-notified-v1";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

type EmptyDayCandidate = { representativeId: string; date: string };
type RepresentativeLabel = { id: string; name: string };

export async function notifyManagerOfEmptyDays(candidates: EmptyDayCandidate[], representatives: RepresentativeLabel[]) {
  if (Platform.OS === "web" || candidates.length === 0) return;
  try {
    await Notifications.setNotificationChannelAsync("empty-days", { name: "مراجعة الأيام الخالية", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 220, 120, 220] });
    const permissions = await Notifications.getPermissionsAsync();
    const finalStatus = permissions.status === "granted" ? permissions.status : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== "granted") return;
    const keys = candidates.map((candidate) => `${NOTIFIED_PREFIX}:${candidate.representativeId}:${candidate.date}`);
    const existing = await AsyncStorage.multiGet(keys);
    const known = new Set(existing.filter(([, value]) => value === "1").map(([key]) => key));
    const fresh = candidates.filter((candidate) => !known.has(`${NOTIFIED_PREFIX}:${candidate.representativeId}:${candidate.date}`));
    if (!fresh.length) return;
    const first = fresh[0];
    const representativeName = representatives.find((item) => item.id === first.representativeId)?.name ?? "مندوب";
    await Notifications.scheduleNotificationAsync({ content: { title: "أيام بلا زيارات تحتاج قراراً", body: fresh.length === 1 ? `${representativeName} لديه يوم ${first.date} بلا زيارة مسجلة. اختر إجازة أو استثناء من شاشة إدارة الإجازات.` : `يوجد ${fresh.length} أيام بلا زيارات مسجلة وتحتاج قراراً من المدير.`, data: { url: "/representative-leaves", type: "empty-day-review" } }, trigger: null });
    await AsyncStorage.multiSet(fresh.map((candidate) => [`${NOTIFIED_PREFIX}:${candidate.representativeId}:${candidate.date}`, "1"]));
  } catch {
    // لا يمنع فشل الإشعار عرض الأيام المعلقة أو حفظ القرار.
  }
}
