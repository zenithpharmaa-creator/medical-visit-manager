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

export default function RepresentativeLocationScreen() {
  const { data } = useVisitStore();
  const [selectedId, setSelectedId] = useState(data.representatives[0]?.id ?? "");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [location, setLocation] = useState<VisitLocation | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const selected = data.representatives.find((item) => item.id === selectedId);
  const updateLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("يلزم إذن الموقع", "اسمح بإذن الموقع لعرض موقع المندوب الحالي."); return; }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy });
      setUpdatedAt(new Date().toISOString());
    } catch { Alert.alert("تعذر تحديد الموقع", "تحقق من تشغيل GPS ثم حاول مرة أخرى."); }
  };
  return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="pt-[18px]"><ScreenHeader title="موقع المندوب الحالي" subtitle="عرض آخر موقع التقطه المدير لهذا المندوب" icon="person-pin-circle" /><Pressable onPress={() => setPickerVisible(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground">{selected?.name ?? "اختر المندوب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><View className="h-[430px] rounded-2xl overflow-hidden border border-border"><InteractiveMap visits={[]} representatives={data.representatives} initialRegion={{ latitude: location?.latitude ?? 15.3694, longitude: location?.longitude ?? 44.191, latitudeDelta: 0.08, longitudeDelta: 0.08 }} currentLocation={location} /></View><View className="rounded-2xl bg-surface border border-border p-4 mt-4 flex-row-reverse items-center gap-3"><View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="my-location" size={20} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground">{location ? "تم تحديد الموقع" : "لم يتم تحديد الموقع بعد"}</Text><Text className="text-xs text-muted mt-1 text-right">{updatedAt ? `${formatArabicDate(updatedAt)} · دقة ${Math.round(location?.accuracy ?? 0)}م` : "اضغط تحديث الموقع لبدء العرض"}</Text></View></View><Pressable onPress={updateLocation} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mt-4"><MaterialIcons name="refresh" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تحديث موقع المندوب</Text></Pressable></View><SelectionModal visible={pickerVisible} title="اختر المندوب" options={data.representatives.map((item) => ({ label: item.name, value: item.id }))} selected={selectedId} onClose={() => setPickerVisible(false)} onSelect={(option) => { setSelectedId(option.value); setLocation(null); setUpdatedAt(null); setPickerVisible(false); }} /></ScreenContainer>;
}
