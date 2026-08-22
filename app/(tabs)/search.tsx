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
          <View className="h-14 rounded-xl border border-primary bg-background px-3 flex-row-reverse items-center gap-2">
            <MaterialIcons name="search" size={22} color="#1257A6" />
            <TextInput
              value={query}
              onChangeText={(value) => { setQuery(value); if (selectedEntity && value !== selectedEntity.name) setSelectedEntity(null); }}
              placeholder="اكتب أول أحرف اسم الطبيب أو الجهة"
              placeholderTextColor="#7C8798"
              textAlign="right"
              autoCapitalize="none"
              returnKeyType="search"
              className="flex-1 h-full text-foreground font-semibold"
              accessibilityLabel="البحث عن جهة محفوظة"
            />
            {query ? <Pressable onPress={() => { setQuery(""); setSelectedEntity(null); Keyboard.dismiss(); }} className="w-9 h-9 rounded-lg bg-surface items-center justify-center" accessibilityRole="button" accessibilityLabel="مسح البحث"><MaterialIcons name="close" size={19} color="#64748B" /></Pressable> : null}
          </View>
          <Text className="text-xs text-muted text-right mt-2">تظهر الأسماء المطابقة تلقائياً أثناء الكتابة.</Text>
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
        <FlatList
          data={suggestions}
          keyExtractor={(item) => `search-${item.id}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ gap: 9, paddingBottom: 28 }}
          ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-6 items-center"><MaterialIcons name="search-off" size={34} color="#7C8798" /><Text className="font-bold text-foreground mt-2">لا توجد جهة مطابقة</Text><Text className="text-sm text-muted text-center mt-1">جرّب كتابة اسم مختلف أو جزءاً من الاسم.</Text></View>}
          renderItem={({ item }) => {
            const hasCoordinates = Boolean(item.geographicCoordinates);
            const active = selectedEntity?.id === item.id;
            return <Pressable onPress={() => selectEntity(item)} className={`rounded-2xl border p-3 flex-row-reverse items-center gap-3 ${active ? "bg-primary/10 border-primary" : "bg-surface border-border"}`} style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><View className={`w-11 h-11 rounded-xl items-center justify-center ${hasCoordinates ? "bg-primary" : "bg-muted"}`}><MaterialIcons name={item.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={21} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-muted mt-1 text-right">{item.kind}{item.specialty ? ` · ${item.specialty}` : ""}</Text><Text className={`text-[11px] mt-1 text-right ${hasCoordinates ? "text-success" : "text-warning"}`}>{hasCoordinates ? (item.geographicLocation || "إحداثيات محفوظة") : "لا توجد إحداثيات محفوظة"}</Text></View><MaterialIcons name={active ? "check-circle" : "chevron-left"} size={22} color={active ? "#1257A6" : "#64748B"} /></Pressable>;
          }}
        />
      </View>
    </ScreenContainer>
  );
}
