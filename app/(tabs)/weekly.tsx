import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useVisitStore } from "@/lib/visit-store";
import { visitsForDate } from "@/lib/visit-utils";

const dayNames = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const shifts = [{ label: "الفترة الصباحية", time: "08:00 – 13:00" }, { label: "الفترة المسائية", time: "16:00 – 20:00" }];

export default function WeeklyPlanScreen() {
  const { data } = useVisitStore();
  const week = useMemo(() => {
    const today = new Date();
    const saturdayOffset = (today.getDay() + 1) % 7;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - saturdayOffset);
    return dayNames.map((name, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { name, date, visits: visitsForDate(data.visits, date), holiday: name === "الجمعة" }; });
  }, [data.visits]);
  const formatDate = (date: Date) => new Intl.DateTimeFormat("ar-YE", { day: "numeric", month: "short" }).format(date);
  const timeOf = (iso: string) => new Intl.DateTimeFormat("ar-YE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const repName = (id: string) => data.representatives.find((rep) => rep.id === id)?.name ?? "مندوب غير محدد";
  const total = week.reduce((sum, day) => sum + day.visits.length, 0);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}><ScreenHeader title="الخطة الأسبوعية" subtitle="الدوام من السبت إلى الخميس · الجمعة إجازة" icon="calendar-month" /><View className="rounded-2xl bg-primary p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center"><MaterialIcons name="event" size={23} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="text-white font-bold text-lg">{total} زيارة مسجلة</Text><Text className="text-white/75 text-xs mt-1">السبت أول الأسبوع · {formatDate(week[0].date)} – {formatDate(week[6].date)}</Text></View></View><View className="rounded-2xl bg-surface border border-border p-4 mb-5"><Text className="font-bold text-foreground text-right mb-3">ساعات الدوام اليومية</Text><View className="flex-row-reverse gap-3">{shifts.map((shift) => <View key={shift.label} className="flex-1 rounded-xl bg-primary/10 p-3 items-end"><Text className="text-primary text-xs font-bold text-right">{shift.label}</Text><Text className="text-foreground font-bold mt-1">{shift.time}</Text></View>)}</View></View>{week.map((day) => <View key={day.name} className={`rounded-2xl border p-4 mb-3 ${day.holiday ? "bg-warning/10 border-warning/30" : "bg-surface border-border"}`}><View className="flex-row-reverse items-center justify-between mb-3"><View className="items-end"><View className="flex-row-reverse items-center gap-2"><Text className="font-bold text-foreground text-base">{day.name}</Text>{day.holiday ? <View className="rounded-full bg-warning/20 px-2 py-1"><Text className="text-warning font-bold text-[10px]">إجازة رسمية</Text></View> : null}</View><Text className="text-xs text-muted mt-1">{formatDate(day.date)}</Text></View><View className="rounded-full bg-primary/10 px-3 py-1"><Text className="text-primary font-bold text-xs">{day.visits.length} زيارة</Text></View></View>{day.holiday ? <View className="py-3 flex-row-reverse items-center justify-end gap-2"><MaterialIcons name="beach-access" size={18} color="#D97706" /><Text className="text-warning font-semibold">الجمعة إجازة رسمية — لا يوجد دوام</Text></View> : day.visits.length === 0 ? <View className="py-3 flex-row-reverse items-center justify-end gap-2"><MaterialIcons name="event-busy" size={18} color="#94A3B8" /><Text className="text-xs text-muted">لا توجد زيارات مسجلة لهذا اليوم</Text></View> : day.visits.map((visit) => <View key={visit.id} className="border-t border-border py-3 flex-row-reverse items-center gap-3"><View className="w-9 h-9 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-on" size={18} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{visit.entityName}</Text><Text className="text-xs text-primary mt-1 text-right">{repName(visit.representativeId)} · {visit.entityKind} · {timeOf(visit.recordedAt)}</Text></View></View>)}</View>)}<View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mt-1 flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="flex-1 text-primary text-xs text-right leading-5">ساعات العمل المعتمدة: صباحاً من 08:00 إلى 13:00، ومساءً من 16:00 إلى 20:00. يوم الجمعة إجازة رسمية.</Text></View></ScrollView></ScreenContainer>;
}
