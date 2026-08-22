import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useNetworkState } from "expo-network";
import { useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { ScreenContainer } from "@/components/screen-container";
import { notifyManagerOfOverride } from "@/lib/override-notification";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, distanceBetweenMeters, formatArabicDate, isWithinGeofence } from "@/lib/visit-utils";
import { findDailyVisitConflict } from "@/lib/visit-rules";
import { isFiniteLocation, normalizeLocation } from "@/lib/location-capture";
import { appendLocationDiagnostic, type LocationDiagnostic } from "@/lib/location-diagnostics";
import { MedicalEntity, Representative, VisitLocation, VisitVerificationStatus } from "@/shared/visit-types";
import { hasRequiredVisitedItems } from "@/lib/visit-form-rules";

type PickerTarget = "representative" | "entity" | null;

function entityMatchScore(name: string, helper: string, query: string) {
  if (!query) return 99;
  const normalizedName = name.toLocaleLowerCase();
  const normalizedQuery = query.toLocaleLowerCase();
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.split(/\s+/).some((part) => part.startsWith(normalizedQuery))) return 2;
  if (normalizedName.includes(normalizedQuery)) return 3;
  if (helper.toLocaleLowerCase().includes(normalizedQuery)) return 4;
  return 5;
}

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
  const [locationStatus, setLocationStatus] = useState("سيتم التقاط الموقع والوقت تلقائياً عند الضغط على حفظ الزيارة.");
  const [locationSource, setLocationSource] = useState<"gps" | "last_known" | null>(null);
  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [overridePin, setOverridePin] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selectedVisitedItems, setSelectedVisitedItems] = useState<string[]>([]);
  const [visitedItemsSearch, setVisitedItemsSearch] = useState("");
  const [visitedItemsModalVisible, setVisitedItemsModalVisible] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");
  const activeRepresentative = session?.representativeId ? data.representatives.find((item) => item.id === session.representativeId) : undefined;
  const representativeForVisit = isManager ? selectedRepresentative : activeRepresentative;
  const availableVisitedItems = isManager ? data.settings.visitedItems : (activeRepresentative?.assignedItems ?? []);
  const filteredVisitedItems = availableVisitedItems.filter((item) => item.toLowerCase().includes(visitedItemsSearch.trim().toLowerCase()));
  const internetAvailable = networkState.isInternetReachable === true;
  const logLocationDiagnostic = (entry: Omit<LocationDiagnostic, "id" | "createdAt" | "offline">) => {
    void appendLocationDiagnostic({ ...entry, offline: !internetAvailable });
  };

  const entityPickerOptions = useMemo(() => {
    const query = entitySearch.trim().toLocaleLowerCase();
    return data.entities
      .map((item) => ({ label: item.name, value: item.id, helper: [item.address?.trim() ? `العنوان: ${item.address.trim()}` : "العنوان: غير مسجل", [item.kind, item.category ? `الفئة: ${item.category}` : "", item.specialty ? `التخصص: ${item.specialty}` : ""].filter(Boolean).join(" · "), item.nearestPharmacy ? `أقرب صيدلية: ${item.nearestPharmacy}` : "أقرب صيدلية: غير محددة", item.geographicLocation ? `الموقع: ${item.geographicLocation}` : ""].filter(Boolean).join("\n") }))
      .filter((item) => !query || `${item.label} ${item.helper}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => entityMatchScore(a.label, a.helper, query) - entityMatchScore(b.label, b.helper, query) || a.label.localeCompare(b.label, "ar"));
  }, [data.entities, entitySearch]);
  const pickerOptions = useMemo(() => picker === "representative" ? data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id })) : entityPickerOptions, [data.representatives, entityPickerOptions, picker]);

  const captureLocation = async (): Promise<VisitLocation | null> => {
    setIsLocating(true);
    setLocationSource(null);
    logLocationDiagnostic({ stage: "started", result: "pending", source: "none", message: "بدأت محاولة التقاط الموقع عند حفظ الزيارة." });
    setLocationStatus("جاري التقاط موقعك الحالي تلقائياً...");
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) { setLocationStatus("خدمة الموقع متوقفة. شغّل GPS ثم أعد المحاولة."); logLocationDiagnostic({ stage: "failure", result: "failed", source: "none", message: "فشل الالتقاط: خدمة الموقع/GPS متوقفة." }); Alert.alert("خدمة الموقع متوقفة", "يرجى تشغيل خدمة الموقع في الجهاز ثم المحاولة."); return null; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { setLocationStatus("تم رفض إذن الموقع؛ لا يمكن تسجيل زيارة موثقة."); logLocationDiagnostic({ stage: "permission", result: "failed", source: "none", message: `فشل الالتقاط: حالة إذن الموقع هي ${permission.status}.` }); Alert.alert("يلزم إذن الموقع", "يُستخدم الموقع فقط لتوثيق مكان الزيارة عند التسجيل."); return null; }
      let result: Location.LocationObject | null = null;
      let usedLastKnown = false;
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 30000));
        result = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
          timeout,
        ]);
      } catch {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120000, requiredAccuracy: 100 });
        const lastKnownAge = lastKnown ? Date.now() - lastKnown.timestamp : Number.POSITIVE_INFINITY;
        if (lastKnown && lastKnownAge >= 0 && lastKnownAge <= 120000) {
          result = lastKnown;
          usedLastKnown = true;
          setLocationSource("last_known");
          logLocationDiagnostic({ stage: "last_known", result: "success", source: "last_known", accuracy: lastKnown.coords.accuracy, latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude, message: "استُخدم آخر موقع GPS حديث محفوظ على الجهاز بعد انتهاء محاولة التقاط موقع جديد." });
          setLocationStatus("تعذر الحصول على إصلاح GPS جديد؛ استُخدم آخر موقع GPS حديث محفوظ على الجهاز دون إنترنت.");
        } else {
          setLocationStatus("لم يصل إصلاح GPS خلال 30 ثانية. ابقَ في مكان مفتوحاً ثم أعد المحاولة.");
          logLocationDiagnostic({ stage: "failure", result: "failed", source: "none", message: "فشل الالتقاط: لم يصل إصلاح GPS حديث خلال 30 ثانية ولا يوجد آخر موقع مناسب." });
          Alert.alert("لم يثبت موقع GPS", "لا حاجة للإنترنت لالتقاط GPS، لكن الهاتف يحتاج وقتاً وإشارة أقمار صناعية. اخرج إلى مكان مفتوح ثم اضغط حفظ الزيارة مرة أخرى.");
          return null;
        }
      }
      const nextLocation = normalizeLocation(result.coords, Date.now());
      if (!nextLocation || !isFiniteLocation(nextLocation)) {
        setLocationStatus("أعاد الهاتف إحداثيات غير صالحة؛ لم تُحفظ الزيارة.");
        logLocationDiagnostic({ stage: "failure", result: "failed", source: "none", message: "فشل الالتقاط: أعاد الهاتف إحداثيات غير صالحة." });
        Alert.alert("إحداثيات غير صالحة", "لم يتم حفظ الزيارة لحماية سجل الموقع. أعد المحاولة بعد التأكد من تفعيل GPS.");
        return null;
      }
      if (!usedLastKnown) { setLocationSource("gps"); logLocationDiagnostic({ stage: "success", result: "success", source: "gps", accuracy: nextLocation.accuracy, latitude: nextLocation.latitude, longitude: nextLocation.longitude, message: "تم التقاط موقع GPS جديد بنجاح." }); }
      setLocation(nextLocation); setCapturedAt(new Date().toISOString());
      if (!usedLastKnown) setLocationStatus(`تم التقاط الموقع تلقائياً بنجاح${internetAvailable ? " — الاتصال متاح" : " — GPS يعمل دون إنترنت وسيُتحقق لاحقاً"}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return nextLocation;
    } catch (error) { const reason = error instanceof Error ? error.message : "خطأ غير معروف"; setLocationStatus("تعذر التقاط الموقع. تأكد من إشارة GPS ثم أعد المحاولة."); logLocationDiagnostic({ stage: "failure", result: "failed", source: "none", message: `استثناء أثناء التقاط الموقع: ${reason}` }); Alert.alert("تعذر تحديد الموقع", "تأكد من وجود إشارة GPS جيدة ثم أعد المحاولة."); return null; }
    finally { setIsLocating(false); }
  };


  const persistVisit = (managerOverride = false, reason = "", capturedLocation = location, capturedTimestamp = capturedAt) => {
    if (!representativeForVisit || !selectedEntity || !capturedTimestamp || !capturedLocation) return;
    const verificationStatus: VisitVerificationStatus = managerOverride ? "override" : isManager ? "verified" : "pending";
    const createdVisit = {
      id: buildId("visit"), representativeId: representativeForVisit?.id ?? "", entityId: selectedEntity.id,
      entityName: selectedEntity.name, entityKind: selectedEntity.kind, nearestPharmacy: selectedEntity.nearestPharmacy,
      geographicCoordinates: selectedEntity.geographicCoordinates, entityRegion: selectedEntity.region, entityAddress: selectedEntity.address,
      specialty: selectedEntity.specialty, category: selectedEntity.category, geographicLocation: selectedEntity.geographicLocation,
      recordedAt: capturedTimestamp, location: capturedLocation, notes: notes.trim(), photoUri: photoUri ?? undefined, visitedItems: selectedVisitedItems,
      managerOverride: managerOverride || undefined, overrideReason: managerOverride ? reason : undefined,
      verificationStatus,
      offlineRecorded: !isManager,
      verificationReason: managerOverride ? "تم اعتماد الزيارة بتجاوز مدير النظام." : isManager ? "تم التحقق عند التسجيل من حساب المدير." : "بانتظار التحقق عند عودة الاتصال.",
    };
    addVisit(createdVisit);
    if (managerOverride) void notifyManagerOfOverride({ settings: data.settings, visit: createdVisit, representativeName: representativeForVisit.name });
    setOverrideModalVisible(false); setOverridePin(""); setOverrideReason("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("تم حفظ الزيارة", managerOverride ? "تم التسجيل بتجاوز المدير مع حفظ السبب." : !isManager ? "تم حفظ الزيارة دون إنترنت، وستُراجع تلقائياً عند عودة الاتصال." : "تم تسجيل وقت وموقع الزيارة بنجاح.", [{ text: "تسجيل زيارة أخرى", onPress: () => { setSelectedEntity(null); setEntitySearch(""); setNotes(""); setCapturedAt(null); setLocation(null); setLocationSource(null); setLocationStatus("سيتم التقاط الموقع والوقت تلقائياً عند الضغط على حفظ الزيارة."); setPhotoUri(null); setSelectedVisitedItems([]); setVisitedItemsSearch(""); setTimeout(() => setPicker("entity"), 120); } }]);
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
    if (!hasRequiredVisitedItems(selectedVisitedItems)) { Alert.alert("الأصناف المزارة مطلوبة", "اختر صنفاً مزوراً واحداً على الأقل من قائمة الأصناف قبل إتمام الزيارة."); return; }
    if (!representativeForVisit) { Alert.alert("الحساب غير متاح", "تعذر تحديد حساب المندوب الحالي."); return; }
    const attemptedAt = new Date().toISOString();
    const dailyConflict = findDailyVisitConflict(data.visits, data.plannedVisits, selectedEntity.id, representativeForVisit.id, attemptedAt);
    if (dailyConflict) {
      Alert.alert("الزيارة مسجلة اليوم", `سبق تسجيل زيارة لـ«${selectedEntity.name}» اليوم بواسطة مندوب آخر. لا يمكن تكرارها إلا إذا أسند مدير النظام زيارة مستقلة لهذا المندوب.`);
      return;
    }
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
        <FormField label="اسم الطبيب أو الجهة" icon="person">
          <Pressable onPress={() => data.entities.length ? setPicker("entity") : Alert.alert("لا توجد جهات", "انتقل إلى شاشة الإدارة لإضافة جهة يدوياً أو استيراد ملف Excel.")} className="min-h-14 rounded-2xl border border-border bg-surface px-4 py-3 flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /><Text className="text-primary font-bold text-xs">فتح القائمة</Text></View><View className="items-end flex-1"><Text className={`font-bold text-right ${selectedEntity ? "text-foreground" : "text-muted"}`}>{selectedEntity?.name || (data.entities.length ? "ابحث واختر الطبيب أو الجهة" : "لا توجد جهات مسجلة")}</Text>{selectedEntity ? <View className="items-end"><Text className="text-xs text-muted text-right mt-1">{selectedEntity.address?.trim() ? `العنوان: ${selectedEntity.address.trim()}` : "العنوان: غير مسجل"}</Text><Text className="text-[11px] text-muted text-right mt-1">{[selectedEntity.kind, selectedEntity.category ? `الفئة: ${selectedEntity.category}` : "", selectedEntity.specialty ? `التخصص: ${selectedEntity.specialty}` : "", selectedEntity.nearestPharmacy ? `أقرب صيدلية: ${selectedEntity.nearestPharmacy}` : ""].filter(Boolean).join(" · ")}</Text></View> : <Text className="text-[11px] text-muted text-right mt-1">قائمة منسدلة مع بحث سريع</Text>}</View></Pressable>
        </FormField>




        <FormField label={`الأصناف المزارة${selectedVisitedItems.length ? ` (${selectedVisitedItems.length} مختار)` : ""} (اختياري)`} icon="inventory-2">
          {availableVisitedItems.length ? <><Pressable onPress={() => { setVisitedItemsSearch(""); setVisitedItemsModalVisible(true); }} className="min-h-14 rounded-2xl border border-border bg-surface px-4 py-3 flex-row-reverse items-center justify-between"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /><Text className="text-primary font-bold text-xs">فتح القائمة</Text></View><View className="items-end flex-1"><Text className={`font-bold text-right ${selectedVisitedItems.length ? "text-foreground" : "text-muted"}`}>{selectedVisitedItems.length ? `${selectedVisitedItems.length} صنف مختار` : "اختر صنفاً أو أكثر"}</Text><Text className="text-[11px] text-muted text-right mt-1">الأصناف المتاحة لهذا الحساب فقط</Text></View></Pressable>{selectedVisitedItems.length ? <View className="flex-row-reverse flex-wrap gap-2 mt-3">{selectedVisitedItems.map((item) => <View key={item} className="rounded-full bg-primary/10 border border-primary/20 px-3 py-2"><Text className="text-primary text-xs font-bold">{item}</Text></View>)}</View> : null}<Modal visible={visitedItemsModalVisible} animationType="slide" onRequestClose={() => setVisitedItemsModalVisible(false)}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 border-b border-border flex-row-reverse items-center justify-between"><Pressable onPress={() => setVisitedItemsModalVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-xl font-bold text-foreground text-right">الأصناف المزارة</Text><Text className="text-xs text-muted text-right mt-1">اختر أكثر من صنف للطبيب نفسه</Text></View></View><View className="mx-5 mt-4 h-12 rounded-xl border border-border bg-surface px-3 flex-row-reverse items-center gap-2"><MaterialIcons name="search" size={20} color="#102A43" /><TextInput value={visitedItemsSearch} onChangeText={setVisitedItemsSearch} autoFocus placeholder="بحث سريع عن صنف..." placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-full text-foreground font-semibold" /></View><Text className="text-xs text-muted text-right mx-5 mt-2">المحدد: {selectedVisitedItems.length} · النتائج: {filteredVisitedItems.length}</Text><ScrollView contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">{filteredVisitedItems.length ? filteredVisitedItems.map((item) => { const selected = selectedVisitedItems.includes(item); return <Pressable key={item} onPress={() => setSelectedVisitedItems((current) => selected ? current.filter((value) => value !== item) : [...current, item])} className={`rounded-2xl border p-4 flex-row-reverse items-center justify-between ${selected ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}><View className="flex-row-reverse items-center gap-3"><View className={`w-8 h-8 rounded-lg items-center justify-center ${selected ? "bg-primary" : "bg-background border border-border"}`}><MaterialIcons name={selected ? "check" : "add"} size={18} color={selected ? "#FFFFFF" : "#64748B"} /></View><Text className="text-foreground font-bold text-right">{item}</Text></View><Text className={`text-xs font-bold ${selected ? "text-primary" : "text-muted"}`}>{selected ? "مختار" : "اختيار"}</Text></Pressable>; }) : <View className="items-center p-8"><MaterialIcons name="search-off" size={34} color="#64748B" /><Text className="text-sm text-muted mt-3">لا توجد أصناف مطابقة للبحث.</Text></View>}</ScrollView><Pressable onPress={() => setVisitedItemsModalVisible(false)} className="mx-5 mb-6 h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="done" size={20} color="#FFFFFF" /><Text className="text-white font-bold">تم — حفظ الاختيارات</Text></Pressable></View></Modal></> : <Text className="text-sm text-muted text-right">سيضيف مدير النظام الأصناف المزارة من الإعدادات لاحقاً.</Text>}
        </FormField>

        <FormField label="ملاحظات الزيارة (اختياري)" icon="notes" value={notes} onChangeText={setNotes} placeholder="اكتب ملخصاً قصيراً للزيارة" multiline />

        {isManager ? <View className="rounded-2xl border border-border bg-surface p-4 mb-4">
          <View className="flex-row-reverse items-center gap-2 mb-3"><View className="w-7 h-7 rounded-lg bg-primary items-center justify-center"><MaterialIcons name="photo-camera" size={15} color="#FFFFFF" /></View><Text className="font-bold text-foreground">صورة الزيارة (اختياري)</Text></View>
          {photoUri ? <Image source={{ uri: photoUri }} className="w-full h-44 rounded-xl mb-3" resizeMode="cover" /> : <Text className="text-sm text-muted text-right mb-3">يمكنك التقاط صورة أو اختيارها من الجهاز وإرفاقها مع الزيارة.</Text>}
          <View className="flex-row-reverse gap-2"><Pressable onPress={takePhoto} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="photo-camera" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">التقاط صورة</Text></Pressable><Pressable onPress={choosePhoto} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="photo-library" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">اختيار صورة</Text></Pressable></View>
          {photoUri ? <Pressable onPress={() => setPhotoUri(null)} className="self-end mt-2"><Text className="text-error font-bold text-xs">إزالة الصورة</Text></Pressable> : null}
        </View> : null}

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
                {location ? <><Text className="text-xs text-muted mt-1">دقة الموقع: {location.accuracy != null ? `${Math.round(location.accuracy)} متر` : "غير متاحة"}</Text><Text className="text-xs text-primary mt-1 text-right">المصدر: {locationSource === "gps" ? "GPS مباشر من الهاتف" : "آخر موقع GPS محفوظ محلياً"}</Text><Text className="text-[11px] text-muted mt-1 text-right">الإحداثيات: {location.latitude.toFixed(6)} ، {location.longitude.toFixed(6)}</Text></> : null}
                <Text className="text-xs text-primary mt-1 text-right">{locationStatus}</Text>
              </View>
            ) : <Text className="text-muted text-right mb-3">{locationStatus}</Text>}
            <View className="gap-2">
              <View className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-3 flex-row-reverse items-center gap-2"><MaterialIcons name="gps-fixed" size={18} color="#1565C0" /><Text className="text-primary text-xs font-bold flex-1 text-right">سيتم التقاط GPS والوقت تلقائياً عند الضغط على «حفظ الزيارة».</Text></View>
            </View>
          </View>
        </View>


        <Pressable disabled={isLocating} onPress={saveVisit} className={`rounded-2xl h-14 items-center justify-center flex-row-reverse gap-2 mt-1 ${isLocating ? "bg-muted" : "bg-success"}`} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}>
          <MaterialIcons name={isLocating ? "gps-fixed" : "save"} size={21} color="#FFFFFF" />
          <Text className="text-white font-bold text-base">{isLocating ? "جاري التقاط GPS..." : "حفظ الزيارة"}</Text>
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
          else { setSelectedEntity(data.entities.find((item) => item.id === option.value) ?? null); setEntitySearch(""); }
        }}
        searchable={picker === "entity"}
        searchValue={picker === "entity" ? entitySearch : ""}
        onSearchChange={picker === "entity" ? setEntitySearch : undefined}
        searchPlaceholder="ابحث باسم الطبيب أو الجهة"
      />
    </ScreenContainer>
  );
}
