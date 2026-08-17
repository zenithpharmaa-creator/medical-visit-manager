import { Tabs } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAccountSession } from "@/lib/account-session";

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
      <Tabs.Screen name="reports" options={{ href: isManager ? undefined : null, title: "التقارير", tabBarIcon: ({ color }) => <IconSymbol name="chart.bar.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="weekly" options={{ title: "الخطة", tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={23} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ href: isManager ? undefined : null, title: "المهام", tabBarIcon: ({ color }) => <IconSymbol name="calendar" size={23} color={color} /> }} />
      <Tabs.Screen name="plan-approvals" options={{ href: null, title: "اعتماد الخطط" }} />
      <Tabs.Screen name="management" options={{ href: isManager ? undefined : null, title: "الإدارة", tabBarIcon: ({ color }) => <IconSymbol name="gearshape.fill" size={23} color={color} /> }} />
      <Tabs.Screen name="entities" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="override-reports" options={{ href: null }} />
      <Tabs.Screen name="rep-location" options={{ href: null }} />
    </Tabs>
  );
}
