import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useAccountSession } from "@/lib/account-session";
import { useColors } from "@/hooks/use-colors";

type ReportTone = "primary" | "success" | "warning" | "error";

const REPORT_OPTIONS: Array<{ route: string; label: string; subtitle: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; tone: ReportTone }> = [
  { route: "report-print", label: "طباعة", subtitle: "عرض وطباعة الزيارات", icon: "print", tone: "primary" },
  { route: "report-daily-analysis", label: "تحليل يومي", subtitle: "تفاصيل اليوم والمؤشرات", icon: "analytics", tone: "success" },
  { route: "report-search", label: "بحث شامل", subtitle: "البحث في كل الزيارات", icon: "manage-search", tone: "warning" },
  { route: "report-monthly", label: "شهري حسب المندوب", subtitle: "مقارنة الأداء الشهري", icon: "date-range", tone: "primary" },
  { route: "report-total", label: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الأداء", icon: "summarize", tone: "error" },
  { route: "report-calendar", label: "تقويم", subtitle: "توزيع الزيارات والإجازات", icon: "calendar-month", tone: "success" },
  { route: "report-representatives", label: "للمندوبين متنوع", subtitle: "تفصيل حسب المندوب", icon: "people", tone: "warning" },
];

export default function ReportsScreen() {
  const router = useRouter();
  const { session } = useAccountSession();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 3 : 2;

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text><Text className="text-sm text-muted text-center mt-2">لا يملك حساب المندوب صلاحية عرض التقارير.</Text></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}><ScreenHeader title="التقارير" subtitle="اختر نوع التقرير لعرض البيانات وتحليلها" icon="assessment" showBack /><View className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-5 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="dashboard" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-primary text-right">مركز التقارير</Text><Text className="text-xs text-muted text-right mt-1">اختر بطاقة للانتقال مباشرة إلى التقرير المطلوب.</Text></View></View><View className="flex-row-reverse flex-wrap" style={{ marginHorizontal: -6 }}>{REPORT_OPTIONS.map((option) => { const accent = colors[option.tone]; return <View key={option.route} style={{ width: `${100 / columns}%`, paddingHorizontal: 6, marginBottom: 12 }}><Pressable onPress={() => router.push(`/(tabs)/${option.route}` as never)} accessibilityRole="button" accessibilityLabel={`فتح تقرير ${option.label}`} accessibilityHint="اضغط لفتح التقرير" style={({ pressed }) => [{ minHeight: 158, borderRadius: 20, borderWidth: 1.5, borderColor: `${accent}55`, backgroundColor: colors.surface, padding: 12, alignItems: "center", justifyContent: "space-between", shadowColor: accent, shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, pressed && { opacity: 0.72, transform: [{ scale: 0.98 }], backgroundColor: `${accent}0D` }]}><View style={{ width: 72, height: 72, borderRadius: 24, borderWidth: 2.5, borderColor: accent, backgroundColor: colors.surface, padding: 3, shadowColor: accent, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}><View style={{ flex: 1, borderRadius: 19, backgroundColor: accent, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: colors.background }}><View style={{ position: "absolute", width: 54, height: 54, borderRadius: 27, right: -19, top: -19, backgroundColor: "rgba(255,255,255,0.20)" }} /><View style={{ position: "absolute", width: 36, height: 36, borderRadius: 18, left: -12, bottom: -12, backgroundColor: "rgba(0,0,0,0.10)" }} /><MaterialIcons name={option.icon} size={32} color={colors.background} /></View></View><View className="items-center"><Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800", textAlign: "center" }} numberOfLines={2}>{option.label}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 5 }} numberOfLines={2}>{option.subtitle}</Text></View><View style={{ width: 30, height: 4, borderRadius: 5, backgroundColor: accent, opacity: 0.7 }} /></Pressable></View>; })}</View></ScrollView></ScreenContainer>;
}
