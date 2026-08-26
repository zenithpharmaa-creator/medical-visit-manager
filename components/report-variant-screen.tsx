import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Animated, Easing, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { UnifiedDatePicker } from "@/components/unified-date-picker";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { localDateKey } from "@/lib/visit-utils";
import type { Representative, Visit } from "@/shared/visit-types";

export type ReportVariant = "search" | "calendar" | "representatives" | "daily" | "monthly-representative" | "representatives-total" | "daily-analysis";
type Config = { title: string; subtitle: string; icon: ComponentProps<typeof MaterialIcons>["name"] };
type ReportRow = { id: string; first: string; second: string; third: string; fourth: string; fifth?: string };
type SortKey = keyof Omit<ReportRow, "id">;
type SelectOption = { value: string; label: string };

const CONFIG: Record<ReportVariant, Config> = {
  search: { title: "بحث شامل", subtitle: "البحث في جميع الزيارات والجهات حسب الاسم والعنوان والمندوب", icon: "search" },
  calendar: { title: "تقويم الزيارات", subtitle: "عرض الزيارات حسب الأيام والتاريخ المحدد", icon: "calendar-month" },
  representatives: { title: "للمندوبين متنوع", subtitle: "تفاصيل الزيارات والأصناف والملاحظات لكل مندوب", icon: "people" },
  daily: { title: "طباعة", subtitle: "تقرير الزيارات اليومية بصيغة جاهزة للطباعة", icon: "print" },
  "monthly-representative": { title: "شهري حسب المندوب", subtitle: "مقارنة الزيارات الشهرية لكل مندوب", icon: "person" },
  "representatives-total": { title: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الزيارات والزيارات اليومية والشهرية", icon: "summarize" },
  "daily-analysis": { title: "تحليلي يومي", subtitle: "تحليل يومي للزيارات والأطباء والفترات", icon: "analytics" },
};

const REPORT_ROUTES: Array<{ route: string; variant: ReportVariant }> = [
  { route: "report-search", variant: "search" },
  { route: "report-calendar", variant: "calendar" },
  { route: "report-representatives", variant: "representatives" },
  { route: "report-print", variant: "daily" },
  { route: "report-monthly", variant: "monthly-representative" },
  { route: "report-total", variant: "representatives-total" },
  { route: "report-daily-analysis", variant: "daily-analysis" },
];

const REPORT_SELECTIONS_KEY = "medical-visit-manager:report-selection-preferences";
const REGION_OPTIONS = [
  { value: "all", label: "كل المناطق" },
  { value: "north", label: "شمال صنعاء" },
  { value: "south", label: "جنوب صنعاء" },
] as const;

const DETAIL_HEADERS: Array<{ key: SortKey; label: string; width?: number }> = [
  { key: "first", label: "الطبيب" },
  { key: "second", label: "المندوب" },
  { key: "third", label: "التاريخ", width: 112 },
  { key: "fourth", label: "الأصناف", width: 144 },
  { key: "fifth", label: "العنوان", width: 160 },
];
const SUMMARY_HEADERS: Array<{ key: SortKey; label: string; width?: number }> = [
  { key: "first", label: "المندوب" },
  { key: "second", label: "عدد الزيارات", width: 96 },
  { key: "third", label: "عدد الأيام", width: 96 },
  { key: "fourth", label: "آخر زيارة", width: 112 },
];

const dateText = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : localDateKey(date);
};

const compareValues = (left: string, right: string) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right, "ar", { numeric: true, sensitivity: "base" });
};

