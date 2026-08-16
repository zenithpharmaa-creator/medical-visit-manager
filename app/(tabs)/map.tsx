import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { InteractiveMap } from "@/components/interactive-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { ENTITY_KINDS } from "@/lib/visit-utils";

const ALL = "الكل";

type Filter = typeof ALL | string;

export default function MapScreen() {
  const { data } = useVisitStore();
  const [representativeFilter, setRepresentativeFilter] = useState<Filter>(ALL);
  const [kindFilter, setKindFilter] = useState<Filter>(ALL);
  const [representativeModal, setRepresentativeModal] = useState(false);
  const [kindModal, setKindModal] = useState(false);

  const mappedVisits = useMemo(() => data.visits.filter((visit) => visit.location), [data.visits]);
  const visibleVisits = useMemo(() => mappedVisits.filter((visit) => {
    const representativeMatches = representativeFilter === ALL || visit.representativeId === representativeFilter;
    const kindMatches = kindFilter === ALL || visit.entityKind === kindFilter;
    return representativeMatches && kindMatches;
  }), [kindFilter, mappedVisits, representativeFilter]);

  const initialRegion = useMemo(() => {
    const first = visibleVisits[0]?.location;
    if (!first) return { latitude: 24.7136, longitude: 46.6753, latitudeDelta: 0.18, longitudeDelta: 0.18 };
    return { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }, [visibleVisits]);

  const representativeOptions = [{ label: ALL, value: ALL }, ...data.representatives.map((item) => ({ label: item.name, value: item.id }))];
  const kindOptions = [{ label: ALL, value: ALL }, ...ENTITY_KINDS.map((item) => ({ label: item, value: item }))];
  const selectedRepresentativeLabel = representativeOptions.find((item) => item.value === representativeFilter)?.label ?? ALL;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="خريطة الزيارات" subtitle="تتبّع مواقع العيادات والصيدليات والجهات الموثقة" icon="map" />
        <View className="flex-row-reverse gap-3 mb-4">
          <Pressable onPress={() => setRepresentativeModal(true)} className="flex-1 h-12 rounded-2xl border border-border bg-surface px-3 flex-row-reverse items-center justify-between" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><Text className="text-foreground font-bold text-xs" numberOfLines={1}>{selectedRepresentativeLabel}</Text><MaterialIcons name="person" size={18} color="#102A43" /></Pressable>
          <Pressable onPress={() => setKindModal(true)} className="flex-1 h-12 rounded-2xl border border-border bg-surface px-3 flex-row-reverse items-center justify-between" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><Text className="text-foreground font-bold text-xs" numberOfLines={1}>{kindFilter}</Text><MaterialIcons name="category" size={18} color="#102A43" /></Pressable>
        </View>
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-3 mb-4 flex-row-reverse items-center gap-2"><MaterialIcons name="location-on" size={20} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm font-semibold">{visibleVisits.length} موقع زيارة موثّق ظاهر على الخريطة</Text></View>
        <View className="h-[430px] overflow-hidden rounded-2xl border border-border mb-4"><InteractiveMap visits={visibleVisits} representatives={data.representatives} initialRegion={initialRegion} /></View>
        {visibleVisits.length > 0 ? <View className="rounded-2xl bg-surface border border-border p-4"><Text className="font-bold text-foreground text-right mb-3">الزيارات الظاهرة</Text>{visibleVisits.slice(0, 12).map((visit) => <View key={visit.id} className="flex-row-reverse items-center gap-3 py-3 border-b border-border last:border-b-0"><View className="w-9 h-9 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="place" size={18} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{visit.entityName}</Text><Text className="text-xs text-muted mt-1 text-right">{visit.entityKind}{visit.geographicLocation ? ` · ${visit.geographicLocation}` : ""}</Text></View></View>)}</View> : <View className="rounded-2xl bg-surface border border-border p-6 items-center"><MaterialIcons name="location-off" size={34} color="#64748B" /><Text className="font-bold text-foreground mt-3 text-center">لا توجد زيارات بإحداثيات حتى الآن</Text><Text className="text-sm text-muted mt-1 text-center">سجّل زيارة جديدة واضغط «التقاط الموقع والوقت» لتظهر علامتها هنا.</Text></View>}
      </ScrollView>
      <SelectionModal visible={representativeModal} title="فلترة حسب المندوب" options={representativeOptions} selected={representativeFilter} onClose={() => setRepresentativeModal(false)} onSelect={(option) => setRepresentativeFilter(option.value)} />
      <SelectionModal visible={kindModal} title="فلترة حسب نوع الجهة" options={kindOptions} selected={kindFilter} onClose={() => setKindModal(false)} onSelect={(option) => setKindFilter(option.value)} />
    </ScreenContainer>
  );
}
