import { Tabs, usePathname, useRouter } from "expo-router";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, Text, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAccountSession } from "@/lib/account-session";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

function ReportsTabButton({ style: tabStyle, accessibilityState }: BottomTabBarButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = accessibilityState?.selected === true || pathname.includes("/report");
  const iconColor = isActive ? "#1257A6" : "#64748B";
  return <Pressable onPress={() => router.push("/(tabs)/reports" as never)} accessibilityState={accessibilityState} accessibilityRole="tab" accessibilityLabel="فتح شاشة التقارير" style={({ pressed }) => [tabStyle, { flex: 1, height: "100%", minWidth: 0, paddingTop: 0, paddingBottom: 0, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: pressed ? "rgba(21,101,192,0.18)" : "transparent" }, isActive && { shadowColor: "#1257A6", shadowOpacity: Platform.OS === "web" ? 0.16 : 0.24, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: Platform.OS === "android" ? 4 : 0 }]}>
    <MaterialIcons name="assessment" size={23} color={iconColor} />
    <Text style={{ fontSize: 10, fontWeight: "700", color: iconColor, marginTop: 2 }}>التقارير</Text>
  </Pressable>;
}

export default function TabLayout() {
  const colors = useColors();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compactTabs = width < 390;
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.tint, tabBarInactiveTintColor: colors.muted, tabBarActiveBackgroundColor: "rgba(21, 101, 192, 0.12)", tabBarButton: HapticTab, tabBarLabelStyle: { fontWeight: "700", fontSize: compactTabs ? 8 : 10, lineHeight: compactTabs ? 10 : 12, maxWidth: compactTabs ? 48 : 64 }, tabBarItemStyle: { flex: 1, minWidth: 0, marginHorizontal: compactTabs ? 1 : 2, borderRadius: 14 }, tabBarStyle: { height: (compactTabs ? 54 : 58) + bottomPadding, paddingTop: compactTabs ? 4 : 6, paddingBottom: bottomPadding, backgroundColor: colors.background, borderTopColor: colors.border } }}>
      <Tabs.Screen name="index" options={{ href: isManager ? undefined : null, title: "الرئيسية", tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="record" options={{ title: "تسجيل", tabBarIcon: ({ color }) => <IconSymbol name="location.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="visits" options={{ title: "الزيارات", tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={23} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: "بحث", tabBarIcon: ({ color }) => <IconSymbol name="magnifyingglass" size={23} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ href: isManager ? undefined : null, title: "التقارير", tabBarButton: isManager ? (props) => <ReportsTabButton {...props} /> : undefined, tabBarIcon: ({ color }) => <IconSymbol name="chart.bar.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="weekly" options={{ title: "الخطة", tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={23} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ href: isManager ? undefined : null, title: "المهام", tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={23} color={color} /> }} />
      <Tabs.Screen name="plan-approvals" options={{ href: null, title: "اعتماد الخطط" }} />
      <Tabs.Screen name="management" options={{ href: isManager ? undefined : null, title: "الإدارة", tabBarIcon: ({ color }) => <IconSymbol name="gearshape.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="entities" options={{ href: null }} />
      <Tabs.Screen name="shared-locations" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="override-reports" options={{ href: null }} />
      <Tabs.Screen name="rep-location" options={{ href: null }} />
      <Tabs.Screen name="device-activation" options={{ href: null }} />
      <Tabs.Screen name="sync-history" options={{ href: null }} />
      <Tabs.Screen name="representative-scope" options={{ href: null }} />
      <Tabs.Screen name="representative-leaves" options={{ href: null, title: "إجازات المندوبين" }} />
      <Tabs.Screen name="missing-coordinates" options={{ href: null }} />
      <Tabs.Screen name="report-search" options={{ href: null, title: "بحث شامل" }} />
      <Tabs.Screen name="report-calendar" options={{ href: null, title: "تقويم" }} />
      <Tabs.Screen name="report-representatives" options={{ href: null, title: "للمندوبين متنوع" }} />
      <Tabs.Screen name="report-print" options={{ href: null, title: "طباعة" }} />
      <Tabs.Screen name="report-monthly" options={{ href: null, title: "شهري حسب المندوب" }} />
      <Tabs.Screen name="report-total" options={{ href: null, title: "إجمالي للمندوبين" }} />
      <Tabs.Screen name="report-daily-analysis" options={{ href: null, title: "تحليلي يومي" }} />
    </Tabs>
  );
}
