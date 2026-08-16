import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { NativeDateTimePicker } from "@/components/native-date-time-picker";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { buildId } from "@/lib/visit-utils";
import { notifyRepresentativeOfAssignment } from "@/lib/assigned-task-notification";
import type { VisitShift } from "@/shared/visit-types";

const options = [
  { label: "جهات الزيارة", subtitle: "العيادات والصيدليات والمستشفيات والمراكز", icon: "local-hospital" as const, route: "/entities" },
  { label: "المندوبون", subtitle: "تعديل أسماء المندوبين وحالتهم", icon: "groups" as const, route: "/settings" },
  { label: "المهام المسندة", subtitle: "متابعة الزيارات التي أسندها المدير", icon: "assignment-ind" as const, route: "/tasks" },
  { label: "إعدادات التقارير", subtitle: "البريد والتذكير والنسخة الاحتياطية", icon: "settings" as const, route: "/settings" },
  { label: "خريطة الزيارات", subtitle: "عرض مواقع الزيارات الموثقة حسب المندوب والجهة", icon: "map" as const, route: "/map" },
  { label: "تقرير تجاوزات الموقع", subtitle: "مراجعة زيارات تجاوز النطاق وأسبابها", icon: "gpp-maybe" as const, route: "/override-reports" },
  { label: "موقع المندوب الحالي", subtitle: "تحديد موقع المندوب على الخريطة وتحديثه", icon: "person-pin-circle" as const, route: "/rep-location" },
];

