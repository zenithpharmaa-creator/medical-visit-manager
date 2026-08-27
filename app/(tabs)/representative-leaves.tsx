import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { UnifiedDatePicker } from "@/components/unified-date-picker";
import { useAccountSession } from "@/lib/account-session";
import { buildId } from "@/lib/visit-utils";
import { findPendingEmptyDays } from "@/lib/holiday-rules";
import { notifyManagerOfEmptyDays } from "@/lib/empty-day-notification";
import { useVisitStore } from "@/lib/visit-store";
import type { EmptyDayDecision, OfficialHoliday, OfficialHolidayKind, RepresentativeLeave, RepresentativeLeavePeriod } from "@/shared/visit-types";

const PERIODS: { value: RepresentativeLeavePeriod; label: string; color: string; icon: "event-busy" | "wb-sunny" | "brightness-3" }[] = [
  { value: "full-day", label: "إجازة يوم كامل", color: "#B42318", icon: "event-busy" },
  { value: "morning", label: "إجازة صباحية", color: "#B45309", icon: "wb-sunny" },
  { value: "evening", label: "إجازة مسائية", color: "#5B4B9A", icon: "brightness-3" },
];

const HOLIDAY_KINDS: { value: OfficialHolidayKind; label: string; icon: "flag" | "celebration" }[] = [
  { value: "official", label: "إجازة رسمية", icon: "flag" },
  { value: "national", label: "إجازة وطنية", icon: "celebration" },
];

const toDateKey = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString().slice(0, 10);
const formatDate = (value: string) => new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
const getPeriodLabel = (period: RepresentativeLeavePeriod) => PERIODS.find((item) => item.value === period)?.label ?? period;
const getHolidayKindLabel = (kind: OfficialHolidayKind) => HOLIDAY_KINDS.find((item) => item.value === kind)?.label ?? kind;
const getHolidayStatusLabel = (status: OfficialHoliday["status"]) => status === "approved" ? "معتمدة للجميع" : status === "excluded" ? "مستبعدة" : "بانتظار قرار المدير";
const getHolidayStatusColor = (status: OfficialHoliday["status"]) => status === "approved" ? "#16835B" : status === "excluded" ? "#B45309" : "#1257A6";
const getHolidayRange = (holiday: OfficialHoliday) => holiday.endDate ? `${formatDate(holiday.startDate)} — ${formatDate(holiday.endDate)}` : formatDate(holiday.startDate);
const formatDateTime = (value: string) => new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

type DecisionTarget = { holiday: OfficialHoliday; status: "approved" | "excluded" };
type EmptyDayTarget = { representativeId: string; date: string; decision: EmptyDayDecision };

