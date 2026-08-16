import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate, visitsForDate } from "@/lib/visit-utils";
import { monthlyOverrideCounts } from "@/lib/override-report";

export default function HomeScreen() {
  const { data, loading } = useVisitStore();
  const { logout } = useAccountSession();
  const todayVisits = visitsForDate(data.visits, new Date());
  const activeReps = data.representatives.filter((rep) => rep.active);
  const monthlyOverrides = monthlyOverrideCounts(data.visits, data.representatives);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPlanned = data.plannedVisits.filter((item) => item.scheduledDate === todayKey);
  const todayOverrides = todayVisits.filter((visit) => visit.managerOverride).length;
  const plannedCompleted = todayPlanned.filter((plan) => todayVisits.some((visit) => visit.representativeId === plan.representativeId && visit.entityId === plan.entityId)).length;
  const remainingVisits = Math.max(0, todayPlanned.length - plannedCompleted);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="لوحة التحكم" subtitle="متابعة يومية سريعة لحالة الزيارات ونشاط الفريق" icon="dashboard" showBack={false} actionLabel="دخول الحساب" actionIcon="login" onAction={() => { void logout(); }} />

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

        <View className="flex-row-reverse gap-3 mb-3">
          <MetricCard label="منفذة اليوم" value={loading ? "—" : todayVisits.length} icon="event-available" />
          <MetricCard label="مخططة اليوم" value={loading ? "—" : todayPlanned.length} icon="event-note" tone="success" />
          <MetricCard label="المتبقي" value={loading ? "—" : remainingVisits} icon="pending-actions" tone="warning" />
        </View>
        <View className="flex-row-reverse gap-3 mb-6">
          <MetricCard label="تجاوزات اليوم" value={loading ? "—" : todayOverrides} icon="gpp-maybe" tone="warning" />
          <MetricCard label="الجهات المسجلة" value={loading ? "—" : data.entities.length} icon="local-hospital" tone="success" />
          <MetricCard label="المندوبون النشطون" value={activeReps.length} icon="groups" tone="primary" />
        </View>

        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-6"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="text-lg font-bold text-primary">تقدم خطة اليوم</Text><MaterialIcons name="trending-up" size={22} color="#1565C0" /></View><Text className="text-sm text-muted text-right mb-3">تم تنفيذ {plannedCompleted} من أصل {todayPlanned.length} زيارة مخططة لهذا اليوم.</Text><View className="h-3 rounded-full bg-white/70 overflow-hidden"><View className="h-3 rounded-full bg-primary" style={{ width: `${todayPlanned.length ? Math.min(100, (plannedCompleted / todayPlanned.length) * 100) : 0}%` }} /></View></View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-6"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="text-lg font-bold text-foreground">نشاط المندوبين اليوم</Text><MaterialIcons name="groups" size={22} color="#1565C0" /></View><Text className="text-xs text-muted text-right mb-4">الزيارات المنفذة والمهام المسندة لكل مندوب</Text><View className="gap-3">{activeReps.map((rep) => { const visits = todayVisits.filter((visit) => visit.representativeId === rep.id).length; const assigned = data.plannedVisits.filter((task) => task.scheduledDate === todayKey && task.representativeId === rep.id && task.assignmentType === "assigned").length; return <View key={rep.id} className="rounded-xl bg-background border border-border p-3"><View className="flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{rep.name}</Text><View className="flex-row-reverse gap-2"><Text className="text-xs text-success font-bold">منفذة: {visits}</Text><Text className="text-xs text-primary font-bold">مسندة: {assigned}</Text></View></View><View className="h-2 rounded-full bg-border mt-2 overflow-hidden"><View className="h-2 rounded-full bg-success" style={{ width: `${todayPlanned.length ? Math.min(100, (visits / Math.max(1, todayPlanned.filter((item) => item.representativeId === rep.id).length)) * 100) : visits ? 100 : 0}%` }} /></View></View>; })}</View></View>

        <View className="rounded-2xl bg-surface border border-border p-4 mb-6"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="text-lg font-bold text-foreground">تجاوزات الموقع هذا الشهر</Text><MaterialIcons name="bar-chart" size={22} color="#D97706" /></View><Text className="text-xs text-muted text-right mb-4">نسبة تكرار التجاوزات بين المندوبين خلال الشهر الحالي</Text><View className="gap-3">{monthlyOverrides.map((item, index) => <View key={item.representative.id} className="flex-row-reverse items-center gap-2"><Text className="text-xs font-bold text-foreground w-20 text-right" numberOfLines={1}>{item.representative.name.replace("المندوب ", "مندوب ")}</Text><View className="flex-1 h-3 rounded-full bg-border overflow-hidden"><View className={`h-3 rounded-full ${index === 1 ? "bg-success" : index === 2 ? "bg-warning" : "bg-primary"}`} style={{ width: `${item.rate || (item.count ? 8 : 2)}%` }} /></View><Text className="text-xs font-bold text-muted w-12 text-left">{item.count} ({item.rate}%)</Text></View>)}</View></View>

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