export default function ManagementScreen() {
  const { data, addPlannedVisit } = useVisitStore();
  const [assignModal, setAssignModal] = useState(false);
  const [repModal, setRepModal] = useState(false);
  const [entityModal, setEntityModal] = useState(false);
  const [dateVisible, setDateVisible] = useState(false);
  const [timeVisible, setTimeVisible] = useState(false);
  const [selectedRep, setSelectedRep] = useState(data.representatives[0]?.id ?? "");
  const [selectedEntity, setSelectedEntity] = useState(data.entities[0]?.id ?? "");
  const [selectedShift, setSelectedShift] = useState<VisitShift>("morning");
  const [scheduledDateTime, setScheduledDateTime] = useState(new Date());
  const [notes, setNotes] = useState("");

  const openAssign = () => { if (!data.representatives.length || !data.entities.length) { Alert.alert("بيانات ناقصة", "أضف مندوباً وطبيباً قبل إسناد الزيارة."); return; } setScheduledDateTime(new Date()); setNotes(""); setAssignModal(true); };
  const saveAssignment = () => {
    const entity = data.entities.find((item) => item.id === selectedEntity);
    if (!entity || !selectedRep) { Alert.alert("بيانات ناقصة", "اختر المندوب والطبيب."); return; }
    if (scheduledDateTime.getDay() === 5) { Alert.alert("يوم إجازة", "لا يمكن إسناد زيارة يوم الجمعة."); return; }
    const task = { id: buildId("assigned"), representativeId: selectedRep, entityId: entity.id, entityName: entity.name, entityKind: entity.kind, scheduledDate: scheduledDateTime.toISOString().slice(0, 10), scheduledTime: scheduledDateTime.toISOString(), shift: selectedShift, assignmentType: "assigned" as const, taskStatus: "assigned" as const, assignedAt: new Date().toISOString(), notes: notes.trim() };
    addPlannedVisit(task);
    const representative = data.representatives.find((item) => item.id === selectedRep);
    if (representative) void notifyRepresentativeOfAssignment(task, representative);
    setAssignModal(false); Alert.alert("تم إسناد الزيارة", "ستظهر المهمة في قائمة المهام المسندة للمندوب، وسيصل إشعار فوري عند تفعيل إذن التنبيهات.");
  };
  const formatDate = (date: Date) => new Intl.DateTimeFormat("ar-YE", { dateStyle: "medium" }).format(date);
  const formatTime = (date: Date) => new Intl.DateTimeFormat("ar-YE", { hour: "2-digit", minute: "2-digit" }).format(date);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}><ScreenHeader title="الإدارة" subtitle="بيانات المندوبين والجهات والإعدادات" icon="admin-panel-settings" /><View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse items-center gap-3"><View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="group" size={20} color="#FFFFFF" /></View><View className="items-end flex-1"><Text className="font-bold text-primary">فريق الزيارات</Text><Text className="text-sm text-muted mt-1">{data.representatives.filter((rep) => rep.active).length} مندوبين نشطين · {data.entities.length} جهة</Text></View></View><Pressable onPress={openAssign} className="rounded-2xl bg-success p-4 mb-5 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center"><MaterialIcons name="assignment-add" size={23} color="#FFFFFF" /></View><View className="items-end flex-1"><Text className="text-white font-bold text-base">إسناد زيارة لمندوب</Text><Text className="text-white/80 text-xs mt-1">مهمة عاجلة أو زيارة خاصة عند الضرورة</Text></View></Pressable><View className="gap-3">{options.map((option) => <Pressable key={option.label} onPress={() => router.push(option.route as never)} className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name={option.icon} size={22} color="#FFFFFF" /></View><View className="items-end flex-1"><Text className="font-bold text-foreground text-right">{option.label}</Text><Text className="text-xs text-muted mt-1 text-right">{option.subtitle}</Text></View><MaterialIcons name="chevron-left" size={23} color="#64748B" /></Pressable>)}</View></ScrollView><Modal visible={assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse justify-between items-center mb-4"><Text className="text-xl font-bold text-foreground">إسناد زيارة لمندوب</Text><Pressable onPress={() => setAssignModal(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><Text className="font-bold text-foreground text-right mb-2">المندوب</Text><Pressable onPress={() => setRepModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground">{data.representatives.find((item) => item.id === selectedRep)?.name ?? "اختر المندوب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><Text className="font-bold text-foreground text-right mb-2">الطبيب</Text><Pressable onPress={() => setEntityModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground">{data.entities.find((item) => item.id === selectedEntity)?.name ?? "اختر الطبيب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={() => setDateVisible((value) => !value)} className="flex-1 h-14 rounded-2xl border border-border bg-surface px-3 justify-center"><Text className="font-bold text-foreground text-right">التاريخ: {formatDate(scheduledDateTime)}</Text></Pressable><Pressable onPress={() => setTimeVisible((value) => !value)} className="flex-1 h-14 rounded-2xl border border-border bg-surface px-3 justify-center"><Text className="font-bold text-foreground text-right">الوقت: {formatTime(scheduledDateTime)}</Text></Pressable></View>{dateVisible ? <NativeDateTimePicker mode="date" value={scheduledDateTime} onChange={(date) => { setScheduledDateTime(date); setDateVisible(false); }} /> : null}{timeVisible ? <NativeDateTimePicker mode="time" value={scheduledDateTime} onChange={(date) => { setScheduledDateTime(date); setTimeVisible(false); }} /> : null}<View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={() => setSelectedShift("morning")} className={`flex-1 h-12 rounded-xl items-center justify-center ${selectedShift === "morning" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={selectedShift === "morning" ? "text-white font-bold" : "text-foreground font-bold"}>صباحية 08:00–13:00</Text></Pressable><Pressable onPress={() => setSelectedShift("evening")} className={`flex-1 h-12 rounded-xl items-center justify-center ${selectedShift === "evening" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={selectedShift === "evening" ? "text-white font-bold" : "text-foreground font-bold"}>مسائية 16:00–20:00</Text></Pressable></View><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات المهمة (اختياري)" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground mb-3" /><Pressable onPress={saveAssignment} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="assignment-turned-in" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ وإسناد المهمة</Text></Pressable></View></View></Modal><SelectionModal visible={repModal} title="اختر المندوب" options={data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }))} selected={selectedRep} onClose={() => setRepModal(false)} onSelect={(option) => { setSelectedRep(option.value); setRepModal(false); }} /><SelectionModal visible={entityModal} title="اختر الطبيب" options={data.entities.map((item) => ({ label: item.name, value: item.id }))} selected={selectedEntity} onClose={() => setEntityModal(false)} onSelect={(option) => { setSelectedEntity(option.value); setEntityModal(false); }} /></ScreenContainer>;
}
