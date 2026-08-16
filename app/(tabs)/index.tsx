import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate, visitsForDate } from "@/lib/visit-utils";

export default function HomeScreen() {
  const { data, loading } = useVisitStore();
  const todayVisits = visitsForDate(data.visits, new Date());
  const activeReps = data.representatives.filter((rep) => rep.active);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="مدير الزيارات الطبية" subtitle="متابعة ميدانية منظمة وواضحة" icon="medical-services" />

        <View className="rounded-3xl bg-primary p-5 mb-5 overflow-hidden">
          <View className="flex-row-reverse items-start justify-between">
            <View className="items-end flex-1">
              <Text className="text-white/75 font-semibold text-right">مرحباً، {data.settings.managerName}</Text>
              <Text className="text-white text-2xl font-bold mt-1 text-right">ملخص اليوم</Text>
              <Text className="text-white/80 mt-2 text-sm text-right">{new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-white/15 items-center justify-center">
              <MaterialIcons name="insights" size={26} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View className="flex-row-reverse gap-3 mb-6">
          <MetricCard label="زيارات اليوم" value={loading ? "—" : todayVisits.length} icon="event-available" />
          <MetricCard label="الجهات المسجلة" value={loading ? "—" : data.entities.length} icon="local-hospital" tone="success" />
          <MetricCard label="المندوبون" value={activeReps.length} icon="groups" tone="warning" />
        </View>

        <Pressable
          onPress={() => router.push("/record")}
          className="rounded-2xl bg-primary p-5 mb-6 flex-row-reverse items-center justify-between"
          style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 }]}
        >
          <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
            <MaterialIcons name="add-location-alt" size={24} color="#FFFFFF" />
          </View>
          <View className="items-end flex-1 mr-3">
            <Text className="text-white text-lg font-bold">تسجيل زيارة جديدة</Text>
            <Text className="text-white/75 text-sm mt-1">يُسجّل الوقت والموقع عند التأكيد</Text>
          </View>
          <MaterialIcons name="arrow-back-ios" size={17} color="#FFFFFF" />
        </Pressable>

        <View className="flex-row-reverse items-center justify-between mb-3">
          <Text className="text-lg font-bold text-foreground">آخر الزيارات</Text>
          <Pressable onPress={() => router.push("/visits")} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text className="text-primary font-bold">عرض الكل</Text>
          </Pressable>
        </View>

        {todayVisits.length === 0 ? (
          <View className="rounded-2xl bg-surface border border-border p-5 items-center">
            <View className="w-11 h-11 rounded-2xl bg-primary/10 items-center justify-center mb-3">
              <MaterialIcons name="event-note" size={23} color="#1565C0" />
            </View>
            <Text className="font-bold text-foreground">لا توجد زيارات مسجلة اليوم</Text>
            <Text className="text-sm text-muted text-center mt-1">ابدأ بإضافة جهة ثم سجّل أول زيارة.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {todayVisits.slice(0, 3).map((visit) => (
              <View key={visit.id} className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                </View>
                <View className="items-end flex-1">
                  <Text className="font-bold text-foreground text-right">{visit.entityName}</Text>
                  <Text className="text-xs text-muted mt-1 text-right">{visit.entityKind} · {formatArabicDate(visit.recordedAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
