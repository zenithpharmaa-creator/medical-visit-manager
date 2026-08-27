import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useAccountSession } from "@/lib/account-session";
import { notifySyncStatus } from "@/lib/sync-notifications";
import { useVisitStore } from "@/lib/visit-store";
import type { SyncConflict, SyncLogEntry } from "@/shared/visit-types";

const statusMeta: Record<SyncLogEntry["status"], { label: string; color: string; icon: "check-circle" | "error" | "compare-arrows" | "cloud-off" | "info" }> = {
  success: { label: "نجاح", color: "#16835B", icon: "check-circle" },
  error: { label: "فشل", color: "#C0392B", icon: "error" },
  conflict: { label: "تعارض", color: "#B45309", icon: "compare-arrows" },
  offline: { label: "دون اتصال", color: "#64748B", icon: "cloud-off" },
  skipped: { label: "تم التخطي", color: "#64748B", icon: "info" },
};

const recordLabel = (type: SyncConflict["recordType"]) => type === "entity" ? "جهة" : type === "visit" ? "زيارة" : type === "plannedVisit" ? "خطة" : "موقع مشترك";
const readablePayload = (payload: unknown) => {
  try { return JSON.stringify(payload, null, 2); } catch { return "تعذر عرض التفاصيل"; }
};

export default function SyncHistoryScreen() {
  const { data, resolveSyncConflict, recordNotificationTest } = useVisitStore();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const history = data.syncHistory ?? [];
  const pendingConflicts = (data.syncConflicts ?? []).filter((item) => item.status === "pending");
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [testingNotification, setTestingNotification] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SyncLogEntry["status"] | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7days">("all");
  const [sortNewest, setSortNewest] = useState(true);
  const [repFilter, setRepFilter] = useState("all");
  const filteredHistory = history.filter((item) => {
    const matchesQuery = !query.trim() || `${item.representativeName ?? ""} ${item.deviceId ?? ""} ${item.message}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesRepresentative = repFilter === "all" || item.representativeName === repFilter;
    const age = Date.now() - new Date(item.completedAt).getTime();
    const matchesDate = dateFilter === "all" || (dateFilter === "today" ? age < 24 * 60 * 60 * 1000 : age < 7 * 24 * 60 * 60 * 1000);
    return matchesQuery && matchesStatus && matchesDate && matchesRepresentative;
  }).sort((a, b) => sortNewest ? new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime() : new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const resolve = (choice: "local" | "server") => {
    if (!selectedConflict) return;
    const target = selectedConflict;
    if (!resolutionNote.trim()) {
      Alert.alert("الملاحظة مطلوبة", "اكتب سبب اعتماد النسخة المحلية أو نسخة الخادم قبل حفظ القرار.");
      return;
    }
    Alert.alert(
      choice === "local" ? "اعتماد النسخة المحلية" : "اعتماد نسخة الخادم",
      `سيتم اعتماد هذه النسخة للسجل ${target.recordId} وتسجيل القرار في سجل المزامنة.`,
      [
        { text: "مراجعة", style: "cancel" },
        { text: "تأكيد القرار", onPress: () => { resolveSyncConflict(target.id, choice, resolutionNote.trim()); setResolutionNote(""); setSelectedConflict(null); } },
      ],
    );
  };

  const testNotification = async () => {
    if (testingNotification) return;
    setTestingNotification(true);
    try {
      await notifySyncStatus({ success: true, pushed: 2, pulled: 3, message: "هذا إشعار اختبار من شاشة سجل المزامنة. إذا ظهر، فإشعارات الجهاز تعمل." });
      Alert.alert("هل ظهر الإشعار؟", "تحقق من شريط إشعارات Android وسجّل النتيجة على هذا الجهاز.", [{ text: "لم يظهر", style: "cancel", onPress: () => void recordNotificationTest("failed") }, { text: "ظهر بنجاح", onPress: () => void recordNotificationTest("passed") }]);
    } finally {
      setTestingNotification(false);
    }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="pt-[18px] flex-1">
        <ScreenHeader title="سجل المزامنة" subtitle="متابعة العمليات وحل التعارضات" icon="history" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-center gap-3">
          <MaterialIcons name="info-outline" size={22} color="#1257A6" />
          <Text className="flex-1 text-right text-primary text-sm leading-6">يُحفظ السجل على الجهاز. يستطيع المدير مقارنة النسختين قبل اعتماد أي قرار.</Text>
        </View>
        <View className="rounded-2xl bg-surface border border-border p-4 mb-4">
          <View className="flex-row-reverse items-center gap-2 mb-2"><MaterialIcons name="notifications-active" size={21} color="#1257A6" /><Text className="font-bold text-foreground flex-1 text-right">اختبار إشعار هذا الجهاز</Text></View>
          <Text className="text-xs text-muted text-right leading-5">اضغط لإرسال إشعار محلي فوري. يجب تنفيذ الاختبار على جهاز المدير وثلاثة أجهزة المندوبين.</Text>
          <Pressable disabled={testingNotification} onPress={() => void testNotification()} className="h-11 rounded-xl bg-primary mt-3 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: testingNotification ? 0.55 : pressed ? 0.8 : 1 }]}>
            <MaterialIcons name={testingNotification ? "hourglass-top" : "notifications"} size={18} color="#FFFFFF" />
            <Text className="text-white font-bold text-xs">{testingNotification ? "جارٍ الإرسال..." : "إرسال إشعار اختبار"}</Text>
          </Pressable>
          {(data.notificationTests ?? []).slice(0, 4).map((test) => <View key={`${test.deviceId}-${test.testedAt}`} className="flex-row-reverse items-center gap-2 mt-2"><MaterialIcons name={test.status === "passed" ? "check-circle" : "error"} size={16} color={test.status === "passed" ? "#16835B" : "#C0392B"} /><Text className="text-[10px] text-muted flex-1 text-right">{test.deviceLabel} · {new Date(test.testedAt).toLocaleString("ar-YE")} · {test.status === "passed" ? "ظهر الإشعار" : "لم يظهر الإشعار"}</Text></View> )}
        </View>
        {pendingConflicts.length > 0 ? (
          <View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-4">
            <View className="flex-row-reverse items-center gap-2 mb-2"><MaterialIcons name="compare-arrows" size={21} color="#B45309" /><Text className="font-bold text-foreground flex-1 text-right">تعارضات بانتظار القرار ({pendingConflicts.length})</Text></View>
            {!isManager ? <Text className="text-xs text-muted text-right mb-2">تظهر التفاصيل للمتابعة، ويقتصر اعتماد النسخ على مدير النظام.</Text> : null}
            {pendingConflicts.map((conflict) => (
              <Pressable key={conflict.id} disabled={!isManager} onPress={() => { setResolutionNote(conflict.resolutionNote ?? ""); setSelectedConflict(conflict); }} className="rounded-xl bg-background border border-warning/20 p-3 mb-2 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
                <View className="w-10 h-10 rounded-xl bg-warning/15 items-center justify-center"><MaterialIcons name="difference" size={20} color="#B45309" /></View>
                <View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{recordLabel(conflict.recordType)} · {conflict.recordId}</Text><Text className="text-xs text-muted text-right mt-1">إصدار الخادم: {conflict.serverVersion} · اضغط للمقارنة</Text></View>
                <MaterialIcons name={isManager ? "chevron-left" : "lock"} size={21} color="#B45309" />
              </Pressable>
            ))}
          </View>
        ) : null}
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32, gap: 10, flexGrow: history.length ? 0 : 1 }}
          ListHeaderComponent={<View className="mb-3"><TextInput value={query} onChangeText={setQuery} placeholder="بحث باسم المندوب أو الجهاز أو الرسالة" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-surface px-4 text-foreground mb-2" /><View className="flex-row-reverse gap-2 mb-2">{(["all", "success", "error", "conflict"] as const).map((value) => <Pressable key={value} onPress={() => setStatusFilter(value)} className={`flex-1 rounded-xl px-2 py-2 ${statusFilter === value ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-center text-xs font-bold ${statusFilter === value ? "text-white" : "text-foreground"}`}>{value === "all" ? "الكل" : statusMeta[value].label}</Text></Pressable>)}</View><View className="flex-row-reverse gap-2"><Pressable onPress={() => setRepFilter(repFilter === "all" ? (data.representatives[0]?.name ?? "all") : "all")} className={`flex-1 rounded-xl px-2 py-2 ${repFilter !== "all" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-center text-xs font-bold ${repFilter !== "all" ? "text-white" : "text-foreground"}`}>{repFilter === "all" ? "كل المندوبين" : repFilter}</Text></Pressable><Pressable onPress={() => setDateFilter(dateFilter === "today" ? "all" : "today")} className={`flex-1 rounded-xl px-2 py-2 ${dateFilter === "today" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-center text-xs font-bold ${dateFilter === "today" ? "text-white" : "text-foreground"}`}>اليوم</Text></Pressable><Pressable onPress={() => setDateFilter(dateFilter === "7days" ? "all" : "7days")} className={`flex-1 rounded-xl px-2 py-2 ${dateFilter === "7days" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-center text-xs font-bold ${dateFilter === "7days" ? "text-white" : "text-foreground"}`}>آخر 7 أيام</Text></Pressable><Pressable onPress={() => setSortNewest(!sortNewest)} className="flex-1 rounded-xl px-2 py-2 bg-surface border border-border"><Text className="text-center text-xs font-bold text-foreground">{sortNewest ? "الأحدث أولاً" : "الأقدم أولاً"}</Text></Pressable></View></View>} ListEmptyComponent={<View className="flex-1 items-center justify-center rounded-2xl bg-surface border border-border p-8"><MaterialIcons name="history" size={38} color="#64748B" /><Text className="font-bold text-foreground mt-3">لا توجد نتائج</Text><Text className="text-sm text-muted text-center mt-1">غيّر البحث أو الفلاتر، أو انتظر أول محاولة مزامنة.</Text></View>}
          renderItem={({ item }) => {
            const meta = statusMeta[item.status];
            return <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl items-center justify-center" style={{ backgroundColor: `${meta.color}18` }}><MaterialIcons name={meta.icon} size={22} color={meta.color} /></View><View className="flex-1 items-end"><View className="flex-row-reverse items-center gap-2"><Text className="font-bold text-foreground">{meta.label}</Text><Text className="text-xs text-muted">{new Date(item.completedAt).toLocaleString("ar-YE")}</Text></View><Text className="text-xs text-muted text-right mt-1 leading-5">{item.message}</Text>{item.representativeName ? <Text className="text-[10px] text-primary text-right mt-1">المندوب: {item.representativeName}</Text> : null}{item.resolutionNote ? <Text className="text-[10px] text-warning text-right mt-1">ملاحظة القرار: {item.resolutionNote}</Text> : null}</View></View><View className="flex-row-reverse gap-2 mt-3"><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">مرفوع</Text><Text className="font-bold text-primary text-right mt-1">{item.pushed}</Text></View><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">مسحوب</Text><Text className="font-bold text-primary text-right mt-1">{item.pulled}</Text></View><View className="flex-1 rounded-xl bg-background px-2 py-2"><Text className="text-[10px] text-muted text-right">تعارضات</Text><Text className="font-bold text-warning text-right mt-1">{item.conflicts}</Text></View></View></View>;
          }}
        />
        <Modal visible={Boolean(selectedConflict)} animationType="slide" onRequestClose={() => setSelectedConflict(null)}>
          <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-background">
            <View className="pt-5 flex-1">
              <View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setSelectedConflict(null)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">مقارنة التعارض</Text><MaterialIcons name="compare-arrows" size={24} color="#B45309" /></View>
              {selectedConflict ? <FlatList data={[selectedConflict]} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 24 }} renderItem={({ item }) => <View><View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-3"><Text className="font-bold text-foreground text-right">{recordLabel(item.recordType)} · {item.recordId}</Text><Text className="text-xs text-muted text-right mt-1">اكتُشف التعارض عند الإصدار {item.serverVersion}. راجع الحقول قبل اتخاذ القرار.</Text></View><TextInput value={resolutionNote} onChangeText={setResolutionNote} placeholder="ملاحظة سبب القرار (مطلوبة)" placeholderTextColor="#7C8798" textAlign="right" multiline className="min-h-[76px] rounded-2xl bg-background border border-warning/30 p-3 text-foreground mb-4" /><Text className="font-bold text-primary text-right mb-2">النسخة المحلية</Text><View className="rounded-2xl bg-primary/10 border border-primary/20 p-3 mb-4"><Text selectable className="text-xs text-foreground text-left leading-5">{readablePayload(item.localPayload)}</Text></View><Text className="font-bold text-foreground text-right mb-2">نسخة الخادم</Text><View className="rounded-2xl bg-surface border border-border p-3 mb-4"><Text selectable className="text-xs text-foreground text-left leading-5">{readablePayload(item.serverPayload)}</Text></View><View className="flex-row-reverse gap-2"><Pressable onPress={() => resolve("local")} className="flex-1 h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="phone-android" size={19} color="#FFFFFF" /><Text className="text-white font-bold">اعتماد المحلي</Text></Pressable><Pressable onPress={() => resolve("server")} className="flex-1 h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="cloud" size={19} color="#FFFFFF" /><Text className="text-white font-bold">اعتماد الخادم</Text></Pressable></View></View>} /> : null}
            </View>
          </ScreenContainer>
        </Modal>
      </View>
    </ScreenContainer>
  );
}
