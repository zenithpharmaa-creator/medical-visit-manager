import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { UnifiedDatePicker } from "@/components/unified-date-picker";
import { useAccountSession } from "@/lib/account-session";
import { buildId } from "@/lib/visit-utils";
import { useVisitStore } from "@/lib/visit-store";
import type { RepresentativeLeave, RepresentativeLeavePeriod } from "@/shared/visit-types";

const PERIODS: { value: RepresentativeLeavePeriod; label: string; color: string; icon: "event-busy" | "wb-sunny" | "brightness-3" }[] = [
  { value: "full-day", label: "إجازة يوم كامل", color: "#B42318", icon: "event-busy" },
  { value: "morning", label: "إجازة صباحية", color: "#B45309", icon: "wb-sunny" },
  { value: "evening", label: "إجازة مسائية", color: "#5B4B9A", icon: "brightness-3" },
];

const toDateKey = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString().slice(0, 10);
const formatDate = (value: string) => new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
const getPeriodLabel = (period: RepresentativeLeavePeriod) => PERIODS.find((item) => item.value === period)?.label ?? period;

export default function RepresentativeLeavesScreen() {
  const { session } = useAccountSession();
  const { data, upsertRepresentativeLeave, deleteRepresentativeLeave } = useVisitStore();
  const [selectedRep, setSelectedRep] = useState(data.representatives.find((rep) => rep.active)?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [selectedPeriod, setSelectedPeriod] = useState<RepresentativeLeavePeriod>("full-day");
  const [note, setNote] = useState("");
  const [repModalVisible, setRepModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const activeReps = useMemo(() => data.representatives.filter((rep) => rep.active), [data.representatives]);
  const leaves = useMemo(() => [...(data.representativeLeaves ?? [])].sort((left, right) => right.date.localeCompare(left.date)), [data.representativeLeaves]);

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">إدارة الإجازات متاحة لمدير النظام فقط</Text></View></ScreenContainer>;

  const saveLeave = () => {
    if (!selectedRep || !selectedDate) return Alert.alert("بيانات ناقصة", "اختر المندوب والتاريخ أولاً.");
    const old = (data.representativeLeaves ?? []).find((leave) => leave.representativeId === selectedRep && leave.date === selectedDate && leave.period === selectedPeriod);
    upsertRepresentativeLeave({ id: old?.id ?? buildId("leave"), representativeId: selectedRep, date: selectedDate, period: selectedPeriod, note: note.trim() || undefined, createdAt: old?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() });
    setNote("");
    Alert.alert("تم الحفظ", `${getPeriodLabel(selectedPeriod)} للمندوب ${activeReps.find((rep) => rep.id === selectedRep)?.name ?? "المحدد"} بتاريخ ${formatDate(selectedDate)}.`);
  };

  const confirmDelete = (leave: RepresentativeLeave) => {
    const repName = data.representatives.find((rep) => rep.id === leave.representativeId)?.name ?? "المندوب";
    Alert.alert("حذف الإجازة", `هل تريد حذف ${getPeriodLabel(leave.period)} للمندوب ${repName}؟`, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteRepresentativeLeave(leave.id) }]);
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}><ScreenHeader title="إدارة إجازات المندوبين" subtitle="حدد يوم الإجازة أو فترة الصباح والمساء لتظهر في تقرير التقويم" icon="event-busy" /><View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="admin-panel-settings" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-primary text-right">إعداد إداري</Text><Text className="text-xs text-muted text-right mt-1">هذه الشاشة للمدير فقط، وتُحفظ الإجازات محلياً ضمن بيانات البرنامج.</Text></View></View><View className="rounded-2xl bg-surface border border-border p-4 mb-5"><Text className="font-bold text-foreground text-right mb-3">إضافة أو تعديل إجازة</Text><Text className="text-xs text-muted text-right mb-2">المندوب</Text><Pressable onPress={() => setRepModalVisible(true)} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" /><Text className="flex-1 font-bold text-foreground text-right">{activeReps.find((rep) => rep.id === selectedRep)?.name ?? "اختر المندوب"}</Text></Pressable><Text className="text-xs text-muted text-right mt-3 mb-2">التاريخ</Text><Pressable onPress={() => setDatePickerVisible(true)} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="calendar-month" size={21} color="#1257A6" /><Text className="flex-1 font-bold text-foreground text-right">{formatDate(selectedDate)}</Text></Pressable><Text className="text-xs text-muted text-right mt-3 mb-2">نوع الإجازة</Text><View className="gap-2">{PERIODS.map((period) => <Pressable key={period.value} onPress={() => setSelectedPeriod(period.value)} style={({ pressed }) => [{ minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: selectedPeriod === period.value ? period.color : "#D8E0EA", backgroundColor: selectedPeriod === period.value ? `${period.color}18` : "#FFFFFF", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 9, opacity: pressed ? 0.75 : 1 }]}><View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: selectedPeriod === period.value ? period.color : "#EEF2F6" }}><MaterialIcons name={period.icon} size={17} color={selectedPeriod === period.value ? "#FFFFFF" : period.color} /></View><Text style={{ flex: 1, color: selectedPeriod === period.value ? period.color : "#102A43", textAlign: "right", fontSize: 13, fontWeight: "700" }}>{period.label}</Text>{selectedPeriod === period.value ? <MaterialIcons name="check-circle" size={19} color={period.color} /> : null}</Pressable>)}</View><Pressable onPress={saveLeave} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, backgroundColor: "#1257A6", marginTop: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الإجازة</Text></Pressable></View><View className="rounded-2xl bg-surface border border-border overflow-hidden"><View className="p-4 bg-[#F8FBFF] border-b border-border flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="event-note" size={20} color="#1257A6" /><Text className="font-bold text-foreground">الإجازات المسجلة</Text></View><Text className="rounded-full bg-primary px-3 py-1 text-white font-bold text-xs">{leaves.length}</Text></View>{leaves.length ? leaves.map((leave) => { const rep = data.representatives.find((item) => item.id === leave.representativeId); const period = PERIODS.find((item) => item.value === leave.period) ?? PERIODS[0]; return <View key={leave.id} className="p-4 border-b border-border flex-row-reverse items-center gap-3"><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${period.color}18` }}><MaterialIcons name={period.icon} size={21} color={period.color} /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{rep?.name ?? "مندوب غير معروف"}</Text><Text className="text-xs text-muted text-right mt-1">{formatDate(leave.date)} · {period.label}</Text>{leave.note ? <Text className="text-xs text-muted text-right mt-1">ملاحظة: {leave.note}</Text> : null}</View><Pressable onPress={() => confirmDelete(leave)} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEC", opacity: pressed ? 0.7 : 1 }]} accessibilityLabel="حذف الإجازة"><MaterialIcons name="delete-outline" size={20} color="#B42318" /></Pressable></View>; }) : <View className="items-center p-8"><MaterialIcons name="event-available" size={36} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد إجازات مسجلة</Text><Text className="text-xs text-muted text-center mt-1">أضف إجازة لتظهر الخلية باللون المناسب.</Text></View>}</View></ScrollView><UnifiedDatePicker visible={datePickerVisible} value={selectedDate} title="اختر تاريخ الإجازة" onClose={() => setDatePickerVisible(false)} onSelect={(value) => { setSelectedDate(value); setDatePickerVisible(false); }} /><SelectionModal visible={repModalVisible} title="اختر المندوب" options={activeReps.map((rep) => ({ label: rep.name, value: rep.id }))} selected={selectedRep} onClose={() => setRepModalVisible(false)} onSelect={(option) => { setSelectedRep(option.value); setRepModalVisible(false); }} /></ScreenContainer>;
}
