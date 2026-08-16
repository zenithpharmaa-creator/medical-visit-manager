import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import MapView, { MapPressEvent, Marker } from "react-native-maps";

import type { MapRegion } from "@/shared/map-types";
import type { VisitLocation } from "@/shared/visit-types";

type Props = {
  visible: boolean;
  value: { label: string; coordinates: VisitLocation } | null;
  onClose: () => void;
  onConfirm: (value: { label: string; coordinates: VisitLocation }) => void;
};

const FALLBACK_REGION: MapRegion = { latitude: 24.7136, longitude: 46.6753, latitudeDelta: 0.18, longitudeDelta: 0.18 };

export function LocationPicker({ visible, value, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState(value);
  const [region, setRegion] = useState<MapRegion>(value ? { latitude: value.coordinates.latitude, longitude: value.coordinates.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 } : FALLBACK_REGION);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(value);
    if (value) setRegion({ latitude: value.coordinates.latitude, longitude: value.coordinates.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  }, [value, visible]);

  const selectCoordinate = (latitude: number, longitude: number, label: string, accuracy: number | null = null) => {
    setSelected({ label, coordinates: { latitude, longitude, accuracy } });
    setRegion({ latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  };

  const useCurrentLocation = async () => {
    setBusy(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) { Alert.alert("الموقع غير مفعّل", "فعّل خدمة الموقع في إعدادات الهاتف ثم حاول مرة أخرى."); return; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("لا يمكن متابعة العمل دون الموقع", "رفض صلاحية الموقع يمنع تسجيل موقع الطبيب والتحقق من قرب المندوب من الجهة، وقد لا تعمل الزيارات والخريطة بشكل صحيح. افتح إعدادات Android واسمح للتطبيق باستخدام الموقع ثم حاول مرة أخرى."); return; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      selectCoordinate(current.coords.latitude, current.coords.longitude, "الموقع الحالي", current.coords.accuracy ?? null);
    } catch { Alert.alert("تعذر تحديد الموقع", "تحقق من تشغيل GPS ثم أعد المحاولة."); } finally { setBusy(false); }
  };

  const searchLocation = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const results = await Location.geocodeAsync(query.trim());
      const result = results[0];
      if (!result) { Alert.alert("لم يتم العثور على الموقع", "جرّب كتابة اسم المدينة والحي أو العنوان بصورة أوضح."); return; }
      selectCoordinate(result.latitude, result.longitude, query.trim(), null);
    } catch { Alert.alert("تعذر البحث", "تحقق من الاتصال بالإنترنت وحاول مرة أخرى."); } finally { setBusy(false); }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    selectCoordinate(latitude, longitude, "الموقع المحدد على الخريطة");
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View className="flex-1 bg-background"><View className="px-5 pt-5 flex-row-reverse justify-between items-center"><View><Text className="text-lg font-bold text-foreground text-right">اختيار الموقع الجغرافي</Text><Text className="text-xs text-muted mt-1 text-right">ابحث أو اضغط على الخريطة لتحديد الموقع</Text></View><Pressable onPress={onClose}><MaterialIcons name="close" size={25} color="#102A43" /></Pressable></View><View className="px-5 mt-4 flex-row-reverse gap-2"><TextInput value={query} onChangeText={setQuery} onSubmitEditing={searchLocation} placeholder="ابحث عن مدينة أو حي أو عنوان" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-12 rounded-xl border border-border bg-surface px-4 text-foreground" returnKeyType="search" /><Pressable onPress={searchLocation} disabled={busy} className="w-12 h-12 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="search" size={22} color="#FFFFFF" /></Pressable></View><View className="px-5 mt-3"><Pressable onPress={useCurrentLocation} disabled={busy} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="my-location" size={20} color="#FFFFFF" /><Text className="text-white font-bold">{busy ? "جاري التحديد..." : "استخدام موقعي الحالي"}</Text></Pressable></View><View className="flex-1 mx-5 mt-4 rounded-2xl overflow-hidden border border-border"><MapView style={{ flex: 1 }} initialRegion={region} region={region} onPress={handleMapPress}><>{selected ? <Marker coordinate={{ latitude: selected.coordinates.latitude, longitude: selected.coordinates.longitude }} title={selected.label} /> : null}</></MapView></View><View className="p-5"><View className="rounded-xl bg-primary/10 p-3 mb-3 flex-row-reverse items-center gap-2"><MaterialIcons name="info-outline" size={18} color="#1565C0" /><Text className="flex-1 text-primary text-xs text-right">الموقع إلزامي. اضغط على الخريطة بدقة على موقع العيادة أو الصيدلية.</Text></View><Pressable onPress={() => selected ? onConfirm(selected) : Alert.alert("حدد الموقع أولاً", "استخدم البحث أو زر موقعي الحالي أو اضغط على الخريطة.")} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="check" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تأكيد الموقع</Text></Pressable></View></View></Modal>;
}
