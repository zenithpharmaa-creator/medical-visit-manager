import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useVisitStore } from "@/lib/visit-store";

const options = [
  { label: "جهات الزيارة", subtitle: "العيادات والصيدليات والمستشفيات والمراكز", icon: "local-hospital" as const, route: "/entities" },
  { label: "المندوبون", subtitle: "تعديل أسماء المندوبين وحالتهم", icon: "groups" as const, route: "/settings" },
  { label: "إعدادات التقارير", subtitle: "البريد والتذكير والنسخة الاحتياطية", icon: "settings" as const, route: "/settings" },
  { label: "خريطة الزيارات", subtitle: "عرض مواقع الزيارات الموثقة حسب المندوب والجهة", icon: "map" as const, route: "/map" },
];

export default function ManagementScreen() {
  const { data } = useVisitStore();
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="الإدارة" subtitle="بيانات المندوبين والجهات والإعدادات" icon="admin-panel-settings" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="group" size={20} color="#FFFFFF" /></View>
          <View className="items-end flex-1"><Text className="font-bold text-primary">فريق الزيارات</Text><Text className="text-sm text-muted mt-1">{data.representatives.filter((rep) => rep.active).length} مندوبين نشطين · {data.entities.length} جهة</Text></View>
        </View>
        <View className="gap-3">
          {options.map((option) => (
            <Pressable key={option.label} onPress={() => router.push(option.route as never)} className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
              <View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name={option.icon} size={22} color="#FFFFFF" /></View>
              <View className="items-end flex-1"><Text className="font-bold text-foreground text-right">{option.label}</Text><Text className="text-xs text-muted mt-1 text-right">{option.subtitle}</Text></View>
              <MaterialIcons name="chevron-left" size={23} color="#64748B" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
