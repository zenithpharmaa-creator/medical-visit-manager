import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import { FlatList, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";

export default function OverrideReportsScreen() {
  const { data } = useVisitStore();
  const overrides = useMemo(() => data.visits.filter((visit) => visit.managerOverride).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [data.visits]);
  const representativeName = (id: string) => data.representatives.find((item) => item.id === id)?.name ?? "غير محدد";

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={overrides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 30, gap: 12, flexGrow: 1 }}
        ListHeaderComponent={<><ScreenHeader title="تقرير تجاوزات الموقع" subtitle="زيارات اعتمدها مدير النظام خارج النطاق" icon="gpp-maybe" /><View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-2 flex-row-reverse items-center gap-3"><MaterialIcons name="warning" size={24} color="#D97706" /><View className="flex-1 items-end"><Text className="text-warning font-bold text-lg">{overrides.length}</Text><Text className="text-muted text-xs text-right">إجمالي الزيارات التي تم تجاوز شرط موقعها</Text></View></View></>}
        ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-7 items-center mt-3"><MaterialIcons name="verified" size={34} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد تجاوزات مسجلة</Text><Text className="text-sm text-muted mt-1 text-center">ستظهر الزيارات هنا عند استخدام صلاحية مدير النظام.</Text></View>}
        renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-warning/30 p-4"><View className="flex-row-reverse items-start gap-3"><View className="w-10 h-10 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="gpp-maybe" size={21} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.entityName}</Text><Text className="text-xs text-primary mt-1 text-right">{item.entityKind} · {representativeName(item.representativeId)}</Text></View></View><View className="border-t border-border mt-3 pt-3 gap-2"><Text className="text-xs text-muted text-right">الوقت: {formatArabicDate(item.recordedAt)}</Text><Text className="text-sm text-foreground text-right"><Text className="font-bold">سبب التجاوز: </Text>{item.overrideReason || "غير مسجل"}</Text><Text className="text-xs text-muted text-right">الموقع الحالي والجهة تم حفظهما مع الزيارة</Text></View></View>}
      />
    </ScreenContainer>
  );
}
