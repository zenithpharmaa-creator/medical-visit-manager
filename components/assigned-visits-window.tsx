import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";

export function AssignedVisitsWindow() {
  const { data } = useVisitStore();
  const { session } = useAccountSession();
  const [visible, setVisible] = useState(false);
  const isManager = session?.role === "manager";
  const assignedVisits = useMemo(() => data.plannedVisits
    .filter((plan) => plan.assignmentType === "assigned" && (isManager || plan.representativeId === session?.representativeId))
    .filter((plan) => plan.taskStatus !== "rejected" && plan.planStatus !== "cancelled")
    .sort((a, b) => (b.scheduledTime ?? b.scheduledDate).localeCompare(a.scheduledTime ?? a.scheduledDate)), [data.plannedVisits, isManager, session?.representativeId]);
  const statusText = (status?: string) => status === "accepted" ? "مقبولة" : status === "completed" ? "منفذة" : "جديدة";
  const statusColor = (status?: string) => status === "completed" ? "#16835B" : status === "accepted" ? "#1565C0" : "#B45309";

  return <>
    <Pressable onPress={() => setVisible(true)} className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-4 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <View className="w-11 h-11 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="assignment-ind" size={23} color="#FFFFFF" /></View>
      <View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">الزيارات المسندة من المدير</Text><Text className="text-xs text-muted text-right mt-1">{assignedVisits.length ? `${assignedVisits.length} مهمة ظاهرة · اضغط للعرض والتفاصيل` : "لا توجد زيارات مسندة حالياً"}</Text></View>
      <View className="rounded-full bg-warning px-3 py-1.5"><Text className="text-white font-bold">{assignedVisits.length}</Text></View>
      <MaterialIcons name="chevron-left" size={22} color="#B45309" />
    </Pressable>
    <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
      <View className="flex-1 bg-background">
        <View className="px-5 pt-5 pb-4 border-b border-border flex-row-reverse items-center justify-between"><Pressable onPress={() => setVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-xl font-bold text-foreground text-right">الزيارات المسندة</Text><Text className="text-xs text-muted text-right mt-1">{isManager ? "جميع الزيارات التي أسندها مدير النظام" : "الزيارات المسندة إلى حسابك"}</Text></View><MaterialIcons name="assignment-ind" size={25} color="#B45309" /></View>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36 }}>
          {assignedVisits.length ? assignedVisits.map((plan) => <View key={plan.id} className="rounded-2xl bg-[#FFF8E7] border-2 border-[#F59E0B] p-4 mb-3"><View className="flex-row-reverse items-start gap-3"><View className="w-11 h-11 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="assignment" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{plan.entityName}</Text><Text className="text-xs text-primary text-right mt-1">{plan.entityKind}{isManager ? ` · ${data.representatives.find((rep) => rep.id === plan.representativeId)?.name ?? "مندوب"}` : ""}</Text><Text className="text-xs text-muted text-right mt-1">{plan.scheduledDate} · {plan.shift === "morning" ? "صباحية 08:00–13:00" : "مسائية 16:00–20:00"}</Text>{plan.scheduledTime ? <Text className="text-xs text-muted text-right mt-1">وقت الإسناد/الجدولة: {formatArabicDate(plan.scheduledTime)}</Text> : null}</View></View><View className="rounded-xl bg-white/70 px-3 py-2 mt-3 flex-row-reverse items-center gap-2"><MaterialIcons name="verified" size={17} color={statusColor(plan.taskStatus)} /><Text className="font-bold text-xs" style={{ color: statusColor(plan.taskStatus) }}>{statusText(plan.taskStatus)}</Text><Text className="text-xs text-muted flex-1 text-right">مسندة من مدير النظام</Text></View></View>) : <View className="rounded-2xl bg-surface border border-border p-8 items-center"><MaterialIcons name="assignment-turned-in" size={38} color="#64748B" /><Text className="font-bold text-foreground mt-3">لا توجد زيارات مسندة</Text><Text className="text-sm text-muted text-center mt-1">ستظهر هنا أي زيارة جديدة يسندها مدير النظام.</Text></View>}
        </ScrollView>
      </View>
    </Modal>
  </>;
}