export default function RepresentativeLeavesScreen() {
  const { session } = useAccountSession();
  const {
    data,
    upsertRepresentativeLeave,
    deleteRepresentativeLeave,
    upsertOfficialHoliday,
    decideOfficialHoliday,
    deleteOfficialHoliday,
    reviewEmptyDay,
  } = useVisitStore();
  const [selectedRep, setSelectedRep] = useState(data.representatives.find((rep) => rep.active)?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [selectedPeriod, setSelectedPeriod] = useState<RepresentativeLeavePeriod>("full-day");
  const [note, setNote] = useState("");
  const [repModalVisible, setRepModalVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayKind, setHolidayKind] = useState<OfficialHolidayKind>("official");
  const [holidayStartDate, setHolidayStartDate] = useState(toDateKey(new Date()));
  const [holidayEndDate, setHolidayEndDate] = useState("");
  const [holidayNote, setHolidayNote] = useState("");
  const [holidayDatePicker, setHolidayDatePicker] = useState<"start" | "end" | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<DecisionTarget | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [emptyDayTarget, setEmptyDayTarget] = useState<EmptyDayTarget | null>(null);
  const [emptyDayReason, setEmptyDayReason] = useState("");

  const activeReps = useMemo(() => data.representatives.filter((rep) => rep.active), [data.representatives]);
  const leaves = useMemo(() => [...(data.representativeLeaves ?? [])].sort((left, right) => right.date.localeCompare(left.date)), [data.representativeLeaves]);
  const holidays = useMemo(() => [...(data.officialHolidays ?? [])].sort((left, right) => right.startDate.localeCompare(left.startDate)), [data.officialHolidays]);
  const emptyDayCandidates = useMemo(() => findPendingEmptyDays(data, toDateKey(new Date())), [data]);
  const decisions = useMemo(() => (data.managerDecisionHistory ?? []).slice(0, 30), [data.managerDecisionHistory]);

  useEffect(() => {
    if (session?.role === "manager" && emptyDayCandidates.length) void notifyManagerOfEmptyDays(emptyDayCandidates, data.representatives);
  }, [data.representatives, emptyDayCandidates, session?.role]);

  if (session?.role !== "manager") {
    return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">إدارة الإجازات متاحة لمدير النظام فقط</Text></View></ScreenContainer>;
  }

  const saveLeave = () => {
    if (!selectedRep || !selectedDate) return Alert.alert("بيانات ناقصة", "اختر المندوب والتاريخ أولاً.");
    const old = (data.representativeLeaves ?? []).find((leave) => leave.representativeId === selectedRep && leave.date === selectedDate && leave.period === selectedPeriod);
    upsertRepresentativeLeave({
      id: old?.id ?? buildId("leave"),
      representativeId: selectedRep,
      date: selectedDate,
      period: selectedPeriod,
      note: note.trim() || undefined,
      createdAt: old?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setNote("");
    Alert.alert("تم الحفظ", `${getPeriodLabel(selectedPeriod)} للمندوب ${activeReps.find((rep) => rep.id === selectedRep)?.name ?? "المحدد"} بتاريخ ${formatDate(selectedDate)}.`);
  };

  const confirmDelete = (leave: RepresentativeLeave) => {
    const repName = data.representatives.find((rep) => rep.id === leave.representativeId)?.name ?? "المندوب";
    Alert.alert("حذف الإجازة", `هل تريد حذف ${getPeriodLabel(leave.period)} للمندوب ${repName}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteRepresentativeLeave(leave.id) },
    ]);
  };

  const saveHoliday = () => {
    const name = holidayName.trim();
    if (!name || !holidayStartDate) return Alert.alert("بيانات ناقصة", "أدخل اسم الإجازة واختر تاريخ البداية.");
    if (holidayEndDate && holidayEndDate < holidayStartDate) return Alert.alert("نطاق غير صحيح", "يجب أن يكون تاريخ النهاية بعد تاريخ البداية.");
    const existing = (data.officialHolidays ?? []).find((holiday) => holiday.name.trim() === name && holiday.startDate === holidayStartDate && holiday.endDate === (holidayEndDate || undefined));
    upsertOfficialHoliday({
      id: existing?.id ?? buildId("holiday"),
      name,
      kind: holidayKind,
      startDate: holidayStartDate,
      endDate: holidayEndDate || undefined,
      status: existing?.status === "approved" ? "approved" : "pending",
      note: holidayNote.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setHolidayName("");
    setHolidayEndDate("");
    setHolidayNote("");
    Alert.alert("تم الحفظ", "أضيفت الإجازة العامة بحالة قيد المراجعة. اعتمدها المدير لتطبيقها على جميع المندوبين.");
  };

  const openHolidayDecision = (holiday: OfficialHoliday, status: "approved" | "excluded") => {
    setDecisionNote(holiday.decisionNote ?? "");
    setDecisionTarget({ holiday, status });
  };

  const confirmHolidayDecision = () => {
    if (!decisionTarget) return;
    decideOfficialHoliday(decisionTarget.holiday.id, decisionTarget.status, decisionNote);
    setDecisionTarget(null);
    setDecisionNote("");
    Alert.alert("تم تحديث القرار", decisionTarget.status === "approved" ? "طُبقت الإجازة على جميع المندوبين." : "استُبعدت الإجازة من التقويم.");
  };

  const confirmHolidayDelete = (holiday: OfficialHoliday) => Alert.alert("حذف الإجازة العامة", `هل تريد حذف «${holiday.name}»؟`, [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: () => deleteOfficialHoliday(holiday.id) },
  ]);

  const openEmptyDayDecision = (candidate: { representativeId: string; date: string }, decision: EmptyDayDecision) => {
    setEmptyDayReason("");
    setEmptyDayTarget({ ...candidate, decision });
  };

  const confirmEmptyDayDecision = () => {
    if (!emptyDayTarget) return;
    const decidedAt = new Date().toISOString();
    const decidedBy = data.settings.managerName || "مدير النظام";
    reviewEmptyDay({ id: buildId("empty-day"), representativeId: emptyDayTarget.representativeId, date: emptyDayTarget.date, decision: emptyDayTarget.decision, reason: emptyDayReason.trim() || undefined, manualEntryAllowed: emptyDayTarget.decision === "exception", decidedBy, decidedAt });
    const existingAutoLeave = (data.representativeLeaves ?? []).find((leave) => leave.source === "empty-day" && leave.representativeId === emptyDayTarget.representativeId && leave.date === emptyDayTarget.date);
    if (emptyDayTarget.decision === "leave") {
      upsertRepresentativeLeave({ id: existingAutoLeave?.id ?? buildId("empty-day-leave"), representativeId: emptyDayTarget.representativeId, date: emptyDayTarget.date, period: "full-day", note: emptyDayReason.trim() || "اعتماد يوم خالٍ كإجازة", source: "empty-day", createdAt: existingAutoLeave?.createdAt ?? decidedAt, updatedAt: decidedAt });
    } else if (existingAutoLeave) {
      deleteRepresentativeLeave(existingAutoLeave.id);
    }
    setEmptyDayTarget(null);
    setEmptyDayReason("");
    Alert.alert("تم حفظ القرار", emptyDayTarget.decision === "leave" ? "اعتمد اليوم كإجازة للمندوب." : "تم منح صلاحية الاستثناء اليدوي لهذا اليوم والمندوب.");
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="إدارة الإجازات" subtitle="إجازات المندوبين والإجازات الرسمية والوطنية" icon="event-busy" />

        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="admin-panel-settings" size={22} color="#FFFFFF" /></View>
          <View className="flex-1 items-end"><Text className="font-bold text-primary text-right">إعداد إداري موحد</Text><Text className="text-xs text-muted text-right mt-1">الإجازة الرسمية المعتمدة تطبق على جميع المندوبين، بينما الإجازة الفردية تخص مندوباً واحداً وفترة محددة.</Text></View>
        </View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-5">
          <Text className="font-bold text-foreground text-right mb-3">إضافة أو تعديل إجازة مندوب</Text>
          <Text className="text-xs text-muted text-right mb-2">المندوب</Text>
          <Pressable onPress={() => setRepModalVisible(true)} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.75 : 1 }]}>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" /><Text className="flex-1 font-bold text-foreground text-right">{activeReps.find((rep) => rep.id === selectedRep)?.name ?? "اختر المندوب"}</Text>
          </Pressable>
          <Text className="text-xs text-muted text-right mt-3 mb-2">التاريخ</Text>
          <Pressable onPress={() => setDatePickerVisible(true)} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.75 : 1 }]}>
            <MaterialIcons name="calendar-month" size={21} color="#1257A6" /><Text className="flex-1 font-bold text-foreground text-right">{formatDate(selectedDate)}</Text>
          </Pressable>
          <Text className="text-xs text-muted text-right mt-3 mb-2">نوع الإجازة</Text>
          <View className="gap-2">{PERIODS.map((period) => <Pressable key={period.value} onPress={() => setSelectedPeriod(period.value)} style={({ pressed }) => [{ minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: selectedPeriod === period.value ? period.color : "#D8E0EA", backgroundColor: selectedPeriod === period.value ? `${period.color}18` : "#FFFFFF", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", gap: 9, opacity: pressed ? 0.75 : 1 }]}><View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: selectedPeriod === period.value ? period.color : "#EEF2F6" }}><MaterialIcons name={period.icon} size={17} color={selectedPeriod === period.value ? "#FFFFFF" : period.color} /></View><Text style={{ flex: 1, color: selectedPeriod === period.value ? period.color : "#102A43", textAlign: "right", fontSize: 13, fontWeight: "700" }}>{period.label}</Text>{selectedPeriod === period.value ? <MaterialIcons name="check-circle" size={19} color={period.color} /> : null}</Pressable>)}</View>
          <TextInput value={note} onChangeText={setNote} placeholder="ملاحظة اختيارية" placeholderTextColor="#7A8795" multiline textAlign="right" style={{ minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#FFFFFF", padding: 12, marginTop: 14, color: "#102A43" }} />
          <Pressable onPress={saveLeave} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, backgroundColor: "#1257A6", marginTop: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ إجازة المندوب</Text></Pressable>
        </View>

        <View className="rounded-2xl bg-surface border border-border overflow-hidden mb-5">
          <View className="p-4 bg-[#F8FBFF] border-b border-border flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="event-note" size={20} color="#1257A6" /><Text className="font-bold text-foreground">الإجازات الفردية المسجلة</Text></View><Text className="rounded-full bg-primary px-3 py-1 text-white font-bold text-xs">{leaves.length}</Text></View>
          {leaves.length ? leaves.map((leave) => { const rep = data.representatives.find((item) => item.id === leave.representativeId); const period = PERIODS.find((item) => item.value === leave.period) ?? PERIODS[0]; return <View key={leave.id} className="p-4 border-b border-border flex-row-reverse items-center gap-3"><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${period.color}18` }}><MaterialIcons name={period.icon} size={21} color={period.color} /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{rep?.name ?? "مندوب غير معروف"}</Text><Text className="text-xs text-muted text-right mt-1">{formatDate(leave.date)} · {period.label}</Text>{leave.note ? <Text className="text-xs text-muted text-right mt-1">ملاحظة: {leave.note}</Text> : null}</View><Pressable onPress={() => confirmDelete(leave)} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEC", opacity: pressed ? 0.7 : 1 }]} accessibilityLabel="حذف الإجازة"><MaterialIcons name="delete-outline" size={20} color="#B42318" /></Pressable></View>; }) : <View className="items-center p-8"><MaterialIcons name="event-available" size={36} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد إجازات فردية</Text><Text className="text-xs text-muted text-center mt-1">أضف إجازة لتظهر الخلية باللون المناسب في تقرير التقويم.</Text></View>}
        </View>

        <View className="rounded-2xl bg-surface border border-border overflow-hidden mb-5">
          <View className="p-4 bg-[#FFF6E6] border-b border-[#F3D39B] flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="notification-important" size={21} color="#B45309" /><Text className="font-bold text-foreground">أيام بلا زيارات تحتاج قراراً</Text></View><Text className="rounded-full bg-[#B45309] px-3 py-1 text-white font-bold text-xs">{emptyDayCandidates.length}</Text></View>
          <View className="p-4"><Text className="text-xs text-muted text-right mb-3">إذا لم يسجل المندوب زيارة في يوم مخطط له، اختر اعتماد اليوم كإجازة أو امنحه استثناءً لإدخال زيارة يدوياً. لا تظهر الإجازات الرسمية المعتمدة هنا لأنها مطبقة تلقائياً على الجميع.</Text>{emptyDayCandidates.length ? emptyDayCandidates.map((candidate) => { const rep = data.representatives.find((item) => item.id === candidate.representativeId); return <View key={`${candidate.representativeId}-${candidate.date}`} className="border border-border rounded-2xl p-3 mb-2"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="event-note" size={19} color="#B45309" /><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{rep?.name ?? "مندوب غير معروف"}</Text><Text className="text-xs text-muted text-right mt-1">{formatDate(candidate.date)} · لا توجد زيارة مسجلة</Text></View></View><View className="flex-row-reverse gap-2 mt-3"><Pressable onPress={() => openEmptyDayDecision(candidate, "leave")} style={({ pressed }) => [{ flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#B42318", backgroundColor: "#FDECEC", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 5, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="event-busy" size={17} color="#B42318" /><Text style={{ color: "#B42318", fontWeight: "700", fontSize: 11 }}>اعتماد إجازة</Text></Pressable><Pressable onPress={() => openEmptyDayDecision(candidate, "exception")} style={({ pressed }) => [{ flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#1257A6", backgroundColor: "#EAF3FB", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 5, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="edit-calendar" size={17} color="#1257A6" /><Text style={{ color: "#1257A6", fontWeight: "700", fontSize: 11 }}>استثناء وإدخال يدوي</Text></Pressable></View></View>; }) : <View className="items-center py-6"><MaterialIcons name="task-alt" size={32} color="#16835B" /><Text className="font-bold text-foreground mt-2">لا توجد أيام معلقة</Text><Text className="text-xs text-muted text-center mt-1">ستظهر الأيام المخططة بلا زيارات هنا للمراجعة.</Text></View>}</View>
        </View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-5">
          <Text className="font-bold text-foreground text-right">الإجازات الرسمية والوطنية</Text>
          <Text className="text-xs text-muted text-right mt-1 mb-4">تُسجل أولاً بحالة قيد المراجعة. بعد اعتمادها ستظهر إجازة كاملة لجميع المندوبين في تقرير التقويم ضمن نطاق التاريخ.</Text>
          <TextInput value={holidayName} onChangeText={setHolidayName} placeholder="اسم الإجازة، مثل: اليوم الوطني" placeholderTextColor="#7A8795" textAlign="right" style={{ minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 14, color: "#102A43" }} />
          <Text className="text-xs text-muted text-right mt-3 mb-2">نوع الإجازة</Text>
          <View className="flex-row-reverse gap-2">{HOLIDAY_KINDS.map((kind) => <Pressable key={kind.value} onPress={() => setHolidayKind(kind.value)} style={({ pressed }) => [{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: holidayKind === kind.value ? "#16835B" : "#D8E0EA", backgroundColor: holidayKind === kind.value ? "#E9F7F0" : "#FFFFFF", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name={kind.icon} size={18} color={holidayKind === kind.value ? "#16835B" : "#697586"} /><Text style={{ color: holidayKind === kind.value ? "#16835B" : "#475467", fontWeight: "700", fontSize: 12 }}>{kind.label}</Text></Pressable>)}</View>
          <Text className="text-xs text-muted text-right mt-3 mb-2">الفترة الزمنية</Text>
          <View className="flex-row-reverse gap-2">
            <Pressable onPress={() => setHolidayDatePicker("start")} style={({ pressed }) => [{ flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", gap: 6, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="event" size={19} color="#1257A6" /><Text className="flex-1 text-foreground text-right text-xs font-bold">{formatDate(holidayStartDate)}</Text></Pressable>
            <Pressable onPress={() => setHolidayDatePicker("end")} style={({ pressed }) => [{ flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#F8FBFF", paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", gap: 6, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="event" size={19} color="#1257A6" /><Text className="flex-1 text-foreground text-right text-xs font-bold">{holidayEndDate ? formatDate(holidayEndDate) : "بدون تاريخ نهاية"}</Text></Pressable>
          </View>
          {holidayEndDate ? <Pressable onPress={() => setHolidayEndDate("")} style={({ pressed }) => [{ alignSelf: "flex-end", marginTop: 7, opacity: pressed ? 0.65 : 1 }]}><Text className="text-xs font-bold" style={{ color: "#B42318" }}>إزالة تاريخ النهاية</Text></Pressable> : null}
          <TextInput value={holidayNote} onChangeText={setHolidayNote} placeholder="ملاحظة الإجازة (اختيارية)" placeholderTextColor="#7A8795" textAlign="right" multiline style={{ minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#FFFFFF", padding: 12, marginTop: 12, color: "#102A43" }} />
          <Pressable onPress={saveHoliday} style={({ pressed }) => [{ minHeight: 52, borderRadius: 14, backgroundColor: "#16835B", marginTop: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="event-available" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الإجازة العامة</Text></Pressable>
        </View>

        <View className="rounded-2xl bg-surface border border-border overflow-hidden">
          <View className="p-4 bg-[#F8FBFF] border-b border-border flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="public" size={20} color="#16835B" /><Text className="font-bold text-foreground">سجل الإجازات العامة</Text></View><Text className="rounded-full bg-[#16835B] px-3 py-1 text-white font-bold text-xs">{holidays.length}</Text></View>
          {holidays.length ? holidays.map((holiday) => { const statusColor = getHolidayStatusColor(holiday.status); return <View key={holiday.id} className="p-4 border-b border-border"><View className="flex-row-reverse items-start gap-3"><View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${statusColor}18` }}><MaterialIcons name={holiday.kind === "national" ? "celebration" : "flag"} size={21} color={statusColor} /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{holiday.name}</Text><Text className="text-xs text-muted text-right mt-1">{getHolidayKindLabel(holiday.kind)} · {getHolidayRange(holiday)}</Text><Text className="text-xs font-bold text-right mt-1" style={{ color: statusColor }}>{getHolidayStatusLabel(holiday.status)}</Text>{holiday.note ? <Text className="text-xs text-muted text-right mt-1">ملاحظة: {holiday.note}</Text> : null}{holiday.decisionNote ? <Text className="text-xs text-muted text-right mt-1">سبب القرار: {holiday.decisionNote} · {holiday.decidedBy ?? "المدير"} · {holiday.decidedAt ? formatDate(holiday.decidedAt.slice(0, 10)) : ""}</Text> : null}</View><Pressable onPress={() => confirmHolidayDelete(holiday)} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECEC", opacity: pressed ? 0.7 : 1 }]} accessibilityLabel="حذف الإجازة العامة"><MaterialIcons name="delete-outline" size={20} color="#B42318" /></Pressable></View>{holiday.status === "pending" ? <View className="flex-row-reverse gap-2 mt-3"><Pressable onPress={() => openHolidayDecision(holiday, "approved")} style={({ pressed }) => [{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#16835B", backgroundColor: "#E9F7F0", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 5, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="check-circle" size={18} color="#16835B" /><Text style={{ color: "#16835B", fontWeight: "700", fontSize: 12 }}>اعتماد للجميع</Text></Pressable><Pressable onPress={() => openHolidayDecision(holiday, "excluded")} style={({ pressed }) => [{ flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#B45309", backgroundColor: "#FFF6E6", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 5, opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="block" size={18} color="#B45309" /><Text style={{ color: "#B45309", fontWeight: "700", fontSize: 12 }}>استبعاد</Text></Pressable></View> : null}</View>; }) : <View className="items-center p-8"><MaterialIcons name="event-busy" size={36} color="#697586" /><Text className="font-bold text-foreground mt-3">لا توجد إجازات عامة</Text><Text className="text-xs text-muted text-center mt-1">أضف إجازة رسمية أو وطنية لتظهر هنا قبل اعتمادها.</Text></View>}
        </View>

        <View className="rounded-2xl bg-surface border border-border overflow-hidden mb-5">
          <View className="p-4 bg-[#F8FBFF] border-b border-border flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="history" size={20} color="#1257A6" /><Text className="font-bold text-foreground">سجل قرارات المدير</Text></View><Text className="rounded-full bg-primary px-3 py-1 text-white font-bold text-xs">{decisions.length}</Text></View>
          {decisions.length ? decisions.map((decision) => <View key={decision.id} className="p-4 border-b border-border"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name={decision.decisionType === "official-holiday" ? "public" : "event-note"} size={18} color="#1257A6" /><Text className="flex-1 text-right font-bold text-foreground">{decision.decisionType === "official-holiday" ? `إجازة عامة: ${decision.decision === "approved" ? "اعتماد للجميع" : "استبعاد"}` : `يوم خالٍ: ${decision.decision === "leave" ? "اعتماد إجازة" : "استثناء يدوي"}`}</Text></View><Text className="text-xs text-muted text-right mt-1">المدير: {decision.decidedBy} · {formatDateTime(decision.decidedAt)}</Text>{decision.representativeId ? <Text className="text-xs text-muted text-right mt-1">المندوب: {data.representatives.find((rep) => rep.id === decision.representativeId)?.name ?? "مندوب"}{decision.date ? ` · ${formatDate(decision.date)}` : ""}</Text> : null}<Text className="text-xs text-muted text-right mt-1">السبب: {decision.reason ?? "لم تُسجل ملاحظة"}</Text></View>) : <View className="items-center p-8"><MaterialIcons name="history" size={34} color="#697586" /><Text className="font-bold text-foreground mt-3">لا توجد قرارات مسجلة</Text><Text className="text-xs text-muted text-center mt-1">سيظهر اسم المدير ووقت وسبب كل اعتماد أو استثناء هنا.</Text></View>}
        </View>
      </ScrollView>

      <UnifiedDatePicker visible={datePickerVisible} value={selectedDate} title="اختر تاريخ إجازة المندوب" onClose={() => setDatePickerVisible(false)} onSelect={(value) => { setSelectedDate(value); setDatePickerVisible(false); }} />
      <UnifiedDatePicker visible={holidayDatePicker !== null} value={holidayDatePicker === "end" ? (holidayEndDate || holidayStartDate) : holidayStartDate} title={holidayDatePicker === "end" ? "اختر تاريخ نهاية الإجازة" : "اختر تاريخ بداية الإجازة"} onClose={() => setHolidayDatePicker(null)} onSelect={(value) => { if (holidayDatePicker === "end") setHolidayEndDate(value); else setHolidayStartDate(value); setHolidayDatePicker(null); }} />
      <SelectionModal visible={repModalVisible} title="اختر المندوب" options={activeReps.map((rep) => ({ label: rep.name, value: rep.id }))} selected={selectedRep} onClose={() => setRepModalVisible(false)} onSelect={(option) => { setSelectedRep(option.value); setRepModalVisible(false); }} />

      <Modal visible={emptyDayTarget !== null} transparent animationType="fade" onRequestClose={() => setEmptyDayTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.48)", alignItems: "center", justifyContent: "center", padding: 22 }}><View style={{ width: "100%", maxWidth: 460, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 20 }}><View className="flex-row-reverse items-center gap-2"><MaterialIcons name={emptyDayTarget?.decision === "leave" ? "event-busy" : "edit-calendar"} size={23} color={emptyDayTarget?.decision === "leave" ? "#B42318" : "#1257A6"} /><Text className="flex-1 text-right text-lg font-bold text-foreground">{emptyDayTarget?.decision === "leave" ? "اعتماد اليوم كإجازة" : "منح استثناء إدخال يدوي"}</Text></View><Text className="text-sm text-muted text-right mt-3">{emptyDayTarget ? `${data.representatives.find((item) => item.id === emptyDayTarget.representativeId)?.name ?? "مندوب"} · ${formatDate(emptyDayTarget.date)}` : ""}</Text><Text className="text-xs text-muted text-right mt-1">اكتب سبب القرار ليُحفظ في سجل التدقيق.</Text><TextInput value={emptyDayReason} onChangeText={setEmptyDayReason} placeholder="سبب القرار أو ملاحظته" placeholderTextColor="#7A8795" textAlign="right" multiline style={{ minHeight: 90, borderRadius: 14, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#F8FBFF", padding: 12, marginTop: 14, color: "#102A43" }} /><View className="flex-row-reverse gap-2 mt-4"><Pressable onPress={() => setEmptyDayTarget(null)} style={({ pressed }) => [{ flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: "#EEF2F6", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}><Text className="font-bold text-foreground">إلغاء</Text></Pressable><Pressable onPress={confirmEmptyDayDecision} style={({ pressed }) => [{ flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: emptyDayTarget?.decision === "leave" ? "#B42318" : "#1257A6", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.78 : 1 }]}><Text className="font-bold text-white">حفظ القرار</Text></Pressable></View></View></View>
      </Modal>

      <Modal visible={decisionTarget !== null} transparent animationType="fade" onRequestClose={() => setDecisionTarget(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.48)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 460, borderRadius: 22, backgroundColor: "#FFFFFF", padding: 20 }}>
            <View className="flex-row-reverse items-center gap-2"><MaterialIcons name={decisionTarget?.status === "approved" ? "check-circle" : "block"} size={23} color={decisionTarget?.status === "approved" ? "#16835B" : "#B45309"} /><Text className="flex-1 text-right text-lg font-bold text-foreground">{decisionTarget?.status === "approved" ? "اعتماد الإجازة للجميع" : "استبعاد الإجازة"}</Text></View>
            <Text className="text-sm text-muted text-right mt-3">{decisionTarget?.holiday.name ?? ""}</Text>
            <Text className="text-xs text-muted text-right mt-1">اكتب سبب القرار ليظهر في سجل التدقيق.</Text>
            <TextInput value={decisionNote} onChangeText={setDecisionNote} placeholder="سبب القرار أو ملاحظته" placeholderTextColor="#7A8795" textAlign="right" multiline style={{ minHeight: 90, borderRadius: 14, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#F8FBFF", padding: 12, marginTop: 14, color: "#102A43" }} />
            <View className="flex-row-reverse gap-2 mt-4"><Pressable onPress={() => setDecisionTarget(null)} style={({ pressed }) => [{ flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: "#EEF2F6", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 }]}><Text className="font-bold text-foreground">إلغاء</Text></Pressable><Pressable onPress={confirmHolidayDecision} style={({ pressed }) => [{ flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: decisionTarget?.status === "approved" ? "#16835B" : "#B45309", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.78 : 1 }]}><Text className="font-bold text-white">حفظ القرار</Text></Pressable></View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
