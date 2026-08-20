import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { SANAA_NEIGHBORHOODS } from "@/data/sanaa-neighborhoods";
import type { MapRegion } from "@/shared/map-types";
import type { VisitLocation } from "@/shared/visit-types";

type Props = {
  visible: boolean;
  value: { label: string; coordinates: VisitLocation } | null;
  onClose: () => void;
  onConfirm: (value: { label: string; coordinates: VisitLocation }) => void;
};

const FALLBACK_REGION: MapRegion = { latitude: 15.3694, longitude: 44.191, latitudeDelta: 0.12, longitudeDelta: 0.12 };

export function LocationPicker({ visible, value, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState(value);
  const [region, setRegion] = useState<MapRegion>(value ? { latitude: value.coordinates.latitude, longitude: value.coordinates.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 } : FALLBACK_REGION);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [locationSettingsNeeded, setLocationSettingsNeeded] = useState(false);

  useEffect(() => {
    setSelected(value);
    setLocationSettingsNeeded(false);
    if (value) setRegion({ latitude: value.coordinates.latitude, longitude: value.coordinates.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  }, [value, visible]);

  const selectCoordinate = (latitude: number, longitude: number, label: string, accuracy: number | null = null) => {
    Keyboard.dismiss();
    setSelected({ label, coordinates: { latitude, longitude, accuracy } });
    setRegion({ latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  };

  const useCurrentLocation = async () => {
    setBusy(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) { setLocationSettingsNeeded(true); Alert.alert("الموقع غير مفعّل", "فعّل خدمة الموقع في إعدادات الهاتف ثم حاول مرة أخرى."); return; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { setLocationSettingsNeeded(true); Alert.alert("لا يمكن متابعة العمل دون الموقع", "رفض صلاحية الموقع يمنع تسجيل موقع الطبيب والتحقق من قرب المندوب من الجهة، وقد لا تعمل الزيارات والخريطة بشكل صحيح."); return; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      selectCoordinate(current.coords.latitude, current.coords.longitude, "الموقع الحالي", current.coords.accuracy ?? null);
    } catch { Alert.alert("تعذر تحديد الموقع", "تحقق من تشغيل GPS ثم أعد المحاولة."); } finally { setBusy(false); }
  };

  const openLocationSettings = async () => {
    try { await Linking.openSettings(); } catch { Alert.alert("تعذر فتح الإعدادات", "افتح إعدادات الهاتف يدوياً ثم فعّل الموقع واسمح للتطبيق باستخدامه."); }
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <View className="px-5 pt-5 flex-row-reverse justify-between items-center">
            <View><Text className="text-lg font-bold text-foreground text-right">اختيار الموقع الجغرافي</Text><Text className="text-xs text-muted mt-1 text-right">ابحث أو اضغط على الخريطة لتحديد الموقع</Text></View>
            <Pressable onPress={onClose}><MaterialIcons name="close" size={25} color="#102A43" /></Pressable>
          </View>
          <View className="px-5 mt-4 flex-row-reverse gap-2">
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={searchLocation} placeholder="ابحث عن مدينة أو حي أو عنوان" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-12 rounded-xl border border-primary bg-surface px-4 text-foreground" returnKeyType="search" blurOnSubmit={false} />
            <Pressable onPress={searchLocation} disabled={busy} className="w-12 h-12 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="search" size={22} color="#FFFFFF" /></Pressable>
          </View>
          <View className="px-5 mt-3">
            <Pressable onPress={useCurrentLocation} disabled={busy} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="my-location" size={20} color="#FFFFFF" /><Text className="text-white font-bold">{busy ? "جاري التحديد..." : "استخدام موقعي الحالي"}</Text></Pressable>
            {locationSettingsNeeded ? <Pressable onPress={openLocationSettings} className="h-11 rounded-xl bg-warning mt-2 items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="settings" size={19} color="#FFFFFF" /><Text className="text-white font-bold">فتح إعدادات الموقع في الهاتف</Text></Pressable> : null}
          </View>
          <View className="flex-1 mx-5 mt-4 rounded-2xl overflow-hidden border border-border bg-[#EAF1F4] min-h-[260px]">
            <View className="px-4 py-3 bg-background border-b border-border flex-row-reverse items-center gap-2"><MaterialIcons name="cloud-off" size={18} color="#16835B" /><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">اختيار موقع صنعاء بدون خريطة إنترنت</Text><Text className="text-[11px] text-muted text-right mt-1">اختر الحي الأقرب، أو استخدم موقعي الحالي للحصول على GPS أدق.</Text></View></View>
            <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator><Text className="text-xs text-primary font-bold text-right mb-1">أحياء صنعاء — اختر الأقرب للجهة</Text>{SANAA_NEIGHBORHOODS.map((area) => <Pressable key={area.id} onPress={() => selectCoordinate(area.latitude, area.longitude, `صنعاء — ${area.district} — ${area.name}`, null)} className={`rounded-xl border p-3 flex-row-reverse items-center justify-between ${selected?.coordinates.latitude === area.latitude && selected?.coordinates.longitude === area.longitude ? "bg-primary/15 border-primary" : "bg-background border-border"}`}><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{area.name}</Text><Text className="text-[10px] text-muted text-right mt-1">{area.district}</Text></View><MaterialIcons name={selected?.coordinates.latitude === area.latitude && selected?.coordinates.longitude === area.longitude ? "radio-button-checked" : "radio-button-unchecked"} size={20} color={selected?.coordinates.latitude === area.latitude && selected?.coordinates.longitude === area.longitude ? "#1565C0" : "#64748B"} /></Pressable>)}</ScrollView>
          </View>
          <View className="p-5"><View className="rounded-xl bg-primary/10 p-3 mb-3 flex-row-reverse items-center gap-2"><MaterialIcons name="info-outline" size={18} color="#1565C0" /><Text className="flex-1 text-primary text-xs text-right">الموقع إلزامي. اضغط على الخريطة بدقة على موقع العيادة أو الصيدلية.</Text></View><Pressable onPress={() => selected ? onConfirm(selected) : Alert.alert("حدد الموقع أولاً", "استخدم البحث أو زر موقعي الحالي أو اضغط على الخريطة.")} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="check" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تأكيد الموقع</Text></Pressable></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
