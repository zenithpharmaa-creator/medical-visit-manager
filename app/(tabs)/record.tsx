import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useNetworkState } from "expo-network";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { ScreenContainer } from "@/components/screen-container";
import { LocationPicker } from "@/components/location-picker";
import { notifyManagerOfOverride } from "@/lib/override-notification";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, distanceBetweenMeters, formatArabicDate, isWithinGeofence } from "@/lib/visit-utils";
import { MedicalEntity, Representative, VisitLocation, VisitVerificationStatus } from "@/shared/visit-types";

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
  const networkState = useNetworkState();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedVisitedItems, setSelectedVisitedItems] = useState<string[]>([]);
  const [visitedItemsSearch, setVisitedItemsSearch] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const activeRepresentative = session?.representativeId ? data.representatives.find((item) => item.id === session.representativeId) : undefined;
  const representativeForVisit = isManager ? selectedRepresentative : activeRepresentative;
  const availableVisitedItems = isManager ? data.settings.visitedItems : (activeRepresentative?.assignedItems ?? []);
  const filteredVisitedItems = availableVisitedItems.filter((item) => item.toLowerCase().includes(visitedItemsSearch.trim().toLowerCase()));
  const internetAvailable = networkState.isInternetReachable === true;

  const entityPickerOptions = useMemo(() => {
    const query = entitySearch.trim().toLocaleLowerCase();
    return data.entities.map((item) => ({ label: item.name, value: item.id, helper: [item.kind, item.specialty, item.category, item.nearestPharmacy ? `أقرب صيدلية: ${item.nearestPharmacy}` : "", item.geographicLocation].filter(Boolean).join(" · ") })).filter((item) => !query || `${item.label} ${item.helper}`.toLocaleLowerCase().includes(query));
  }, [data.entities, entitySearch]);
  const pickerOptions = useMemo(() => picker === "representative" ? data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id })) : entityPickerOptions, [data.representatives, entityPickerOptions, picker]);

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
      setLocation(nextLocation); setCapturedAt(new Date().toISOString()); setLocationStatus(`تم التقاط الموقع تلقائياً بنجاح${internetAvailable ? " — الاتصال متاح" : " — سيُتحقق من الموقع عند عودة الاتصال"}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return nextLocation;
    } catch { setLocationStatus("تعذر التقاط الموقع. تأكد من إشارة GPS ثم أعد المحاولة."); Alert.alert("تعذر تحديد الموقع", "تأكد من وجود إشارة GPS جيدة ثم أعد المحاولة."); return null; }
    finally { setIsLocating(false); }
  };

  useEffect(() => { void captureLocation(); }, []);


  const persistVisit = (managerOverride = false, reason = "", capturedLocation = location, capturedTimestamp = capturedAt) => {
    if (!representativeForVisit || !selectedEntity || !capturedTimestamp || !capturedLocation) return;
    const verificationStatus: VisitVerificationStatus = managerOverride ? "override" : isManager ? "verified" : "pending";
    const createdVisit = {
      id: buildId("visit"), representativeId: representativeForVisit?.id ?? "", entityId: selectedEntity.id,
      entityName: selectedEntity.name, entityKind: selectedEntity.kind, nearestPharmacy: selectedEntity.nearestPharmacy,
      geographicCoordinates: selectedEntity.geographicCoordinates, specialty: selectedEntity.specialty, category: selectedEntity.category,
      geographicLocation: selectedEntity.geographicLocation, recordedAt: capturedTimestamp, location: capturedLocation, notes: notes.trim(), photoUri: photoUri ?? undefined, visitedItems: selectedVisitedItems,
      managerOverride: managerOverride || undefined, overrideReason: managerOverride ? reason : undefined,
      verificationStatus,
      offlineRecorded: !isManager,
      verificationReason: managerOverride ? "تم اعتماد الزيارة بتجاوز مدير النظام." : isManager ? "تم التحقق عند التسجيل من حساب المدير." : "بانتظار التحقق عند عودة الاتصال.",
    };
    addVisit(createdVisit);
    if (managerOverride) void notifyManagerOfOverride({ settings: data.settings, visit: createdVisit, representativeName: representativeForVisit.name });
    setOverrideModalVisible(false); setOverridePin(""); setOverrideReason("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("تم حفظ الزيارة", managerOverride ? "تم التسجيل بتجاوز المدير مع حفظ السبب." : !isManager ? "تم حفظ الزيارة دون إنترنت، وستُراجع تلقائياً عند عودة الاتصال." : "تم تسجيل وقت وموقع الزيارة بنجاح.", [{ text: "تسجيل زيارة أخرى", onPress: () => { setSelectedEntity(null); setNotes(""); setCapturedAt(null); setLocation(null); setPhotoUri(null); setSelectedVisitedItems([]); setVisitedItemsSearch(""); } }]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") { Alert.alert("يلزم إذن الكاميرا", "اسمح للتطبيق باستخدام الكاميرا لالتقاط صورة الزيارة."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.75 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const saveVisit = async () => {
    if (!selectedEntity) { Alert.alert("اختر جهة الزيارة", "أضف جهة من شاشة الإدارة أو استوردها من Excel أولاً."); return; }
    const freshLocation = await captureLocation();
    if (!freshLocation) return;
    const freshCapturedAt = new Date().toISOString();
    if (!selectedEntity.geographicCoordinates && isManager) { Alert.alert("موقع الجهة غير موثّق", "لا يمكن حفظ الزيارة قبل حفظ إحداثيات الجهة من GPS أو الخريطة."); return; }
    const distanceMeters = selectedEntity.geographicCoordinates ? distanceBetweenMeters(freshLocation, selectedEntity.geographicCoordinates) : null;
    if (isManager && distanceMeters !== null && !isWithinGeofence(distanceMeters, data.settings.geofenceRadiusMeters)) {
      if (!data.settings.managerPin) { Alert.alert("الزيارة خارج النطاق", `المسافة ${Math.round(distanceMeters)} متر. لا يوجد PIN مدير مضبوط لتجاوز الشرط.`); return; }
      setOverrideModalVisible(true); return;
    }
    if (!isManager) {
      persistVisit(false, "", freshLocation, freshCapturedAt);
      return;
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

        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-3 flex-row-reverse gap-3">
          <MaterialIcons name="privacy-tip" size={22} color="#1565C0" />
          <Text className="text-primary font-semibold flex-1 text-right leading-5">يُلتقط الموقع مرة واحدة عند الضغط على الزر، ولا يتم تتبع موقع المندوب بشكل مستمر.</Text>
        </View>
        <View className={`rounded-xl px-4 py-3 mb-5 flex-row-reverse items-center gap-2 ${internetAvailable ? "bg-success/10 border border-success/20" : "bg-warning/10 border border-warning/20"}`}>
          <MaterialIcons name={internetAvailable ? "cloud-done" : "cloud-off"} size={19} color={internetAvailable ? "#16835B" : "#D97706"} />
          <Text className={`text-xs font-bold flex-1 text-right ${internetAvailable ? "text-success" : "text-warning"}`}>{internetAvailable ? "الاتصال متاح — ستتم المطابقة تلقائياً" : "لا يوجد إنترنت — ستُحفظ الزيارة وتُراجع عند عودة الاتصال"}</Text>
        </View>

        {isManager ? <FormField label="المندوب" icon="person"><SelectBox value={selectedRepresentative?.name} placeholder="اختر المندوب" onPress={() => setPicker("representative")} /></FormField> : <View className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 mb-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-primary">{representativeForVisit?.name ?? "الحساب الحالي"}</Text><Text className="text-xs text-muted">الحساب النشط</Text></View>}
        <FormField label="اسم الطبيب" icon="person">
          <TextInput value={entitySearch} onChangeText={setEntitySearch} placeholder="ابحث باسم الطبيب أو الجهة" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold mb-3" />
          <SelectBox value={selectedEntity?.name} placeholder={data.entities.length ? `اختر جهة الزيارة${entitySearch.trim() ? ` (${entityPickerOptions.length})` : ""}` : "لا توجد جهات مسجلة"} onPress={() => data.entities.length ? setPicker("entity") : Alert.alert("لا توجد جهات", "انتقل إلى شاشة الإدارة لإضافة جهة يدوياً أو استيراد ملف Excel.")} />
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
            <View className="gap-2">
              <Pressable onPress={captureLocation} disabled={isLocating} className="rounded-xl bg-primary h-12 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isLocating ? 0.72 : 1 }]}>
                <MaterialIcons name={isLocating ? "sync" : "gps-fixed"} size={19} color="#FFFFFF" />
                <Text className="text-white font-bold">{isLocating ? "جاري تحديد الموقع..." : "التقاط الموقع والوقت"}</Text>
              </Pressable>
              <Pressable onPress={() => setLocationPickerVisible(true)} className="rounded-xl bg-foreground h-12 items-center justify-center flex-row-reverse gap-2">
                <MaterialIcons name="map" size={19} color="#FFFFFF" />
                <Text className="text-white font-bold">تحديد الموقع على الخريطة</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {isManager ? <View className="rounded-2xl border border-border bg-surface p-4 mb-4">
          <View className="flex-row-reverse items-center gap-2 mb-3"><View className="w-7 h-7 rounded-lg bg-primary items-center justify-center"><MaterialIcons name="photo-camera" size={15} color="#FFFFFF" /></View><Text className="font-bold text-foreground">صورة الزيارة (اختياري)</Text></View>
          {photoUri ? <Image source={{ uri: photoUri }} className="w-full h-44 rounded-xl mb-3" resizeMode="cover" /> : <Text className="text-sm text-muted text-right mb-3">يمكنك التقاط صورة أو اختيارها من الجهاز وإرفاقها مع الزيارة.</Text>}
          <View className="flex-row-reverse gap-2"><Pressable onPress={takePhoto} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="photo-camera" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">التقاط صورة</Text></Pressable><Pressable onPress={choosePhoto} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="photo-library" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">اختيار صورة</Text></Pressable></View>
          {photoUri ? <Pressable onPress={() => setPhotoUri(null)} className="self-end mt-2"><Text className="text-error font-bold text-xs">إزالة الصورة</Text></Pressable> : null}
        </View> : null}

        <FormField label="الأصناف المزارة (اختياري)" icon="inventory-2">
          {availableVisitedItems.length ? <View><TextInput value={visitedItemsSearch} onChangeText={setVisitedItemsSearch} placeholder="ابحث عن صنف بسرعة" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground font-semibold mb-3" />{filteredVisitedItems.length ? <View className="flex-row-reverse flex-wrap gap-2">{filteredVisitedItems.map((item) => { const selected = selectedVisitedItems.includes(item); return <Pressable key={item} onPress={() => setSelectedVisitedItems((current) => selected ? current.filter((value) => value !== item) : [...current, item])} className={`rounded-full border px-3 py-2 ${selected ? "bg-primary border-primary" : "bg-surface border-border"}`}><Text className={`text-xs font-bold ${selected ? "text-white" : "text-foreground"}`}>{item}</Text></Pressable>; })}</View> : <Text className="text-sm text-muted text-right">لا توجد أصناف مطابقة للبحث.</Text>}</View> : <Text className="text-sm text-muted text-right">سيضيف مدير النظام الأصناف المزارة من الإعدادات لاحقاً.</Text>}
        </FormField>

        <FormField label="ملاحظات الزيارة (اختياري)" icon="notes" value={notes} onChangeText={setNotes} placeholder="اكتب ملخصاً قصيراً للزيارة" multiline />

        <Pressable onPress={saveVisit} className="rounded-2xl bg-success h-14 items-center justify-center flex-row-reverse gap-2 mt-1" style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}>
          <MaterialIcons name="save" size={21} color="#FFFFFF" />
          <Text className="text-white font-bold text-base">حفظ الزيارة</Text>
        </Pressable>
      </ScrollView>

      <LocationPicker visible={locationPickerVisible} value={location ? { label: "الموقع المحدد", coordinates: location } : null} onClose={() => setLocationPickerVisible(false)} onConfirm={(selected) => { setLocation(selected.coordinates); setCapturedAt(new Date().toISOString()); setLocationStatus(`تم تحديد موقع الزيارة: ${selected.label}`); setLocationPickerVisible(false); }} />
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
          else { setSelectedEntity(data.entities.find((item) => item.id === option.value) ?? null); setEntitySearch(""); }
        }}
      />
    </ScreenContainer>
  );
}
