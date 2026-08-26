import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
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

type Config = { title: string; subtitle: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] };
const CONFIG: Record<ReportVariant, Config> = {
  search: { title: "بحث شامل", subtitle: "البحث في جميع الزيارات والجهات حسب الاسم والعنوان والمندوب", icon: "search" },
  calendar: { title: "تقويم الزيارات", subtitle: "عرض الزيارات حسب الأيام والتاريخ المحدد", icon: "calendar-month" },
  representatives: { title: "للمندوبين متنوع", subtitle: "تفاصيل الزيارات والأصناف والملاحظات لكل مندوب", icon: "people" },
  daily: { title: "طباعة", subtitle: "تقرير الزيارات اليومية بصيغة جاهزة للطباعة", icon: "print" },
  "monthly-representative": { title: "شهري حسب المندوب", subtitle: "مقارنة الزيارات الشهرية لكل مندوب", icon: "person" },
  "representatives-total": { title: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الزيارات والزيارات اليومية والشهرية", icon: "summarize" },
  "daily-analysis": { title: "تحليلي يومي", subtitle: "تحليل يومي للزيارات والأطباء والفترات", icon: "analytics" },
};

const dateText = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : localDateKey(date); };

export function ReportVariantScreen({ variant }: { variant: ReportVariant }) {
  const { session } = useAccountSession();
  const { data } = useVisitStore();
  const config = CONFIG[variant];
  const [search, setSearch] = useState("");
  const [representativeId, setRepresentativeId] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const triggerFilter = (setter: (value: string) => void, value: string) => { setter(value); setLoading(true); setTimeout(() => setLoading(false), 350); };

  const filteredVisits = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return data.visits.filter((visit) => {
      const day = dateText(visit.recordedAt);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...((visit.visitedItems || []))].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
    }).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  }, [data.visits, fromDate, representativeId, search, toDate]);

  const rows = useMemo<Array<{ id: string; first: string; second: string; third: string; fourth: string; fifth?: string }>>(() => {
    if (variant === "monthly-representative" || variant === "representatives-total") {
      return data.representatives.map((rep) => { const visits = filteredVisits.filter((visit) => visit.representativeId === rep.id); return { id: rep.id, first: rep.name, second: String(visits.length), third: String(new Set(visits.map((visit) => dateText(visit.recordedAt))).size), fourth: visits.length ? dateText(visits[visits.length - 1].recordedAt) : "—" }; });
    }
    return filteredVisits.map((visit) => ({ id: visit.id, first: visit.entityName, second: data.representatives.find((rep) => rep.id === visit.representativeId)?.name || "غير محدد", third: dateText(visit.recordedAt), fourth: visit.visitedItems?.join("، ") || "—", fifth: visit.entityAddress || visit.geographicLocation || "—" }));
  }, [data.representatives, filteredVisits, variant]);

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text></View></ScreenContainer>;

  const detailReport = !["monthly-representative", "representatives-total"].includes(variant);
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><ScreenHeader title={config.title} subtitle={config.subtitle} icon={config.icon} /><View className="rounded-2xl bg-surface border border-border p-4 mb-4 gap-3"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="filter-alt" size={20} color="#1257A6" /><Text className="flex-1 text-right font-bold text-foreground">الفلاتر والبحث</Text></View><TextInput value={search} onChangeText={(value) => triggerFilter(setSearch, value)} placeholder="بحث باسم الطبيب أو العنوان أو الصنف" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground" /><View className="flex-row-reverse gap-2"><TextInput value={fromDate} onChangeText={(value) => triggerFilter(setFromDate, value)} placeholder="من تاريخ YYYY-MM-DD" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-foreground" /><TextInput value={toDate} onChangeText={(value) => triggerFilter(setToDate, value)} placeholder="إلى تاريخ YYYY-MM-DD" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-11 rounded-xl border border-border bg-background px-3 text-foreground" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 8 }}><Pressable onPress={() => triggerFilter(setRepresentativeId, "all")} style={{ paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: representativeId === "all" ? "#1257A6" : "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}><Text style={{ color: representativeId === "all" ? "#FFFFFF" : "#102A43", fontWeight: "700", fontSize: 12 }}>كل المندوبين</Text></Pressable>{data.representatives.filter((rep) => rep.active).map((rep) => <Pressable key={rep.id} onPress={() => triggerFilter(setRepresentativeId, rep.id)} style={{ paddingHorizontal: 14, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: representativeId === rep.id ? "#1257A6" : "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}><Text style={{ color: representativeId === rep.id ? "#FFFFFF" : "#102A43", fontWeight: "700", fontSize: 12 }}>{rep.name}</Text></Pressable>)}</ScrollView></View><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => { setLoading(true); setTimeout(() => setLoading(false), 450); }} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#102A43", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="refresh" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تحديث</Text></Pressable><Pressable onPress={() => setLoading(true)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#16835B", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="file-download" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">إجراءات</Text></Pressable><Pressable onPress={() => setLoading(true)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#1257A6", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="print" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">طباعة</Text></Pressable></View>{loading ? <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-4 flex-row-reverse items-center justify-center gap-3"><ActivityIndicator size="small" color="#1257A6" /><Text className="text-primary font-bold text-sm">جاري تجهيز التقرير، يرجى الانتظار...</Text></View> : null}<View className="flex-row-reverse gap-2 mb-4"><View className="flex-1 rounded-xl bg-primary/10 border border-primary/20 p-3"><Text className="text-xs text-muted text-right">السجلات</Text><Text className="text-xl font-bold text-primary text-right mt-1">{filteredVisits.length}</Text></View><View className="flex-1 rounded-xl bg-success/10 border border-success/20 p-3"><Text className="text-xs text-muted text-right">الأطباء</Text><Text className="text-xl font-bold text-success text-right mt-1">{new Set(filteredVisits.map((visit) => visit.entityId)).size}</Text></View><View className="flex-1 rounded-xl bg-warning/10 border border-warning/20 p-3"><Text className="text-xs text-muted text-right">الأيام</Text><Text className="text-xl font-bold text-warning text-right mt-1">{new Set(filteredVisits.map((visit) => dateText(visit.recordedAt))).size}</Text></View></View><View className="rounded-2xl border border-border overflow-hidden bg-surface"><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{detailReport ? <><Text className="flex-1 px-2 py-3 text-right text-primary font-bold text-xs">الطبيب</Text><Text className="flex-1 px-2 py-3 text-right text-primary font-bold text-xs">المندوب</Text><Text className="w-28 px-2 py-3 text-right text-primary font-bold text-xs">التاريخ</Text><Text className="w-36 px-2 py-3 text-right text-primary font-bold text-xs">الأصناف</Text><Text className="w-40 px-2 py-3 text-right text-primary font-bold text-xs">العنوان</Text></> : <><Text className="flex-1 px-2 py-3 text-right text-primary font-bold text-xs">المندوب</Text><Text className="w-24 px-2 py-3 text-right text-primary font-bold text-xs">عدد الزيارات</Text><Text className="w-24 px-2 py-3 text-right text-primary font-bold text-xs">عدد الأيام</Text><Text className="w-28 px-2 py-3 text-right text-primary font-bold text-xs">آخر زيارة</Text></>}</View>{rows.length ? rows.map((row, index) => <View key={row.id} className={`flex-row-reverse border-b border-border ${index % 2 ? "bg-background" : "bg-surface"}`}>{detailReport ? <><Text className="flex-1 px-2 py-3 text-right text-foreground text-xs" numberOfLines={1}>{row.first}</Text><Text className="flex-1 px-2 py-3 text-right text-muted text-xs" numberOfLines={1}>{row.second}</Text><Text className="w-28 px-2 py-3 text-right text-muted text-xs">{row.third}</Text><Text className="w-36 px-2 py-3 text-right text-muted text-xs" numberOfLines={1}>{row.fourth}</Text><Text className="w-40 px-2 py-3 text-right text-muted text-xs" numberOfLines={1}>{row.fifth}</Text></> : <><Text className="flex-1 px-2 py-3 text-right text-foreground text-xs">{row.first}</Text><Text className="w-24 px-2 py-3 text-right text-primary font-bold text-xs">{row.second}</Text><Text className="w-24 px-2 py-3 text-right text-muted text-xs">{row.third}</Text><Text className="w-28 px-2 py-3 text-right text-muted text-xs">{row.fourth}</Text></>}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات ضمن الفلاتر الحالية</Text></View>}</View><Text className="text-[11px] text-muted text-right mt-3">تُعرض البيانات الفعلية المخزنة في التطبيق، ويمكن استخدام البحث والفلاتر قبل الطباعة أو التصدير.</Text></ScrollView></ScreenContainer>;
}
