import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { InteractiveMap } from "@/components/interactive-map";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";
import type { VisitLocation } from "@/shared/visit-types";

const ALL = "الكل";
export default function RepresentativeLocationScreen() {
  const { data, updateRepresentativeLocation } = useVisitStore();
  const [selectedId, setSelectedId] = useState(data.representatives[0]?.id ?? "");
  const [filterId, setFilterId] = useState(ALL);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const selected = data.representatives.find((item) => item.id === selectedId);
  const selectedRecord = data.representativeLocations[selectedId];
  const updateLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("يلزم إذن الموقع", "اسمح بإذن الموقع لعرض موقع المندوب الحالي."); return; }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const location: VisitLocation = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
      updateRepresentativeLocation(selectedId, { location, updatedAt: new Date().toISOString() });
    } catch { Alert.alert("تعذر تحديد الموقع", "تحقق من تشغيل GPS ثم حاول مرة أخرى."); }
  };
  return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="pt-[18px]"><ScreenHeader title="مواقع المندوبين" subtitle="إشراف عام على آخر المواقع المحدثة" icon="person-pin-circle" /><View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={() => setPickerVisible(true)} className="flex-1 h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">تحديث: {selected?.name ?? "اختر"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><Pressable onPress={() => setFilterVisible(true)} className="flex-1 h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">عرض: {filterId === ALL ? "الجميع" : data.representatives.find((item) => item.id === filterId)?.name}</Text><MaterialIcons name="filter-list" size={22} color="#102A43" /></Pressable></View><View className="h-[430px] rounded-2xl overflow-hidden border border-border"><InteractiveMap visits={[]} representatives={data.representatives} initialRegion={{ latitude: 15.3694, longitude: 44.191, latitudeDelta: 0.12, longitudeDelta: 0.12 }} representativeLocations={data.representativeLocations} representativeFilter={filterId} /></View><View className="rounded-2xl bg-primary/10 border border-primary/20 p-3 mt-3 flex-row-reverse items-center gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="text-primary text-xs text-right flex-1">تظهر العلامات المحفوظة لجميع المندوبين. اللون يميز كل علامة، واضغط على العلامة لرؤية الاسم ووقت آخر تحديث.</Text></View><View className="rounded-2xl bg-surface border border-border p-4 mt-3 flex-row-reverse items-center gap-3"><View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="my-location" size={20} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground">{selectedRecord ? `آخر تحديث لـ ${selected?.name}` : "لم يتم تحديث المندوب المحدد"}</Text><Text className="text-xs text-muted mt-1 text-right">{selectedRecord ? `${formatArabicDate(selectedRecord.updatedAt)} · دقة ${Math.round(selectedRecord.location.accuracy ?? 0)}م` : "اضغط تحديث الموقع لالتقاط موقعه وحفظه"}</Text></View></View><Pressable onPress={updateLocation} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mt-4"><MaterialIcons name="refresh" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تحديث موقع {selected?.name ?? "المندوب"}</Text></Pressable></View><SelectionModal visible={pickerVisible} title="اختر المندوب المراد تحديثه" options={data.representatives.map((item) => ({ label: item.name, value: item.id }))} selected={selectedId} onClose={() => setPickerVisible(false)} onSelect={(option) => { setSelectedId(option.value); setPickerVisible(false); }} /><SelectionModal visible={filterVisible} title="تصفية مواقع الخريطة" options={[{ label: "جميع المندوبين", value: ALL }, ...data.representatives.map((item) => ({ label: item.name, value: item.id }))]} selected={filterId} onClose={() => setFilterVisible(false)} onSelect={(option) => { setFilterId(option.value); setFilterVisible(false); }} /></ScreenContainer>;
}
