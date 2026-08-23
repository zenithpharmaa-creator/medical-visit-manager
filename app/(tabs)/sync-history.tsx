import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useVisitStore } from "@/lib/visit-store";
import type { SyncLogEntry } from "@/shared/visit-types";

const statusMeta: Record<SyncLogEntry["status"], { label: string; color: string; icon: "check-circle" | "error" | "compare-arrows" | "cloud-off" | "info" }> = {
  success: { label: "نجاح", color: "#16835B", icon: "check-circle" },
  error: { label: "فشل", color: "#C0392B", icon: "error" },
  conflict: { label: "تعارض", color: "#B45309", icon: "compare-arrows" },
  offline: { label: "دون اتصال", color: "#64748B", icon: "cloud-off" },
  skipped: { label: "تم التخطي", color: "#64748B", icon: "info" },
};

export default function SyncHistoryScreen() {
  const { data } = useVisitStore();
  const history = data.syncHistory ?? [];
  const conflicts = data.syncConflicts ?? [];
  const pending = conflicts.filter((item) => item.status === "pending").length;
  return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="pt-[18px] flex-1"><ScreenHeader title="سجل المزامنة" subtitle="متابعة عمليات الدفع والسحب والتعارضات" icon="history" /><View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-center gap-3"><MaterialIcons name="info-outline" size={22} color="#1257A6" /><Text className="flex-1 text-right text-primary text-sm leading-6">يُحفظ السجل على الجهاز حتى تتمكن من معرفة سبب الفشل أو مراجعة التعارضات السابقة دون اتصال.</Text></View>{pending ? <Pressable onPress={() => router.push("/(tabs)/visits" as never)} className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-4 flex-row-reverse items-center gap-3"><MaterialIcons name="warning" size={22} color="#B45309" /><Text className="flex-1 text-right text-warning font-bold">{pending} تعارض بانتظار المراجعة — افتح سجل الزيارات لاتخاذ القرار.</Text><MaterialIcons name="chevron-left" size={22} color="#B45309" /></Pressable> : null}<FlatList data={history} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 32, gap: 10, flexGrow: history.length ? 0 : 1 }} ListEmptyComponent={<View className="flex-1 items-center justify-center rounded-2xl bg-surface border border-border p-8"><MaterialIcons name="history" size={38} color="#64748B" /><Text className="font-bold text-foreground mt-3">لا توجد عمليات مسجلة بعد</Text><Text className="text-sm text-muted text-center mt-1">ستظهر هنا نتيجة أول محاولة مزامنة تلقائية أو يدوية.</Text></View>} renderItem={({ item }) => { const meta = statusMeta[item.status]; return <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${meta.color}18` }}><MaterialIcons name={meta.icon} size={22} color={meta.color} /></View><View className="flex-1 items-end"><View className="flex-row-reverse items-center gap-2"><Text className="font-bold text-foreground">{meta.label}</Text><Text className="text-xs text-muted">{new Date(item.completedAt).toLocaleString("ar-YE")}</Text></View><Text className="text-xs text-muted text-right mt-1 leading-5">{item.message}</Text></View></View><View className="flex-row-reverse gap-2 mt-3"><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">مرفوع</Text><Text className="font-bold text-primary text-right mt-1">{item.pushed}</Text></View><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">مسحوب</Text><Text className="font-bold text-primary text-right mt-1">{item.pulled}</Text></View><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">تعارضات</Text><Text className="font-bold text-warning text-right mt-1">{item.conflicts}</Text></View></View></View>; }} /></View></ScreenContainer>;
}
