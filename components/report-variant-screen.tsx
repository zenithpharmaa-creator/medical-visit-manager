import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState, type ComponentProps } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { localDateKey } from "@/lib/visit-utils";

export type ReportVariant =
  | "search"
  | "calendar"
  | "representatives"
  | "daily"
  | "monthly-representative"
  | "representatives-total"
  | "daily-analysis";

type Config = { title: string; subtitle: string; icon: ComponentProps<typeof MaterialIcons>["name"] };
type ReportRow = { id: string; first: string; second: string; third: string; fourth: string; fifth?: string };
type SortKey = keyof Omit<ReportRow, "id">;

const CONFIG: Record<ReportVariant, Config> = {
  search: { title: "بحث شامل", subtitle: "البحث في جميع الزيارات والجهات حسب الاسم والعنوان والمندوب", icon: "search" },
  calendar: { title: "تقويم الزيارات", subtitle: "عرض الزيارات حسب الأيام والتاريخ المحدد", icon: "calendar-month" },
  representatives: { title: "للمندوبين متنوع", subtitle: "تفاصيل الزيارات والأصناف والملاحظات لكل مندوب", icon: "people" },
  daily: { title: "طباعة", subtitle: "تقرير الزيارات اليومية بصيغة جاهزة للطباعة", icon: "print" },
  "monthly-representative": { title: "شهري حسب المندوب", subtitle: "مقارنة الزيارات الشهرية لكل مندوب", icon: "person" },
  "representatives-total": { title: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الزيارات والزيارات اليومية والشهرية", icon: "summarize" },
  "daily-analysis": { title: "تحليلي يومي", subtitle: "تحليل يومي للزيارات والأطباء والفترات", icon: "analytics" },
};

const dateText = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : localDateKey(date);
};

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

const compareValues = (left: string, right: string) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right, "ar", { numeric: true, sensitivity: "base" });
};