function SelectField({ title, value, options, onChange }: { title: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = options.find((option) => option.value === value)?.label || title;
  const active = focused || visible;
  return <>
    <Pressable onPress={() => setVisible(true)} onPressIn={() => setFocused(true)} onPressOut={() => setFocused(false)} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: visible }} style={({ pressed }) => [{ minHeight: 48, flex: 1, borderRadius: 12, borderWidth: active ? 2 : 1, borderColor: active ? "#1257A6" : "#D8E0EA", backgroundColor: active ? "#EAF3FB" : "#FFFFFF", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", shadowColor: active ? "#1257A6" : "transparent", shadowOpacity: active ? 0.16 : 0, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: active ? 2 : 0 }, pressed && { opacity: 0.88 }]}>
      <MaterialIcons name="keyboard-arrow-down" size={22} color="#1257A6" />
      <View style={{ flex: 1, marginRight: 8 }}><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800", textAlign: "right" }}>{title}</Text><Text style={{ color: value === "all" ? "#7C8798" : "#102A43", fontSize: 13, fontWeight: "700", textAlign: "right", marginTop: 2 }} numberOfLines={1}>{selected}</Text></View>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable onPress={() => setVisible(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", paddingHorizontal: 22 }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 460, alignSelf: "center", maxHeight: "70%", borderRadius: 20, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}>
          <View style={{ padding: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#D8E0EA" }}><Pressable onPress={() => setVisible(false)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}><MaterialIcons name="close" size={20} color="#102A43" /></Pressable><Text style={{ flex: 1, marginRight: 10, color: "#102A43", fontSize: 16, fontWeight: "700", textAlign: "right" }}>{title}</Text></View>
          <ScrollView>{options.map((option) => <Pressable key={option.value} onPress={() => { onChange(option.value); setVisible(false); }} style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EEF2F6", backgroundColor: option.value === value ? "#EAF3FB" : "#FFFFFF" }, pressed && { opacity: 0.7 }]}><MaterialIcons name={option.value === value ? "radio-button-checked" : "radio-button-unchecked"} size={19} color={option.value === value ? "#1257A6" : "#7C8798"} /><Text style={{ flex: 1, marginRight: 10, color: option.value === value ? "#1257A6" : "#102A43", fontSize: 14, fontWeight: option.value === value ? "700" : "500", textAlign: "right" }}>{option.label}</Text></Pressable>)}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

function CalendarReport({ visits }: { visits: Array<{ recordedAt: string; entityName: string }> }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const cells = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); return [...Array(first).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)]; }, [month]);
  const visitsByDay = useMemo(() => visits.reduce<Record<string, string[]>>((result, visit) => { const date = new Date(visit.recordedAt); if (date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()) { const key = String(date.getDate()); result[key] = [...(result[key] || []), visit.entityName]; } return result; }, {}), [month, visits]);
  const shiftMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const monthPanResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2, onPanResponderRelease: (_, gesture) => { if (gesture.dx < -65) shiftMonth(1); else if (gesture.dx > 65) shiftMonth(-1); } }), []);
  return <View {...monthPanResponder.panHandlers} className="rounded-2xl border border-border overflow-hidden bg-surface"><View className="p-4 flex-row-reverse items-center justify-between border-b border-border"><Pressable onPress={() => shiftMonth(1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialIcons name="chevron-right" size={24} color="#1257A6" /></Pressable><View className="items-center"><Text className="text-lg font-bold text-foreground">{month.toLocaleDateString("ar", { month: "long", year: "numeric" })}</Text><Text className="text-[10px] text-muted mt-1">اسحب يميناً أو يساراً لتغيير الشهر</Text></View><Pressable onPress={() => shiftMonth(-1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialIcons name="chevron-left" size={24} color="#1257A6" /></Pressable></View><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => <Text key={day} className="flex-1 py-3 text-center text-primary font-bold text-[10px]">{day}</Text>)}</View><View className="flex-row-reverse flex-wrap p-2">{cells.map((day, index) => <View key={`${day || "empty"}-${index}`} className="w-[14.285%] p-1"><View className={`min-h-20 rounded-xl border ${day ? "border-border bg-background" : "border-transparent bg-transparent"} p-1`}>{day ? <><Text className="text-right text-xs font-bold text-foreground">{day}</Text>{(visitsByDay[String(day)] || []).slice(0, 2).map((name, nameIndex) => <View key={`${name}-${nameIndex}`} className="rounded-md bg-primary mt-1 px-1 py-1"><Text className="text-white text-[9px] text-right" numberOfLines={1}>{name}</Text></View>)}{(visitsByDay[String(day)] || []).length > 2 ? <Text className="text-[9px] text-muted text-right mt-1">+{(visitsByDay[String(day)] || []).length - 2} أخرى</Text> : null}</> : null}</View></View>)}</View></View>;
}

type DailyAnalysisTableProps = { visits: Visit[]; monthlyVisits: Visit[]; representatives: Representative[] };

function DailyAnalysisTable({ visits, monthlyVisits, representatives }: DailyAnalysisTableProps) {
  const rows = useMemo(() => representatives.filter((rep) => rep.active).map((rep) => {
    const representativeVisits = visits.filter((visit) => visit.representativeId === rep.id);
    const monthlyVisitsForRep = monthlyVisits.filter((visit) => visit.representativeId === rep.id);
    const morning = representativeVisits.filter((visit) => { const hour = new Date(visit.recordedAt).getHours(); return hour >= 8 && hour < 14; }).length;
    const evening = representativeVisits.filter((visit) => { const hour = new Date(visit.recordedAt).getHours(); return hour >= 16 && hour < 21; }).length;
    return { id: rep.id, name: rep.name, dailyVisits: representativeVisits.length, evening, morning, monthlyVisits: monthlyVisitsForRep.length, monthlyDoctors: new Set(monthlyVisitsForRep.map((visit) => visit.entityName.trim()).filter(Boolean)).size };
  }), [monthlyVisits, representatives, visits]);
  const headerCellStyle = { minHeight: 48, paddingHorizontal: 8, alignItems: "center" as const, justifyContent: "center" as const, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#D8E0EA" };
  const widths = [154, 110, 88, 88, 100, 126];
  return <View className="rounded-2xl border border-border overflow-hidden bg-surface"><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}><View style={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}><View className="flex-row-reverse"><View style={[headerCellStyle, { width: widths[0], backgroundColor: "#F5F8FC" }]} /><View style={[headerCellStyle, { width: widths[1] + widths[2] + widths[3], backgroundColor: "#BFE8D6" }]}><Text className="text-primary font-bold text-sm">يومي</Text></View><View style={[headerCellStyle, { width: widths[4] + widths[5], backgroundColor: "#DCEBFA" }]}><Text className="text-primary font-bold text-sm">شهري</Text></View></View><View className="flex-row-reverse bg-[#E8F2FB]">{["المندوب", "عدد الزيارات", "مساء", "صباح", "الزيارات", "الأطباء شهرياً"].map((label, index) => <View key={label} style={[headerCellStyle, { width: widths[index] }]}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{label}</Text></View>)}</View>{rows.length ? rows.map((row, index) => <View key={row.id} className={`flex-row-reverse ${index % 2 ? "bg-background" : "bg-surface"}`}>{[row.name, String(row.dailyVisits), String(row.evening), String(row.morning), String(row.monthlyVisits), String(row.monthlyDoctors)].map((value, valueIndex) => <View key={`${row.id}-${valueIndex}`} style={[{ width: widths[valueIndex], minHeight: 48, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#E5EAF0" }]}><Text className={`${valueIndex === 0 ? "text-foreground" : "text-primary"} text-xs font-bold text-center`} numberOfLines={2}>{value}</Text></View>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات تحليل ضمن الاختيارات الحالية</Text></View>}</View></ScrollView><Text className="px-3 py-2 text-[10px] text-muted text-right">الأطباء شهرياً = عدد الأطباء المختلفين في الزيارات خلال شهر التاريخ المحدد.</Text></View>;
}

type DailyDetailTableProps = { dailyVisits: Visit[]; scopedVisits: Visit[]; representatives: Representative[]; reportDate: string };

function DailyDetailTable({ dailyVisits, scopedVisits, representatives, reportDate }: DailyDetailTableProps) {
  const selectedDate = new Date(`${reportDate}T12:00:00`);
  const columns = [
    { key: "representative", label: "المندوب", width: 150 },
    { key: "doctor", label: "الطبيب", width: 188 },
    { key: "period", label: "الفترة", width: 92 },
    { key: "lastVisit", label: "تاريخ آخر زيارة", width: 132 },
    { key: "daysSince", label: "الأيام ↑", width: 82 },
    { key: "monthlyVisits", label: "العدد", width: 76 },
    { key: "totalVisits", label: "الكلي", width: 76 },
    { key: "totalMorning", label: "صباح", width: 76 },
    { key: "totalEvening", label: "مساء", width: 76 },
    { key: "visitRate", label: "نسبة الزيارة", width: 104 },
    { key: "stock", label: "المخزون", width: 105 },
    { key: "inventory", label: "الجرد", width: 82 },
  ] as const;
  const groupHeaders = [
    { label: "بيانات الزيارة اليومية", span: 3, color: "#BFE8D6" },
    { label: "بيانات آخر زيارة", span: 2, color: "#DCEBFA" },
    { label: "الزيارات الشهرية", span: 1, color: "#E8F2FB" },
    { label: "عدد الزيارات الكلي", span: 3, color: "#FCE8D8" },
    { label: "بيانات الزيارة الشهرية", span: 3, color: "#E8E1F7" },
  ];
  const widthByKey = Object.fromEntries(columns.map((column) => [column.key, column.width]));
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rows = dailyVisits.map((visit) => {
    const related = scopedVisits.filter((candidate) => candidate.representativeId === visit.representativeId && candidate.entityId === visit.entityId);
    const latest = related.reduce<Visit | null>((current, candidate) => !current || candidate.recordedAt > current.recordedAt ? candidate : current, null);
    const monthly = related.filter((candidate) => {
      const date = new Date(candidate.recordedAt);
      return !Number.isNaN(date.getTime()) && !Number.isNaN(selectedDate.getTime()) && date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth();
    });
    const latestDate = latest ? new Date(latest.recordedAt) : null;
    const daysSince = latestDate && !Number.isNaN(latestDate.getTime()) && !Number.isNaN(selectedDate.getTime()) ? Math.max(0, Math.floor((selectedDate.getTime() - latestDate.getTime()) / 86400000)) : null;
    const period = new Date(visit.recordedAt).getHours() >= 8 && new Date(visit.recordedAt).getHours() < 14 ? "صباح" : new Date(visit.recordedAt).getHours() >= 16 && new Date(visit.recordedAt).getHours() < 21 ? "مساء" : "خارج الدوام";
    const totalMorning = related.filter((candidate) => { const hour = new Date(candidate.recordedAt).getHours(); return hour >= 8 && hour < 14; }).length;
    const totalEvening = related.filter((candidate) => { const hour = new Date(candidate.recordedAt).getHours(); return hour >= 16 && hour < 21; }).length;
    const representative = representatives.find((candidate) => candidate.id === visit.representativeId)?.name || "غير محدد";
    return { id: visit.id, representative, doctor: visit.entityName, period, lastVisit: latest ? dateText(latest.recordedAt) : "—", daysSince: daysSince === null ? "—" : String(daysSince), monthlyVisits: String(monthly.length), totalVisits: String(related.length), totalMorning: String(totalMorning), totalEvening: String(totalEvening), visitRate: "—", stock: "—", inventory: "—" };
  });
  const headerCellStyle = { minHeight: 50, paddingHorizontal: 8, alignItems: "center" as const, justifyContent: "center" as const, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#22313F" };
  const valueFor = (row: (typeof rows)[number], key: (typeof columns)[number]["key"]) => row[key];
  return <View className="mt-4 rounded-2xl border-2 border-[#22313F] overflow-hidden bg-surface"><View className="px-4 py-3 bg-[#F8FBFF] border-b border-border"><Text className="text-foreground font-bold text-right">تفاصيل الزيارات اليومية وآخر زيارة والمؤشرات الشهرية</Text><Text className="text-muted text-[10px] text-right mt-1">يعرض هذا الجدول الزيارات المسجلة في تاريخ التقرير، مع مقارنة سجل الطبيب للمندوب نفسه.</Text></View><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: totalWidth }}><View style={{ minWidth: totalWidth }}><View className="flex-row-reverse">{groupHeaders.map((group) => <View key={group.label} style={[headerCellStyle, { width: group.span === 1 ? columns.find((column) => column.key === "monthlyVisits")?.width : columns.slice(groupHeaders.slice(0, groupHeaders.indexOf(group)).reduce((sum, item) => sum + item.span, 0), groupHeaders.slice(0, groupHeaders.indexOf(group)).reduce((sum, item) => sum + item.span, 0) + group.span).reduce((sum, column) => sum + column.width, 0), backgroundColor: group.color }]}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{group.label}</Text></View>)}</View><View className="flex-row-reverse bg-[#D7EFDF]">{columns.map((column) => <View key={column.key} style={[headerCellStyle, { width: widthByKey[column.key] }]}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{column.label}</Text></View>)}</View>{rows.length ? rows.map((row, index) => <View key={row.id} className={`flex-row-reverse ${index % 2 ? "bg-background" : "bg-surface"}`}>{columns.map((column) => <View key={`${row.id}-${column.key}`} style={{ width: widthByKey[column.key], minHeight: 48, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#9AA7B2" }}><Text className={`${column.key === "representative" || column.key === "doctor" ? "text-foreground" : "text-primary"} text-xs font-bold text-center`} numberOfLines={2}>{valueFor(row, column.key)}</Text></View>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد زيارات في التاريخ المحدد</Text></View>}</View></ScrollView><Text className="px-3 py-2 text-[10px] text-muted text-right">الحقول «نسبة الزيارة» و«المخزون» و«الجرد» تظهر فارغة حالياً لأنها تحتاج بيانات خطة أو مخزون غير محفوظة في سجل الزيارة.</Text></View>;
}

export function ReportVariantScreen({ variant }: { variant: ReportVariant }) {
  const router = useRouter();
  const { session } = useAccountSession();
  const { data } = useVisitStore();
  const config = CONFIG[variant];
  const [search, setSearch] = useState("");
  const [representativeId, setRepresentativeId] = useState("all");
  const [fromDate, setFromDate] = useState(() => variant === "daily-analysis" ? localDateKey(new Date()) : "");
  const [toDate, setToDate] = useState("");
  const [region, setRegion] = useState<"all" | "north" | "south">("all");
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("third");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const progress = useRef(new Animated.Value(0)).current;
  const reportIndex = REPORT_ROUTES.findIndex((item) => item.variant === variant);
  const representativeOptions = useMemo<SelectOption[]>(() => [{ value: "all", label: "كل المندوبين" }, ...data.representatives.filter((rep) => rep.active).sort((left, right) => left.name.localeCompare(right.name, "ar")).map((rep) => ({ value: rep.id, label: rep.name }))], [data.representatives]);

  useEffect(() => {
    if (session?.role !== "manager") return;
    let active = true;
    void AsyncStorage.getItem(REPORT_SELECTIONS_KEY).then((raw) => {
      if (!active) return;
      try {
        const saved = raw ? JSON.parse(raw) as { representativeId?: string; region?: "all" | "north" | "south" } : {};
        if (saved.region === "all" || saved.region === "north" || saved.region === "south") setRegion(saved.region);
        if (saved.representativeId === "all" || data.representatives.some((rep) => rep.id === saved.representativeId)) setRepresentativeId(saved.representativeId || "all");
      } catch { /* ignore malformed local preferences */ }
      setSelectionHydrated(true);
    }).catch(() => { if (active) setSelectionHydrated(true); });
    return () => { active = false; };
  }, [data.representatives, session?.role]);
  useEffect(() => {
    if (session?.role !== "manager" || !selectionHydrated) return;
    void AsyncStorage.setItem(REPORT_SELECTIONS_KEY, JSON.stringify({ representativeId, region }));
  }, [representativeId, region, selectionHydrated, session?.role]);

  function showLoading(duration = 650) { setLoading(true); setTimeout(() => setLoading(false), duration); }
  function triggerFilter<T>(setter: (value: T) => void, value: T) { setter(value); showLoading(500); }
  function goToReport(offset: number) { if (session?.role !== "manager") return; const nextIndex = (reportIndex + offset + REPORT_ROUTES.length) % REPORT_ROUTES.length; router.replace(`/(tabs)/${REPORT_ROUTES[nextIndex].route}` as never); }
  useEffect(() => { if (!loading) { progress.stopAnimation(); progress.setValue(0); return; } const loop = Animated.loop(Animated.sequence([Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }), Animated.timing(progress, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false })])); loop.start(); return () => loop.stop(); }, [loading, progress]);
  const reportPanResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25, onPanResponderRelease: (_, gesture) => { if (gesture.dx < -70) goToReport(1); else if (gesture.dx > 70) goToReport(-1); } }), [goToReport, reportIndex, session?.role]);

  const filteredVisits = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return data.visits.filter((visit) => {
      const day = dateText(visit.recordedAt);
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      const dateMatches = variant === "daily-analysis" ? day === fromDate : (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region) && dateMatches;
    });
  }, [data.entities, data.visits, fromDate, region, representativeId, search, toDate, variant]);

  const analysisMonthlyVisits = useMemo(() => {
    if (variant !== "daily-analysis") return [];
    const anchor = new Date(`${fromDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return [];
    const normalized = search.trim().toLowerCase();
    return data.visits.filter((visit) => {
      const date = new Date(visit.recordedAt);
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== anchor.getFullYear() || date.getMonth() !== anchor.getMonth()) return false;
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region);
    });
  }, [data.entities, data.visits, fromDate, region, representativeId, search, variant]);

  const analysisScopedVisits = useMemo(() => {
    if (variant !== "daily-analysis") return [];
    const normalized = search.trim().toLowerCase();
    return data.visits.filter((visit) => {
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region);
    });
  }, [data.entities, data.visits, region, representativeId, search, variant]);

  const rows = useMemo<ReportRow[]>(() => {
    if (variant === "monthly-representative" || variant === "representatives-total") return data.representatives.map((rep) => { const visits = filteredVisits.filter((visit) => visit.representativeId === rep.id); return { id: rep.id, first: rep.name, second: String(visits.length), third: String(new Set(visits.map((visit) => dateText(visit.recordedAt))).size), fourth: visits.length ? dateText(visits.reduce((latest, visit) => latest.recordedAt > visit.recordedAt ? latest : visit).recordedAt) : "—" }; });
    return filteredVisits.map((visit) => ({ id: visit.id, first: visit.entityName, second: data.representatives.find((rep) => rep.id === visit.representativeId)?.name || "غير محدد", third: dateText(visit.recordedAt), fourth: visit.visitedItems?.join("، ") || "—", fifth: visit.entityAddress || visit.geographicLocation || "—" }));
  }, [data.representatives, filteredVisits, variant]);
  const sortedRows = useMemo(() => [...rows].sort((left, right) => { const result = compareValues(String(left[sortKey] ?? ""), String(right[sortKey] ?? "")); return sortDirection === "asc" ? result : -result; }), [rows, sortDirection, sortKey]);
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("asc"); } };
  const headers = ["monthly-representative", "representatives-total"].includes(variant) ? SUMMARY_HEADERS : DETAIL_HEADERS;
  const sortLabel = sortDirection === "asc" ? "تصاعدي" : "تنازلي";
  const previousReport = REPORT_ROUTES[(reportIndex - 1 + REPORT_ROUTES.length) % REPORT_ROUTES.length];
  const nextReport = REPORT_ROUTES[(reportIndex + 1) % REPORT_ROUTES.length];

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><ScreenHeader title={config.title} subtitle={config.subtitle} icon={config.icon} /><View {...reportPanResponder.panHandlers} style={{ minHeight: 54, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#F5F8FC", paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={() => goToReport(-1)} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }, pressed && { backgroundColor: "#EAF3FB" }]}><MaterialIcons name="chevron-right" size={22} color="#1257A6" /></Pressable><View style={{ flex: 1, alignItems: "center" }}><Text style={{ color: "#7C8798", fontSize: 10, fontWeight: "700" }}>اسحب للتنقل بين التقارير</Text><Text style={{ color: "#102A43", fontSize: 13, fontWeight: "700", marginTop: 2 }}>{config.title}</Text></View><Pressable onPress={() => goToReport(1)} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }, pressed && { backgroundColor: "#EAF3FB" }]}><MaterialIcons name="chevron-left" size={22} color="#1257A6" /></Pressable><Text style={{ position: "absolute", right: 8, top: 3, color: "#94A3B8", fontSize: 9 }}>{CONFIG[previousReport.variant].title}</Text><Text style={{ position: "absolute", left: 8, top: 3, color: "#94A3B8", fontSize: 9 }}>{CONFIG[nextReport.variant].title}</Text></View><UnifiedDatePicker visible={datePickerTarget === "from"} value={fromDate} title="اختر تاريخ البداية" onClose={() => setDatePickerTarget(null)} onSelect={(value) => { triggerFilter(setFromDate, value); setDatePickerTarget(null); }} /><UnifiedDatePicker visible={datePickerTarget === "to"} value={toDate} title="اختر تاريخ النهاية" onClose={() => setDatePickerTarget(null)} onSelect={(value) => { triggerFilter(setToDate, value); setDatePickerTarget(null); }} /><View className="rounded-2xl bg-surface border border-border p-4 mb-4 gap-3"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="filter-alt" size={20} color="#1257A6" /><Text className="flex-1 text-right font-bold text-foreground">الفلاتر والبحث</Text></View><TextInput value={search} onChangeText={(value) => triggerFilter(setSearch, value)} placeholder="بحث باسم الطبيب أو العنوان أو الصنف" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground" />{variant === "daily-analysis" ? <Pressable onPress={() => setDatePickerTarget("from")} className="h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${fromDate ? "text-foreground" : "text-muted"}`}>{fromDate || "تاريخ التقرير"}</Text></Pressable> : <View className="flex-row-reverse gap-2"><Pressable onPress={() => setDatePickerTarget("from")} className="flex-1 h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${fromDate ? "text-foreground" : "text-muted"}`}>{fromDate || "من تاريخ"}</Text></Pressable><Pressable onPress={() => setDatePickerTarget("to")} className="flex-1 h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${toDate ? "text-foreground" : "text-muted"}`}>{toDate || "إلى تاريخ"}</Text></Pressable></View>}<View className="flex-row-reverse gap-3"><View className="flex-1 rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><SelectField title="المنطقة" value={region} options={REGION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => triggerFilter(setRegion, value as typeof region)} /></View><View className="flex-1 rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><SelectField title="المندوب" value={representativeId} options={representativeOptions} onChange={(value) => triggerFilter(setRepresentativeId, value)} /></View></View></View><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => showLoading(650)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#102A43", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="refresh" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تحديث</Text></Pressable><Pressable onPress={() => showLoading(800)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#16835B", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="file-download" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">إجراءات</Text></Pressable><Pressable onPress={() => showLoading(900)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#1257A6", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="print" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">طباعة</Text></Pressable></View>{loading ? <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-4 gap-3"><View className="flex-row-reverse items-center justify-center gap-3"><ActivityIndicator size="small" color="#1257A6" /><Text className="text-primary font-bold text-sm">جاري جلب بيانات التقرير، يرجى الانتظار...</Text></View><View style={{ height: 6, borderRadius: 6, backgroundColor: "#D8EAF7", overflow: "hidden" }}><Animated.View style={{ height: 6, width: progress.interpolate({ inputRange: [0, 1], outputRange: ["18%", "100%"] }), borderRadius: 6, backgroundColor: "#1257A6" }} /></View></View> : null}{variant === "calendar" ? <CalendarReport visits={filteredVisits.map((visit) => ({ recordedAt: visit.recordedAt, entityName: visit.entityName }))} /> : variant === "daily-analysis" ? <><DailyAnalysisTable visits={filteredVisits} monthlyVisits={analysisMonthlyVisits} representatives={data.representatives} /><DailyDetailTable dailyVisits={filteredVisits} scopedVisits={analysisScopedVisits} representatives={data.representatives} reportDate={fromDate} /></> : <View className="rounded-2xl border border-border overflow-hidden bg-surface"><View className="px-3 py-2 bg-primary/5 border-b border-border"><Text className="text-xs text-primary font-bold text-right">اضغط على عنوان أي عمود للترتيب {sortLabel}: {headers.find((header) => header.key === sortKey)?.label}</Text></View><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{headers.map((header) => <Pressable key={header.key} onPress={() => toggleSort(header.key)} style={{ flex: header.width ? undefined : 1, width: header.width, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 4 }}><Text className="text-right text-primary font-bold text-xs" numberOfLines={2}>{header.label}</Text><MaterialIcons name={sortKey === header.key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={15} color={sortKey === header.key ? "#1257A6" : "#7C8798"} /></Pressable>)}</View>{sortedRows.length ? sortedRows.map((row, index) => <View key={row.id} className={`flex-row-reverse border-b border-border ${index % 2 ? "bg-background" : "bg-surface"}`}>{headers.map((header) => <Text key={header.key} className={`${header.width ? "" : "flex-1"} px-2 py-3 text-right ${header.key === "first" ? "text-foreground" : "text-muted"} text-xs`} style={header.width ? { width: header.width } : undefined} numberOfLines={1}>{row[header.key] || "—"}</Text>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات ضمن الفلاتر الحالية</Text></View>}</View>}<Text className="text-[11px] text-muted text-right mt-3">تُعرض البيانات الفعلية المخزنة في التطبيق، ويمكن استخدام البحث والفلاتر والترتيب قبل الطباعة أو التصدير.</Text></ScrollView></ScreenContainer>;
}
