import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import * as XLSX from "xlsx";

import { LocationPicker } from "@/components/location-picker";
import { SANAA_OFFLINE_AREAS, SANAA_OFFLINE_SOURCE_NOTE } from "@/data/sanaa-offline";
import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, ENTITY_CATEGORIES, ENTITY_KINDS, SPECIALTIES } from "@/lib/visit-utils";
import { parseEntitiesFromRows } from "@/lib/entity-import";
import { EntityKind, VisitLocation } from "@/shared/visit-types";

type SelectedLocation = { label: string; coordinates?: VisitLocation };

export default function EntitiesScreen() {
  const { data, addEntity, replaceEntities } = useVisitStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [kindModal, setKindModal] = useState(false);
  const [specialtyModal, setSpecialtyModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [pharmacyModal, setPharmacyModal] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [sanaaModal, setSanaaModal] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntityKind>("عيادة");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [category, setCategory] = useState("");
  const [nearestPharmacy, setNearestPharmacy] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const pharmacies = useMemo(() => data.entities.filter((entity) => entity.kind === "صيدلية" && entity.name !== name), [data.entities, name]);

  const resetForm = () => {
    setName(""); setKind("عيادة"); setContactName(""); setAddress(""); setSpecialty(""); setCategory(""); setNearestPharmacy(""); setSelectedLocation(null);
  };

  const saveEntity = () => {
    if (!name.trim()) { Alert.alert("اكتب اسم الطبيب", "اسم الطبيب حقل مطلوب قبل الحفظ."); return; }
    if (!selectedLocation) { Alert.alert("الموقع الجغرافي إلزامي", "اختر منطقة صنعاء من القائمة offline أو استخدم تحديد موقعي الحالي أو الخريطة."); return; }
    addEntity({ id: buildId("entity"), name: name.trim(), kind, contactName: contactName.trim(), address: address.trim(), specialty: specialty.trim(), category: category.trim(), geographicLocation: selectedLocation.label, geographicCoordinates: selectedLocation.coordinates, nearestPharmacy: nearestPharmacy.trim(), createdAt: new Date().toISOString() });
    resetForm(); setModalVisible(false);
  };

  const importExcel = async () => {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = new File(result.assets[0].uri);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
      const entities = parseEntitiesFromRows(rows);
      if (!entities.length) { Alert.alert("لم نعثر على أسماء أطباء", "أضف عموداً باسم «اسم الطبيب» أو «الطبيب» في الصف الأول من ملف Excel."); return; }
      const missingLocation = entities.filter((entity) => !entity.geographicLocation).length;
      Alert.alert("تمت قراءة الملف", `تم العثور على ${entities.length} طبيباً${missingLocation ? `، منهم ${missingLocation} بلا موقع جغرافي` : ""}.`, [{ text: "إلغاء", style: "cancel" }, { text: "إضافة للقائمة", onPress: () => entities.forEach(addEntity) }, { text: "استبدال", style: "destructive", onPress: () => replaceEntities(entities) }]);
    } catch { Alert.alert("تعذر استيراد الملف", "تأكد أن الملف بصيغة Excel أو CSV وأن الصف الأول يحتوي عناوين الأعمدة."); } finally { setIsImporting(false); }
  };

  const pharmacyOptions = [{ label: "غير محدد", value: "" }, ...pharmacies.map((pharmacy) => ({ label: pharmacy.name, value: pharmacy.name }))];

  return <View className="flex-1 bg-background px-5 pt-[18px]"><ScreenHeader title="الأطباء وجهات الزيارة" subtitle="سجّل اسم الطبيب ونوع الجهة وموقعها الإلزامي" icon="local-hospital" /><View className="flex-row-reverse gap-3 mb-4"><Pressable onPress={() => setModalVisible(true)} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="add" size={20} color="#FFFFFF" /><Text className="text-white font-bold">إضافة طبيب</Text></Pressable><Pressable onPress={importExcel} disabled={isImporting} className="flex-1 h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isImporting ? 0.75 : 1 }]}><MaterialIcons name="upload-file" size={20} color="#FFFFFF" /><Text className="text-white font-bold">{isImporting ? "جاري القراءة..." : "استيراد Excel"}</Text></Pressable></View><View className="rounded-xl bg-primary/10 border border-primary/20 p-3 mb-4 flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="text-primary text-xs leading-5 flex-1 text-right">الأعمدة المدعومة: اسم الطبيب، نوع الجهة، التخصص، الفئة، أقرب صيدلية، الموقع الجغرافي، خط العرض، خط الطول، المسؤول، الهاتف والعنوان. الموقع مطلوب للإضافة اليدوية.</Text></View><FlatList data={data.entities} keyExtractor={(item) => item.id} contentContainerStyle={{ gap: 12, paddingBottom: 26, flexGrow: 1 }} ListEmptyComponent={() => <View className="rounded-2xl bg-surface border border-border p-7 items-center"><MaterialIcons name="folder-open" size={32} color="#64748B" /><Text className="font-bold text-foreground mt-3">لم يُضف أطباء بعد</Text><Text className="text-sm text-muted mt-1 text-center">أضف طبيباً يدوياً أو استورد ملف Excel.</Text></View>} renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3"><View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name={item.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={20} color="#FFFFFF" /></View><View className="items-end flex-1"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-sm text-primary font-semibold mt-1 text-right">{item.kind}</Text>{item.specialty || item.category ? <Text className="text-xs text-muted mt-1 text-right">{[item.specialty, item.category].filter(Boolean).join(" · ")}</Text> : null}{item.nearestPharmacy ? <Text className="text-xs text-muted mt-1 text-right">أقرب صيدلية: {item.nearestPharmacy}</Text> : null}<Text className={`text-xs mt-1 text-right ${item.geographicLocation ? "text-success" : "text-error"}`}>{item.geographicLocation ? `الموقع: ${item.geographicLocation}` : "الموقع غير محدد"}</Text></View></View>} />

    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8"><View className="flex-row-reverse justify-between items-center mb-5"><Text className="text-lg font-bold text-foreground">إضافة طبيب</Text><Pressable onPress={() => setModalVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><FormField label="اسم الطبيب" icon="person" value={name} onChangeText={setName} placeholder="مثال: د. أحمد محمد" /><FormField label="نوع الجهة" icon="category"><Pressable onPress={() => setKindModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{kind}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="التخصص" icon="medical-services"><Pressable onPress={() => setSpecialtyModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${specialty ? "text-foreground" : "text-muted"}`}>{specialty || "اختر التخصص"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="الفئة" icon="label"><Pressable onPress={() => setCategoryModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${category ? "text-foreground" : "text-muted"}`}>{category || "اختر الفئة"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="أقرب صيدلية" icon="local-pharmacy"><Pressable onPress={() => setPharmacyModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${nearestPharmacy ? "text-foreground" : "text-muted"}`}>{nearestPharmacy || "اختر الصيدلية الأقرب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="المسؤول أو الهاتف (اختياري)" icon="contact-phone" value={contactName} onChangeText={setContactName} placeholder="بيانات إضافية" /><FormField label="العنوان النصي (اختياري)" icon="place" value={address} onChangeText={setAddress} placeholder="المدينة أو الحي" /><FormField label="الموقع الجغرافي *" icon="map"><View className="gap-2"><Pressable onPress={() => setSanaaModal(true)} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="offline-pin" size={19} color="#FFFFFF" /><Text className="text-white font-bold">اختيار منطقة صنعاء دون إنترنت</Text></Pressable><Pressable onPress={() => setLocationPickerVisible(true)} className={`min-h-14 rounded-2xl border px-4 flex-row-reverse items-center justify-between ${selectedLocation ? "border-success bg-success/10" : "border-error bg-surface"}`}><Text className={`font-bold flex-1 text-right ${selectedLocation ? "text-success" : "text-muted"}`}>{selectedLocation ? selectedLocation.label : "حدد الموقع الحالي أو ابحث على الخريطة"}</Text><MaterialIcons name={selectedLocation ? "location-on" : "add-location-alt"} size={22} color={selectedLocation ? "#16835B" : "#C0392B"} /></Pressable><Text className="text-[11px] text-muted text-right">{SANAA_OFFLINE_SOURCE_NOTE}</Text></View></FormField><Pressable onPress={saveEntity} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2 mt-1" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الطبيب</Text></Pressable></View></View></Modal>
    <SelectionModal visible={sanaaModal} title="اختر منطقة من صنعاء — offline" options={SANAA_OFFLINE_AREAS.map((area) => ({ label: area.label, value: area.value }))} selected={selectedLocation?.label.replace("صنعاء — ", "")} onClose={() => setSanaaModal(false)} onSelect={(option) => { setSelectedLocation({ label: `صنعاء — ${option.label}` }); setSanaaModal(false); }} /><SelectionModal visible={kindModal} title="اختر نوع الجهة" options={ENTITY_KINDS.map((item) => ({ label: item, value: item }))} selected={kind} onClose={() => setKindModal(false)} onSelect={(option) => setKind(option.value as EntityKind)} /><SelectionModal visible={specialtyModal} title="اختر التخصص" options={SPECIALTIES.map((item) => ({ label: item, value: item }))} selected={specialty} onClose={() => setSpecialtyModal(false)} onSelect={(option) => setSpecialty(option.value)} /><SelectionModal visible={categoryModal} title="اختر الفئة" options={ENTITY_CATEGORIES.map((item) => ({ label: item, value: item }))} selected={category} onClose={() => setCategoryModal(false)} onSelect={(option) => setCategory(option.value)} /><SelectionModal visible={pharmacyModal} title="اختر أقرب صيدلية" options={pharmacyOptions} selected={nearestPharmacy} onClose={() => setPharmacyModal(false)} onSelect={(option) => setNearestPharmacy(option.value)} /><LocationPicker visible={locationPickerVisible} value={selectedLocation?.coordinates ? { label: selectedLocation.label, coordinates: selectedLocation.coordinates } : null} onClose={() => setLocationPickerVisible(false)} onConfirm={(value) => { setSelectedLocation(value); setLocationPickerVisible(false); }} />
  </View>;
}
