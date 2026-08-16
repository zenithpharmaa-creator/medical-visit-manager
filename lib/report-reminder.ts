import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function scheduleReportReminder(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("وقت غير صالح");
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-report", {
      name: "تذكير التقرير اليومي",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: "#1565C0",
    });
  }
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.status !== "granted") throw new Error("إذن التنبيه غير متاح");
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "تقرير الزيارات جاهز للإرسال",
      body: "افتح تطبيق مدير الزيارات الطبية لإرسال تقرير اليوم بالبريد.",
      data: { screen: "reports" },
      ...(Platform.OS === "android" ? { channelId: "daily-report" } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}