export function ReportVariantScreen({ variant }: { variant: ReportVariant }) {
  const { session } = useAccountSession();
  const { data } = useVisitStore();
  const config = CONFIG[variant];
  const [search, setSearch] = useState("");
  const [representativeId, setRepresentativeId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("third");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const triggerFilter = (setter: (value: string) => void, value: string) => { setter(value); setLoading(true); setTimeout(() => setLoading(false), 350); };

  const filteredVisits = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return data.visits.filter((visit) => {
      const day = dateText(visit.recordedAt);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
    });
  }, [data.visits, fromDate, representativeId, search, toDate]);

  const rows = useMemo<ReportRow[]>(() => {
    if (variant === "monthly-representative" || variant === "representatives-total") {
      return data.representatives.map((rep) => {
        const visits = filteredVisits.filter((visit) => visit.representativeId === rep.id);
        return { id: rep.id, first: rep.name, second: String(visits.length), third: String(new Set(visits.map((visit) => dateText(visit.recordedAt))).size), fourth: visits.length ? dateText(visits.reduce((latest, visit) => latest.recordedAt > visit.recordedAt ? latest : visit).recordedAt) : "—" };
      });
    }
    return filteredVisits.map((visit) => ({ id: visit.id, first: visit.entityName, second: data.representatives.find((rep) => rep.id === visit.representativeId)?.name || "غير محدد", third: dateText(visit.recordedAt), fourth: visit.visitedItems?.join("، ") || "—", fifth: visit.entityAddress || visit.geographicLocation || "—" }));
  }, [data.representatives, filteredVisits, variant]);

  const sortedRows = useMemo(() => [...rows].sort((left, right) => {
    const result = compareValues(String(left[sortKey] ?? ""), String(right[sortKey] ?? ""));
    return sortDirection === "asc" ? result : -result;
  }), [rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection("asc"); }
  };
  const headers = ["monthly-representative", "representatives-total"].includes(variant) ? SUMMARY_HEADERS : DETAIL_HEADERS;
  const sortLabel = sortDirection === "asc" ? "تصاعدي" : "تنازلي";

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><ScreenHeader title={config.title} subtitle={config.subtitle} icon={config.icon} /><View className="rounded-2xl bg-surface border border-border p-4 mb-4 gap-3"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="filter-alt" size={20} color="#1257A6" /><Text className="flex-1 text-right font-bold text-foreground">الفلاتر والبحث</Text></View><TextInput value={search} onChangeText={(value) => triggerFilter(setSearch, value)} placeholder="بحث باسم الطبيب أو العنوان أو الصنف" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground" /><View className="flex-row-reverse gap-2"><TextInput value={fromDate} onChangeText={(value) => triggerFilter(setFromDate, value)} placeholder="من تاريخ YYYY-MM-DD" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-foreground" /><TextInput value={toDate} onChangeText={(value) => triggerFilter(setToDate, value)} placeholder="إلى تاريخ YYYY-MM-DD" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-foreground" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}><Pressable onPress={() => triggerFilter(setRepresentativeId, "all")} style={{ paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: representativeId === "all" ? "#1257A6" : "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}><Text style={{ color: representativeId === "all" ? "#FFFFFF" : "#102A43", fontWeight: "700", fontSize: 12 }}>كل المندوبين</Text></Pressable>{data.representatives.filter((rep) => rep.active).map((rep) => <Pressable key={rep.id} onPress={() => triggerFilter(setRepresentativeId, rep.id)} style={{ paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: representativeId === rep.id ? "#1257A6" : "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}><Text style={{ color: representativeId === rep.id ? "#FFFFFF" : "#102A43", fontWeight: "700", fontSize: 12 }}>{rep.name}</Text></Pressable>)}</ScrollView></View><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => { setLoading(true); setTimeout(() => setLoading(false), 450); }} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#102A43", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="refresh" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تحديث</Text></Pressable><Pressable onPress={() => setLoading(true)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#16835B", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="file-download" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">إجراءات</Text></Pressable><Pressable onPress={() => setLoading(true)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#1257A6", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="print" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">طباعة</Text></Pressable></View>{loading ? <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-4 flex-row-reverse items-center justify-center gap-3"><ActivityIndicator size="small" color="#1257A6" /><Text className="text-primary font-bold text-sm">جاري تجهيز التقرير، يرجى الانتظار...</Text></View> : null}<View className="rounded-2xl border border-border overflow-hidden bg-surface"><View className="px-3 py-2 bg-primary/5 border-b border-border"><Text className="text-xs text-primary font-bold text-right">اضغط على عنوان أي عمود للترتيب {sortLabel}: {headers.find((header) => header.key === sortKey)?.label}</Text></View><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{headers.map((header) => <Pressable key={header.key} onPress={() => toggleSort(header.key)} style={{ flex: header.width ? undefined : 1, width: header.width, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 4 }}><Text className="text-right text-primary font-bold text-xs" numberOfLines={2}>{header.label}</Text><MaterialIcons name={sortKey === header.key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={15} color={sortKey === header.key ? "#1257A6" : "#7C8798"} /></Pressable>)}</View>{sortedRows.length ? sortedRows.map((row, index) => <View key={row.id} className={`flex-row-reverse border-b border-border ${index % 2 ? "bg-background" : "bg-surface"}`}>{headers.map((header) => <Text key={header.key} className={`${header.width ? "" : "flex-1"} px-2 py-3 text-right ${header.key === "first" ? "text-foreground" : "text-muted"} text-xs`} style={header.width ? { width: header.width } : undefined} numberOfLines={1}>{row[header.key] || "—"}</Text>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات ضمن الفلاتر الحالية</Text></View>}</View><Text className="text-[11px] text-muted text-right mt-3">تُعرض البيانات الفعلية المخزنة في التطبيق، ويمكن استخدام البحث والفلاتر والترتيب قبل الطباعة أو التصدير.</Text></ScrollView></ScreenContainer>;
}
