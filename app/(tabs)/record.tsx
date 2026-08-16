import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { ScreenContainer } from "@/components/screen-container";
import { notifyManagerOfOverride } from "@/lib/override-notification";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, distanceBetweenMeters, formatArabicDate, isWithinGeofence } from "@/lib/visit-utils";
import { MedicalEntity, Representative, VisitLocation } from "@/shared/visit-types";

type PickerTarget = "representative" | "entity" | null;

function SelectBox({ value, onPress, placeholder }: { value?: string; onPress: () => void; placeholder: string }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"
      style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}
    >
      <Text className={`font-bold ${value ? "text-foreground" : "text-muted"}`}>{value || placeholder}</Text>
      <MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" />
    </Pressable>
  );
}

export default function RecordVisitScreen() {
  const { data, addVisit } = useVisitStore();
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [selectedRepresentative, setSelectedRepresentative] = useState<Representative>(data.representatives[0]);
  const [selectedEntity, setSelectedEntity] = useState<MedicalEntity | null>(null);
  const [notes, setNotes] = useState("");
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [location, setLocation] = useState<VisitLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState("سيتم التقاط الموقع تلقائياً عند فتح الشاشة.");
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overridePin, setOverridePin] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const pickerOptions = useMemo(() => {
    if (picker === "representative") {
      return data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }));
    }
    return data.entities.map((item) => ({ label: item.name, value: item.id, helper: [item.kind, item.specialty, item.category, item.nearestPharmacy ? `أقرب صيدلية: ${item.nearestPharmacy}` : "", item.geographicLocation].filter(Boolean).join(" · ") }));
  }, [data.entities, data.representatives, picker]);

  const captureLocation = async (): Promise<VisitLocation | null> => {
    setIsLocating(true);
    setLocationStatus("جاري التقاط موقعك الحالي تلقائياً...");
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) { setLocationStatus("خدمة الموقع متوقفة. شغّل GPS ثم أعد المحاولة."); Alert.alert("خدمة الموقع متوقفة", "يرجى تشغيل خدمة الموقع في الجهاز ثم المحاولة."); return null; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { setLocationStatus("تم رفض إذن الموقع؛ لا يمكن تسجيل زيارة موثقة."); Alert.alert("يلزم إذن الموقع", "يُستخدم الموقع فقط لتوثيق مكان الزيارة عند التسجيل."); return null; }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextLocation = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
      setLocation(nextLocation); setCapturedAt(new Date().toISOString()); setLocationStatus("تم التقاط الموقع تلقائياً بنجاح.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return nextLocation;
    } catch { setLocationStatus("تعذر التقاط الموقع. تأكد من إشارة GPS ثم أعد المحاولة."); Alert.alert("تعذر تحديد الموقع", "تأكد من وجود إشارة GPS جيدة ثم أعد المحاولة."); return null; }
    finally { setIsLocating(false); }
  };

  useEffect(() => { void captureLocation(); }, []);

  const persistVisit = (managerOverride = false, reason = "", capturedLocation = location, capturedTimestamp = capturedAt) => {
    if (!selectedEntity || !capturedTimestamp || !capturedLocation) return;
    const createdVisit = {
      id: buildId("visit"), representativeId: selectedRepresentative.id, entityId: selectedEntity.id,
      entityName: selectedEntity.name, entityKind: selectedEntity.kind, nearestPharmacy: selectedEntity.nearestPharmacy,
      geographicCoordinates: selectedEntity.geographicCoordinates, specialty: selectedEntity.specialty, category: selectedEntity.category,
      geographicLocation: selectedEntity.geographicLocation, recordedAt: capturedTimestamp, location: capturedLocation, notes: notes.trim(),
      managerOverride: managerOverride || undefined, overrideReason: managerOverride ? reason : undefined,
    };
    addVisit(createdVisit);
    if (managerOverride) void notifyManagerOfOverride({ settings: data.settings, visit: createdVisit, representativeName: selectedRepresentative.name });
    setOverrideModalVisible(false); setOverridePin(""); setOverrideReason("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("تم حفظ الزيارة", managerOverride ? "تم التسجيل بتجاوز المدير مع حفظ السبب." : "تم تسجيل وقت وموقع الزيارة بنجاح.", [{ text: "تسجيل زيارة أخرى", onPress: () => { setSelectedEntity(null); setNotes(""); setCapturedAt(null); setLocation(null); } }]);
  };

  const saveVisit = async () => {
    if (!selectedEntity) { Alert.alert("اختر جهة الزيارة", "أضف جهة من شاشة الإدارة أو استوردها من Excel أولاً."); return; }
    const freshLocation = await captureLocation();
    if (!freshLocation) return;
    const freshCapturedAt = new Date().toISOString();
    if (!selectedEntity.geographicCoordinates) { Alert.alert("موقع الجهة غير موثّق", "لا يمكن حفظ الزيارة قبل حفظ إحداثيات الجهة من GPS أو الخريطة."); return; }
    const distanceMeters = distanceBetweenMeters(freshLocation, selectedEntity.geographicCoordinates);
    if (!isWithinGeofence(distanceMeters, data.settings.geofenceRadiusMeters)) {
      if (!data.settings.managerPin) { Alert.alert("الزيارة خارج النطاق", `المسافة ${Math.round(distanceMeters)} متر. لا يوجد PIN مدير مضبوط لتجاوز الشرط.`); return; }
      setOverrideModalVisible(true); return;
    }
    persistVisit(false, "", freshLocation, freshCapturedAt);
  };

  const confirmOverride = () => {
    if (overridePin !== data.settings.managerPin) { Alert.alert("PIN غير صحيح", "لا يمكن تنفيذ تجاوز المدير دون PIN صحيح."); return; }
    if (overrideReason.trim().length < 5) { Alert.alert("سبب التجاوز مطلوب", "اكتب سبباً واضحاً لا يقل عن خمسة أحرف."); return; }
    persistVisit(true, overrideReason.trim());
  };

  const title = picker === "representative" ? "اختر المندوب" : "اختر جهة الزيارة";
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="تسجيل زيارة" subtitle="وثّق الزيارة بالموقع والوقت" icon="add-location-alt" />

        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse gap-3">
          <MaterialIcons name="privacy-tip" size={22} color="#1565C0" />
          <Text className="text-primary font-semibold flex-1 text-right leading-5">يُلتقط الموقع مرة واحدة عند الضغط على الزر، ولا يتم تتبع موقع المندوب بشكل مستمر.</Text>
        </View>

        <FormField label="المندوب" icon="person">
          <SelectBox value={selectedRepresentative?.name} placeholder="اختر المندوب" onPress={() => setPicker("representative")} />
        </FormField>
        <FormField label="اسم الطبيب" icon="person">
          <SelectBox value={selectedEntity?.name} placeholder={data.entities.length ? "اختر جهة الزيارة" : "لا توجد جهات مسجلة"} onPress={() => data.entities.length ? setPicker("entity") : Alert.alert("لا توجد جهات", "انتقل إلى شاشة الإدارة لإضافة جهة يدوياً أو استيراد ملف Excel.")} />
        </FormField>

        <View className="mb-4">
          <View className="flex-row-reverse items-center gap-2 mb-2">
            <View className="w-7 h-7 rounded-lg bg-primary items-center justify-center"><MaterialIcons name="my-location" size={15} color="#FFFFFF" /></View>
            <Text className="font-bold text-foreground text-right">الموقع والوقت</Text>
          </View>
          <View className="rounded-2xl border border-border bg-surface p-4">
            {capturedAt ? (
              <View className="items-end mb-3">
                <Text className="font-bold text-success">تم الالتقاط بنجاح</Text>
                <Text className="text-sm text-muted mt-1">{formatArabicDate(capturedAt)}</Text>
                {location ? <Text className="text-xs text-muted mt-1">دقة الموقع: {Math.round(location.accuracy ?? 0)} متر</Text> : null}
                <Text className="text-xs text-primary mt-1 text-right">{locationStatus}</Text>
              </View>
            ) : <Text className="text-muted text-right mb-3">{locationStatus}</Text>}
            <Pressable onPress={captureLocation} disabled={isLocating} className="rounded-xl bg-primary h-12 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isLocating ? 0.72 : 1 }]}>
              <MaterialIcons name={isLocating ? "sync" : "gps-fixed"} size={19} color="#FFFFFF" />
              <Text className="text-white font-bold">{isLocating ? "جاري تحديد الموقع..." : "التقاط الموقع والوقت"}</Text>
            </Pressable>
          </View>
        </View>

        <FormField label="ملاحظات الزيارة (اختياري)" icon="notes" value={notes} onChangeText={setNotes} placeholder="اكتب ملخصاً قصيراً للزيارة" multiline />

        <Pressable onPress={saveVisit} className="rounded-2xl bg-success h-14 items-center justify-center flex-row-reverse gap-2 mt-1" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}>
          <MaterialIcons name="save" size={21} color="#FFFFFF" />
          <Text className="text-white font-bold text-base">حفظ الزيارة</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={overrideModalVisible} transparent animationType="slide" onRequestClose={() => setOverrideModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/40"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8"><View className="flex-row-reverse items-center justify-between mb-4"><Text className="text-lg font-bold text-foreground">تجاوز مدير النظام</Text><Pressable onPress={() => setOverrideModalVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><Text className="text-sm text-muted text-right leading-5 mb-4">الزيارة خارج نطاق الجهة. أدخل PIN المدير وسبباً واضحاً ليتم حفظ التجاوز مع سجل الزيارة.</Text><Text className="font-bold text-foreground text-right mb-2">PIN المدير</Text><TextInput value={overridePin} onChangeText={setOverridePin} secureTextEntry keyboardType="number-pad" placeholder="PIN" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground mb-4" /><Text className="font-bold text-foreground text-right mb-2">سبب التجاوز *</Text><TextInput value={overrideReason} onChangeText={setOverrideReason} placeholder="مثال: GPS غير دقيق داخل المبنى" placeholderTextColor="#7C8798" textAlign="right" multiline className="min-h-24 rounded-2xl border border-border bg-surface px-4 py-3 text-foreground mb-4" /><Pressable onPress={confirmOverride} className="h-14 rounded-2xl bg-warning items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="verified-user" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تأكيد التجاوز والحفظ</Text></Pressable></View></View>
      </Modal>
      <SelectionModal
        visible={picker !== null}
        title={title}
        options={pickerOptions}
        selected={picker === "representative" ? selectedRepresentative?.id : selectedEntity?.id}
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          if (picker === "representative") setSelectedRepresentative(data.representatives.find((item) => item.id === option.value) ?? data.representatives[0]);
          else setSelectedEntity(data.entities.find((item) => item.id === option.value) ?? null);
        }}
      />
    </ScreenContainer>
  );
}
