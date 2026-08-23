import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Keyboard, Linking, Pressable, ScrollView, Text, View, Alert } from "react-native";

import { InteractiveMap } from "@/components/interactive-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { rankEntitiesForSearch } from "@/lib/entity-search";
import { ENTITY_KINDS } from "@/lib/visit-utils";
import { useVisitStore } from "@/lib/visit-store";
import { useAccountSession } from "@/lib/account-session";
import { getEntitiesForRepresentative } from "@/lib/representative-scope";
import type { MedicalEntity } from "@/shared/visit-types";

export default function SearchScreen() {
  const { data } = useVisitStore();
  const { session } = useAccountSession();
  const currentRepresentative = session?.representativeId ? data.representatives.find((item) => item.id === session.representativeId) : undefined;
  const scopedEntities = session?.role === "manager" ? data.entities : getEntitiesForRepresentative(data.entities, currentRepresentative);
  const [query, setQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<MedicalEntity | null>(null);
  const [kindFilter, setKindFilter] = useState("الكل");
  const [regionFilter, setRegionFilter] = useState("all");
  const [entityPickerVisible, setEntityPickerVisible] = useState(false);

  const mappedEntities = useMemo(
    () => scopedEntities.filter((entity) => {
      const coordinates = entity.geographicCoordinates;
      return coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
    }),
    [scopedEntities],
  );
  const filteredEntities = useMemo(() => scopedEntities.filter((entity) => {
    const kindMatches = kindFilter === "الكل" || entity.kind === kindFilter;
    const regionMatches = regionFilter === "all" || entity.region === regionFilter;
    return kindMatches && regionMatches;
  }), [scopedEntities, kindFilter, regionFilter]);
  const suggestions = useMemo(() => rankEntitiesForSearch(filteredEntities, query), [filteredEntities, query]);
  const entityPickerOptions = useMemo(() => suggestions.map((entity) => ({
    label: entity.name,
    value: entity.id,
    helper: [entity.kind, entity.address ? `العنوان: ${entity.address}` : "العنوان: غير مسجل", entity.nearestPharmacy ? `أقرب صيدلية: ${entity.nearestPharmacy}` : "أقرب صيدلية: غير محددة", entity.geographicLocation ? `الموقع: ${entity.geographicLocation}` : ""].filter(Boolean).join(" · "),
  })), [suggestions]);

  const selectEntity = (entity: MedicalEntity) => {
    Keyboard.dismiss();
    setSelectedEntity(entity);
    setQuery("");
    setEntityPickerVisible(false);
  };
  const openExternalMap = async (entity: MedicalEntity) => {
    const coordinates = entity.geographicCoordinates;
    if (!coordinates) { Alert.alert("لا توجد إحداثيات", "لا يمكن فتح الخريطة لهذه الجهة قبل إضافة موقعها."); return; }
    const query = encodeURIComponent(`${coordinates.latitude},${coordinates.longitude} ${entity.name}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try { await Linking.openURL(url); } catch { Alert.alert("تعذر فتح الخرائط", "افتح تطبيق الخرائط يدوياً ثم ابحث باستخدام الإحداثيات الظاهرة."); }
  };
  const selectedCoordinates = selectedEntity?.geographicCoordinates;
  const initialRegion = selectedCoordinates
    ? { latitude: selectedCoordinates.latitude, longitude: selectedCoordinates.longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 }
    : { latitude: 15.3694, longitude: 44.191, latitudeDelta: 0.18, longitudeDelta: 0.18 };


  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="flex-1">
        <ScreenHeader title="بحث" subtitle="ابحث عن جهة محفوظة واعرض موقعها على الخريطة" icon="search" />
        <View className="rounded-2xl bg-surface border border-primary/30 p-3 mb-3">
          <Pressable onPress={() => { setQuery(""); setEntityPickerVisible(true); }} className="min-h-14 rounded-xl border border-primary bg-background px-3 py-2 flex-row-reverse items-center gap-3" accessibilityRole="button" accessibilityLabel="فتح البحث عن جهة محفوظة" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}>
            <MaterialIcons name="search" size={22} color="#1257A6" />
            <View className="flex-1 items-end">
              <Text className={`font-bold text-right ${selectedEntity ? "text-foreground" : "text-muted"}`}>{selectedEntity?.name || "اضغط للبحث عن جهة محفوظة"}</Text>
              <Text className="text-[11px] text-muted text-right mt-1">{suggestions.length} جهات متاحة — اكتب الأحرف الأولى داخل القائمة</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" />
          </Pressable>
          <Text className="text-xs text-muted text-right mt-2">ستظهر النتائج في قائمة منسدلة أثناء الكتابة باسم الجهة أو العنوان أو أقرب صيدلية.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 7, paddingTop: 10 }} keyboardShouldPersistTaps="handled"><Pressable onPress={() => setKindFilter("الكل")} className={`rounded-full px-3 py-2 ${kindFilter === "الكل" ? "bg-primary" : "bg-background border border-border"}`}><Text className={kindFilter === "الكل" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>كل الأنواع</Text></Pressable>{ENTITY_KINDS.map((kind) => <Pressable key={kind} onPress={() => setKindFilter(kind)} className={`rounded-full px-3 py-2 ${kindFilter === kind ? "bg-primary" : "bg-background border border-border"}`}><Text className={kindFilter === kind ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>{kind}</Text></Pressable>)}</ScrollView>
          <View className="flex-row-reverse gap-2 mt-2"><Pressable onPress={() => setRegionFilter("all")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "all" ? "bg-foreground" : "bg-background border border-border"}`}><Text className={regionFilter === "all" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>كل المناطق</Text></Pressable><Pressable onPress={() => setRegionFilter("north")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "north" ? "bg-primary" : "bg-background border border-border"}`}><Text className={regionFilter === "north" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>شمال صنعاء</Text></Pressable><Pressable onPress={() => setRegionFilter("south")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "south" ? "bg-warning" : "bg-background border border-border"}`}><Text className={regionFilter === "south" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>جنوب صنعاء</Text></Pressable></View>
        </View>
        <View className="rounded-2xl overflow-hidden border border-border bg-surface mb-3" style={{ height: 330 }}>
          {selectedEntity?.geographicCoordinates ? <InteractiveMap key={selectedEntity.id} visits={[]} entities={mappedEntities} representatives={data.representatives} initialRegion={initialRegion} targetLocation={selectedEntity.geographicCoordinates} targetTitle={selectedEntity.name} /> : <View className="flex-1 items-center justify-center px-6"><MaterialIcons name="map" size={42} color="#7C8798" /><Text className="font-bold text-foreground text-center mt-3">اختر جهة لعرض موقعها</Text><Text className="text-sm text-muted text-center mt-1">ستنتقل الخريطة تلقائياً إلى إحداثيات الجهة عند اختيارها.</Text></View>}
        </View>
        {selectedEntity?.geographicCoordinates ? <Pressable onPress={() => void openExternalMap(selectedEntity)} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2 mb-3"><MaterialIcons name="open-in-new" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">فتح الموقع في تطبيق الخرائط</Text></Pressable> : null}
        <View className="rounded-2xl bg-surface border border-border p-4 mb-3">
          <View className="flex-row-reverse items-center justify-between mb-2"><Text className="font-bold text-foreground text-right">الجهة المختارة</Text><Text className="text-xs text-primary font-bold">{suggestions.length} جهات متاحة</Text></View>
          {selectedEntity ? <View className="items-end"><Text className="font-bold text-foreground text-right">{selectedEntity.name}</Text><Text className="text-xs text-muted text-right mt-1">{selectedEntity.kind}{selectedEntity.specialty ? ` · ${selectedEntity.specialty}` : ""}</Text><Text className="text-xs text-muted text-right mt-1">{selectedEntity.address ? `العنوان: ${selectedEntity.address}` : "العنوان: غير مسجل"}</Text><Text className="text-xs text-muted text-right mt-1">{selectedEntity.nearestPharmacy ? `أقرب صيدلية: ${selectedEntity.nearestPharmacy}` : "أقرب صيدلية: غير محددة"}</Text></View> : <Text className="text-sm text-muted text-right">اضغط على حقل البحث بالأعلى لعرض الجهات في قائمة منسدلة واختيار جهة لعرض موقعها.</Text>}
        </View>
        <SelectionModal visible={entityPickerVisible} title="بحث عن جهة محفوظة" options={entityPickerOptions} selected={selectedEntity?.id} onClose={() => setEntityPickerVisible(false)} onSelect={(option) => { const entity = suggestions.find((item) => item.id === option.value); if (entity) selectEntity(entity); }} searchable searchValue={query} onSearchChange={setQuery} searchPlaceholder="اكتب الأحرف الأولى أو ابحث بالعنوان أو أقرب صيدلية" />
      </View>
    </ScreenContainer>
  );
}
