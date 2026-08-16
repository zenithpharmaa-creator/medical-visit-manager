import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useVisitStore } from "@/lib/visit-store";
import { visitsForDate } from "@/lib/visit-utils";

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function WeeklyPlanScreen() {
  const { data } = useVisitStore();
  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    return dayNames.map((name, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { name, date, visits: visitsForDate(data.visits, date) }; });
  }, [data.visits]);
  const formatDate = (date: Date) => new Intl.DateTimeFormat("ar-YE", { day: "numeric", month: "short" }).format(date);
  const repName = (id: string) => data.representatives.find((rep) => rep.id === id)?.name ?? "مندوب غير محدد";
  const total = week.reduce((sum, day) => sum + day.visits.length, 0);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}><ScreenHeader title="الخطة الأسبوعية" subtitle="متابعة زيارات جميع المندوبين خلال الأسبوع الحالي" icon="calendar-month" /><View className="rounded-2xl bg-primary p-4 mb-5 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center"><MaterialIcons name="event" size={23} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="text-white font-bold text-lg">{total} زيارة مسجلة</Text><Text className="text-white/75 text-xs mt-1">خطة الأسبوع الحالي · {formatDate(week[0].date)} - {formatDate(week[6].date)}</Text></View></View>{week.map((day) => <View key={day.name} className="rounded-2xl bg-surface border border-border p-4 mb-3"><View className="flex-row-reverse items-center justify-between mb-3"><View className="items-end"><Text className="font-bold text-foreground text-base">{day.name}</Text><Text className="text-xs text-muted mt-1">{formatDate(day.date)}</Text></View><View className="rounded-full bg-primary/10 px-3 py-1"><Text className="text-primary font-bold text-xs">{day.visits.length} زيارة</Text></View></View>{day.visits.length === 0 ? <View className="py-3 flex-row-reverse items-center justify-end gap-2"><MaterialIcons name="event-busy" size={18} color="#94A3B8" /><Text className="text-xs text-muted">لا توجد زيارات مسجلة لهذا اليوم</Text></View> : day.visits.map((visit) => <View key={visit.id} className="border-t border-border py-3 flex-row-reverse items-center gap-3"><View className="w-9 h-9 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-on" size={18} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{visit.entityName}</Text><Text className="text-xs text-primary mt-1 text-right">{repName(visit.representativeId)} · {visit.entityKind}</Text></View></View>)}</View>)}<View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mt-1 flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="flex-1 text-primary text-xs text-right leading-5">تعرض الخطة الزيارات المسجلة حسب الأسبوع الحالي. يمكن تطويرها لاحقاً إلى جدول زيارات مخطط مسبقاً لكل مندوب.</Text></View></ScrollView></ScreenContainer>;
}
