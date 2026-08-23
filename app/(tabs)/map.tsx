import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { InteractiveMap } from "@/components/interactive-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { useAccountSession } from "@/lib/account-session";
import { getEntitiesForRepresentative } from "@/lib/representative-scope";
import { ENTITY_KINDS } from "@/lib/visit-utils";
import type { Visit, VisitLocation } from "@/shared/visit-types";

const ALL = "الكل";
type Filter = typeof ALL | string;

export default function MapScreen() {
  const { data } = useVisitStore();
  const { session } = useAccountSession();
  const currentRepresentative = session?.representativeId ? data.representatives.find((item) => item.id === session.representativeId) : undefined;
  const scopedEntities = session?.role === "manager" ? data.entities : getEntitiesForRepresentative(data.entities, currentRepresentative);
  const [representativeFilter, setRepresentativeFilter] = useState<Filter>(ALL);
  const [kindFilter, setKindFilter] = useState<Filter>(ALL);
  const [representativeModal, setRepresentativeModal] = useState(false);
  const [kindModal, setKindModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<VisitLocation | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<(typeof data.entities)[number] | null>(null);

  const mappedEntities = useMemo(() => scopedEntities.filter((entity) => entity.geographicCoordinates && Number.isFinite(entity.geographicCoordinates.latitude) && Number.isFinite(entity.geographicCoordinates.longitude)), [scopedEntities]);
  const visibleEntities = useMemo(() => mappedEntities.filter((entity) => kindFilter === ALL || entity.kind === kindFilter), [kindFilter, mappedEntities]);
  const mappedVisits = useMemo(() => data.visits.filter((visit) => visit.location && (session?.role === "manager" || scopedEntities.some((entity) => entity.id === visit.entityId))), [data.visits, scopedEntities, session?.role]);
  const visibleVisits = useMemo(() => mappedVisits.filter((visit) => {
    const representativeMatches = representativeFilter === ALL || visit.representativeId === representativeFilter;
    const kindMatches = kindFilter === ALL || visit.entityKind === kindFilter;
    return representativeMatches && kindMatches;
  }), [kindFilter, mappedVisits, representativeFilter]);

  const initialRegion = useMemo(() => {
    const first = visibleEntities[0]?.geographicCoordinates ?? visibleVisits[0]?.location;
    if (!first) return { latitude: 15.3694, longitude: 44.191, latitudeDelta: 0.18, longitudeDelta: 0.18 };
    return { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }, [visibleEntities, visibleVisits]);

  const representativeOptions = [{ label: ALL, value: ALL }, ...data.representatives.map((item) => ({ label: item.name, value: item.id }))];
  const kindOptions = [{ label: ALL, value: ALL }, ...ENTITY_KINDS.map((item) => ({ label: item, value: item }))];
  const selectedRepresentativeLabel = representativeOptions.find((item) => item.value === representativeFilter)?.label ?? ALL;

  const locateRepresentative = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("يلزم إذن الموقع", "اسمح بالوصول إلى الموقع لعرض موقع المندوب الحالي."); return; }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLocation({ latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy });
    } catch { Alert.alert("تعذر تحديد الموقع", "تحقق من تشغيل GPS ثم أعد المحاولة."); }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="خريطة الزيارات" subtitle="تتبّع مواقع الجهات الطبية الموثقة" icon="map" />
        <View className="flex-row-reverse gap-3 mb-4">
          <Pressable onPress={() => setRepresentativeModal(true)} className="flex-1 h-12 rounded-2xl border border-border bg-surface px-3 flex-row-reverse items-center justify-between"><Text className="text-foreground font-bold text-xs" numberOfLines={1}>{selectedRepresentativeLabel}</Text><MaterialIcons name="person" size={18} color="#102A43" /></Pressable>
          <Pressable onPress={() => setKindModal(true)} className="flex-1 h-12 rounded-2xl border border-border bg-surface px-3 flex-row-reverse items-center justify-between"><Text className="text-foreground font-bold text-xs" numberOfLines={1}>{kindFilter}</Text><MaterialIcons name="category" size={18} color="#102A43" /></Pressable>
        </View>
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-3 mb-4 flex-row-reverse items-center gap-2"><MaterialIcons name="location-on" size={20} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm font-semibold">{visibleEntities.length} جهة طبية بإحداثيات · {visibleVisits.length} زيارة موثّقة</Text></View>
        <View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={locateRepresentative} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="my-location" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">عرض موقع المندوب</Text></Pressable><View className="flex-1 h-11 rounded-xl bg-success/10 border border-success/30 items-center justify-center"><Text className="text-success font-bold text-xs">النطاق: {data.settings.geofenceRadiusMeters}م</Text></View></View>
        <View className="h-[430px] overflow-hidden rounded-2xl border border-border mb-4"><InteractiveMap visits={visibleVisits} entities={visibleEntities} representatives={data.representatives} initialRegion={initialRegion} currentLocation={currentLocation} targetLocation={selectedEntity?.geographicCoordinates ?? selectedVisit?.geographicCoordinates ?? null} allowedRadiusMeters={data.settings.geofenceRadiusMeters} targetTitle={selectedEntity?.name ?? selectedVisit?.entityName} /></View>
        {visibleEntities.length > 0 || visibleVisits.length > 0 ? (
          <View className="rounded-2xl bg-surface border border-border p-4">
            {visibleEntities.length > 0 ? <><Text className="font-bold text-foreground text-right mb-3">الجهات الطبية ذات الإحداثيات</Text>{visibleEntities.slice(0, 30).map((entity) => <Pressable key={entity.id} onPress={() => { setSelectedEntity(entity); setSelectedVisit(null); }} style={{ paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}><View className={`w-9 h-9 rounded-xl items-center justify-center ${entity.kind === "صيدلية" ? "bg-warning" : "bg-primary"}`}><MaterialIcons name={entity.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={18} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{entity.name}</Text><Text className="text-xs text-muted mt-1 text-right">{entity.kind} · {entity.region === "south" ? "جنوب صنعاء" : entity.region === "north" ? "شمال صنعاء" : "صنعاء"}{entity.nearestPharmacy ? ` · ${entity.nearestPharmacy}` : ""}</Text></View></Pressable>)}</> : null}
            {visibleVisits.length > 0 ? <><Text className="font-bold text-foreground text-right mb-3 mt-4">الزيارات الظاهرة</Text>
            {visibleVisits.slice(0, 12).map((visit) => (
              <Pressable key={visit.id} onPress={() => { setSelectedVisit(visit); setSelectedEntity(null); }} style={{ paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                <View className="w-9 h-9 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="place" size={18} color="#FFFFFF" /></View>
                <View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{visit.entityName}</Text><Text className="text-xs text-muted mt-1 text-right">{visit.entityKind}</Text></View>
              </Pressable>
            ))}</> : null}
          </View>
        ) : (
          <View className="rounded-2xl bg-surface border border-border p-6 items-center"><MaterialIcons name="location-off" size={34} color="#64748B" /><Text className="font-bold text-foreground mt-3 text-center">لا توجد زيارات بإحداثيات حتى الآن</Text><Text className="text-sm text-muted mt-1 text-center">سجّل زيارة جديدة واضغط «التقاط الموقع والوقت» لتظهر علامتها هنا.</Text></View>
        )}
      </ScrollView>
      <SelectionModal visible={representativeModal} title="فلترة حسب المندوب" options={representativeOptions} selected={representativeFilter} onClose={() => setRepresentativeModal(false)} onSelect={(option) => setRepresentativeFilter(option.value)} />
      <SelectionModal visible={kindModal} title="فلترة حسب نوع الجهة" options={kindOptions} selected={kindFilter} onClose={() => setKindModal(false)} onSelect={(option) => setKindFilter(option.value)} />
    </ScreenContainer>
  );
}
