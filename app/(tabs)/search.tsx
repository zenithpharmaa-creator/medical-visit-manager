import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { FlatList, Keyboard, Linking, Pressable, ScrollView, Text, TextInput, View, Alert } from "react-native";

import { InteractiveMap } from "@/components/interactive-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { rankEntitiesForSearch } from "@/lib/entity-search";
import { ENTITY_KINDS } from "@/lib/visit-utils";
import { useVisitStore } from "@/lib/visit-store";
import type { MedicalEntity } from "@/shared/visit-types";

export default function SearchScreen() {
  const { data } = useVisitStore();
  const [query, setQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<MedicalEntity | null>(null);
  const [kindFilter, setKindFilter] = useState("الكل");
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchFocused, setSearchFocused] = useState(false);

  const mappedEntities = useMemo(
    () => data.entities.filter((entity) => {
      const coordinates = entity.geographicCoordinates;
      return coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
    }),
    [data.entities],
  );
  const filteredEntities = useMemo(() => data.entities.filter((entity) => {
    const kindMatches = kindFilter === "الكل" || entity.kind === kindFilter;
    const regionMatches = regionFilter === "all" || entity.region === regionFilter;
    return kindMatches && regionMatches;
  }), [data.entities, kindFilter, regionFilter]);
  const suggestions = useMemo(() => rankEntitiesForSearch(filteredEntities, query), [filteredEntities, query]);

  const selectEntity = (entity: MedicalEntity) => {
    Keyboard.dismiss();
    setSelectedEntity(entity);
    setQuery(entity.name);
    setSearchFocused(false);
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

  const renderEntityResult = ({ item }: { item: MedicalEntity }) => {
    const hasCoordinates = Boolean(item.geographicCoordinates);
    const active = selectedEntity?.id === item.id;
    return <Pressable onPress={() => selectEntity(item)} className={`rounded-xl border p-3 flex-row-reverse items-center gap-3 ${active ? "bg-primary/10 border-primary" : "bg-background border-border"}`} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><View className={`w-10 h-10 rounded-lg items-center justify-center ${hasCoordinates ? "bg-primary" : "bg-muted"}`}><MaterialIcons name={item.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={20} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-muted mt-1 text-right">{item.kind}{item.specialty ? ` · ${item.specialty}` : ""}</Text>{item.address ? <Text className="text-[11px] text-muted mt-1 text-right" numberOfLines={1}>العنوان: {item.address}</Text> : null}{item.nearestPharmacy ? <Text className="text-[11px] text-muted mt-1 text-right" numberOfLines={1}>أقرب صيدلية: {item.nearestPharmacy}</Text> : null}<Text className={`text-[11px] mt-1 text-right ${hasCoordinates ? "text-success" : "text-warning"}`}>{hasCoordinates ? (item.geographicLocation || "إحداثيات محفوظة") : "لا توجد إحداثيات محفوظة"}</Text></View><MaterialIcons name={active ? "check-circle" : "chevron-left"} size={21} color={active ? "#1257A6" : "#64748B"} /></Pressable>;
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="flex-1">
        <ScreenHeader title="بحث" subtitle="ابحث عن جهة محفوظة واعرض موقعها على الخريطة" icon="search" />
        <View className="rounded-2xl bg-surface border border-primary/30 p-3 mb-3">
          <View className="h-14 rounded-xl border border-primary bg-background px-3 flex-row-reverse items-center gap-2">
            <MaterialIcons name="search" size={22} color="#1257A6" />
            <TextInput
              value={query}
              onFocus={() => setSearchFocused(true)}
              onChangeText={(value) => { setQuery(value); setSearchFocused(true); if (selectedEntity && value !== selectedEntity.name) setSelectedEntity(null); }}
              placeholder="ابحث باسم الجهة أو العنوان أو أقرب صيدلية"
              placeholderTextColor="#7C8798"
              textAlign="right"
              autoCapitalize="none"
              returnKeyType="search"
              className="flex-1 h-full text-foreground font-semibold"
              accessibilityLabel="البحث عن جهة محفوظة"
            />
            {query ? <Pressable onPress={() => { setQuery(""); setSelectedEntity(null); Keyboard.dismiss(); setSearchFocused(false); }} className="w-9 h-9 rounded-lg bg-surface items-center justify-center" accessibilityRole="button" accessibilityLabel="مسح البحث"><MaterialIcons name="close" size={19} color="#64748B" /></Pressable> : null}
          </View>
          <Text className="text-xs text-muted text-right mt-2">تظهر النتائج تلقائياً أثناء الكتابة في اسم الجهة أو العنوان أو أقرب صيدلية.</Text>
          {searchFocused ? <View className="mt-2 rounded-xl border border-primary/30 bg-background p-2 shadow-sm"><View className="flex-row-reverse items-center justify-between px-1 pb-2"><Text className="text-xs font-bold text-primary text-right">نتائج البحث</Text><Text className="text-[11px] text-muted">{suggestions.length} نتيجة</Text></View><FlatList data={suggestions} keyExtractor={(item) => `dropdown-search-${item.id}`} renderItem={renderEntityResult} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} style={{ maxHeight: 270 }} ListEmptyComponent={<Text className="text-xs text-muted text-center py-3">لا توجد نتيجة مطابقة</Text>} /></View> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row-reverse", gap: 7, paddingTop: 10 }} keyboardShouldPersistTaps="handled"><Pressable onPress={() => setKindFilter("الكل")} className={`rounded-full px-3 py-2 ${kindFilter === "الكل" ? "bg-primary" : "bg-background border border-border"}`}><Text className={kindFilter === "الكل" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>كل الأنواع</Text></Pressable>{ENTITY_KINDS.map((kind) => <Pressable key={kind} onPress={() => setKindFilter(kind)} className={`rounded-full px-3 py-2 ${kindFilter === kind ? "bg-primary" : "bg-background border border-border"}`}><Text className={kindFilter === kind ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>{kind}</Text></Pressable>)}</ScrollView>
          <View className="flex-row-reverse gap-2 mt-2"><Pressable onPress={() => setRegionFilter("all")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "all" ? "bg-foreground" : "bg-background border border-border"}`}><Text className={regionFilter === "all" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>كل المناطق</Text></Pressable><Pressable onPress={() => setRegionFilter("north")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "north" ? "bg-primary" : "bg-background border border-border"}`}><Text className={regionFilter === "north" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>شمال صنعاء</Text></Pressable><Pressable onPress={() => setRegionFilter("south")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "south" ? "bg-warning" : "bg-background border border-border"}`}><Text className={regionFilter === "south" ? "text-white text-xs font-bold" : "text-foreground text-xs font-bold"}>جنوب صنعاء</Text></Pressable></View>
        </View>
        <View className="rounded-2xl overflow-hidden border border-border bg-surface mb-3" style={{ height: 330 }}>
          {selectedEntity?.geographicCoordinates ? <InteractiveMap key={selectedEntity.id} visits={[]} entities={mappedEntities} representatives={data.representatives} initialRegion={initialRegion} targetLocation={selectedEntity.geographicCoordinates} targetTitle={selectedEntity.name} /> : <View className="flex-1 items-center justify-center px-6"><MaterialIcons name="map" size={42} color="#7C8798" /><Text className="font-bold text-foreground text-center mt-3">اختر جهة لعرض موقعها</Text><Text className="text-sm text-muted text-center mt-1">ستنتقل الخريطة تلقائياً إلى إحداثيات الجهة عند اختيارها.</Text></View>}
        </View>
        {selectedEntity?.geographicCoordinates ? <Pressable onPress={() => void openExternalMap(selectedEntity)} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2 mb-3"><MaterialIcons name="open-in-new" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">فتح الموقع في تطبيق الخرائط</Text></Pressable> : null}
        <View className="flex-row-reverse items-center justify-between mb-2">
          <Text className="font-bold text-foreground text-right">الاقتراحات المحفوظة</Text>
          <Text className="text-xs text-primary font-bold">{suggestions.length} نتيجة</Text>
        </View>
        {!searchFocused ? <FlatList
          data={suggestions}
          keyExtractor={(item) => `search-${item.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ gap: 9, paddingBottom: 28 }}
          ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-6 items-center"><MaterialIcons name="search-off" size={34} color="#7C8798" /><Text className="font-bold text-foreground mt-2">لا توجد جهة مطابقة</Text><Text className="text-sm text-muted text-center mt-1">جرّب كتابة اسم مختلف أو جزءاً من الاسم.</Text></View>}
          renderItem={renderEntityResult}
        /> : null}
      </View>
    </ScreenContainer>
  );
}
