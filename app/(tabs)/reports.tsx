import { useRouter } from "expo-router";
import { useRef, type ComponentProps } from "react";
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useColors } from "@/hooks/use-colors";
import { useAccountSession } from "@/lib/account-session";
import type { ThemeColorPalette } from "@/constants/theme";

type ReportTone = "primary" | "success" | "warning" | "error";

type ReportOption = {
  route: string;
  label: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialIcons>["name"];
  tone: ReportTone;
};

const REPORT_OPTIONS: ReportOption[] = [
  { route: "report-print", label: "طباعة", subtitle: "عرض وطباعة الزيارات", icon: "print", tone: "primary" },
  { route: "report-daily-analysis", label: "تحليل يومي", subtitle: "تفاصيل اليوم والمؤشرات", icon: "analytics", tone: "success" },
  { route: "report-search", label: "بحث شامل", subtitle: "البحث في كل الزيارات", icon: "manage-search", tone: "warning" },
  { route: "report-monthly", label: "شهري حسب المندوب", subtitle: "مقارنة الأداء الشهري", icon: "date-range", tone: "primary" },
  { route: "report-total", label: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الأداء", icon: "summarize", tone: "error" },
  { route: "report-calendar", label: "تقويم", subtitle: "توزيع الزيارات والإجازات", icon: "calendar-month", tone: "success" },
  { route: "report-representatives", label: "للمندوبين متنوع", subtitle: "تفصيل حسب المندوب", icon: "people", tone: "warning" },
];

type ReportCardProps = {
  option: ReportOption;
  colors: ThemeColorPalette;
  accent: string;
  compact: boolean;
  onPress: () => void;
};

function ReportCard({ option, colors, accent, compact, onPress }: ReportCardProps) {
  const cardScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.82)).current;
  const iconBoxSize = compact ? 62 : 72;
  const iconRadius = compact ? 21 : 24;
  const iconInnerRadius = compact ? 16 : 19;

  const animatePress = (pressed: boolean) => {
    Animated.parallel([
      Animated.timing(cardScale, { toValue: pressed ? 0.975 : 1, duration: pressed ? 90 : 140, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: pressed ? 1 : 0.82, duration: pressed ? 90 : 180, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animatePress(true)}
        onPressOut={() => animatePress(false)}
        accessibilityRole="button"
        accessibilityLabel={`فتح تقرير ${option.label}`}
        accessibilityHint="اضغط لفتح التقرير"
        style={({ pressed }) => [
          {
            minHeight: compact ? 140 : 158,
            borderRadius: compact ? 17 : 20,
            borderWidth: 1.5,
            borderColor: `${accent}66`,
            backgroundColor: colors.surface,
            padding: compact ? 9 : 12,
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: accent,
            shadowOpacity: 0.08,
            shadowRadius: compact ? 5 : 7,
            shadowOffset: { width: 0, height: compact ? 2 : 3 },
            elevation: 2,
          },
          pressed && { opacity: 0.94, backgroundColor: `${accent}0D` },
        ]}
      >
        <Animated.View
          style={{
            width: iconBoxSize,
            height: iconBoxSize,
            borderRadius: iconRadius,
            borderWidth: compact ? 2 : 2.5,
            borderColor: accent,
            backgroundColor: colors.surface,
            padding: compact ? 2.5 : 3,
            shadowColor: accent,
            shadowOpacity: 0.26,
            shadowRadius: compact ? 6 : 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
            opacity: ringOpacity,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: iconInnerRadius,
              backgroundColor: accent,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: colors.foreground,
            }}
          >
            <View style={{ position: "absolute", width: compact ? 46 : 54, height: compact ? 46 : 54, borderRadius: compact ? 23 : 27, right: compact ? -17 : -19, top: compact ? -17 : -19, backgroundColor: "rgba(255,255,255,0.20)" }} />
            <View style={{ position: "absolute", width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius: compact ? 15 : 18, left: compact ? -10 : -12, bottom: compact ? -10 : -12, backgroundColor: "rgba(0,0,0,0.10)" }} />
            <MaterialIcons name={option.icon} size={compact ? 28 : 32} color={colors.background} />
          </View>
        </Animated.View>
        <View className="items-center">
          <Text style={{ color: colors.foreground, fontSize: compact ? 13 : 14, fontWeight: "800", textAlign: "center" }} numberOfLines={2}>{option.label}</Text>
          <Text style={{ color: colors.muted, fontSize: compact ? 9 : 10, textAlign: "center", marginTop: compact ? 3 : 5 }} numberOfLines={2}>{option.subtitle}</Text>
        </View>
        <View style={{ width: compact ? 24 : 30, height: 4, borderRadius: 5, backgroundColor: accent, opacity: 0.7 }} />
      </Pressable>
    </Animated.View>
  );
}

export default function ReportsScreen() {
  const router = useRouter();
  const { session } = useAccountSession();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const columns = width >= 700 ? 3 : 2;

  if (session?.role !== "manager") {
    return (
      <ScreenContainer className="px-5">
        <View className="flex-1 items-center justify-center">
          <MaterialIcons name="lock" size={42} color={colors.error} />
          <Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text>
          <Text className="text-sm text-muted text-center mt-2">لا يملك حساب المندوب صلاحية عرض التقارير.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="التقارير" subtitle="اختر نوع التقرير لعرض البيانات وتحليلها" icon="assessment" showBack />
        <View className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-5 flex-row-reverse items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="dashboard" size={22} color={colors.background} /></View>
          <View className="flex-1 items-end"><Text className="font-bold text-primary text-right">مركز التقارير</Text><Text className="text-xs text-muted text-right mt-1">اختر بطاقة للانتقال مباشرة إلى التقرير المطلوب.</Text></View>
        </View>
        <View className="flex-row-reverse flex-wrap" style={{ marginHorizontal: -6 }}>
          {REPORT_OPTIONS.map((option) => (
            <View key={option.route} style={{ width: `${100 / columns}%`, paddingHorizontal: 6, marginBottom: compact ? 9 : 12 }}>
              <ReportCard option={option} colors={colors} accent={colors[option.tone]} compact={compact} onPress={() => router.push(`/(tabs)/${option.route}` as never)} />
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
