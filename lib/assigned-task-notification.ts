import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { PlannedVisit, Representative } from "@/shared/visit-types";

export async function notifyRepresentativeOfAssignment(task: PlannedVisit, representative: Representative): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("assigned-tasks", { name: "المهام المسندة", importance: Notifications.AndroidImportance.HIGH });
    }
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      if (requested.status !== "granted") return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "مهمة زيارة جديدة",
        body: `تم إسناد زيارة ${task.entityName} إلى ${representative.name} بتاريخ ${task.scheduledDate}.`,
        data: { taskId: task.id, url: "/tasks" },
      },
      trigger: null,
    });
    return true;
  } catch {
    // لا يمنع فشل الإشعار حفظ المهمة محلياً.
    return false;
  }
}
