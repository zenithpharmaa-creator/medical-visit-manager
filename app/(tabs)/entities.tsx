import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as XLSX from "xlsx";
import * as Location from "expo-location";

import { InteractiveMap } from "@/components/interactive-map";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import { OfflineSanaaMap } from "@/components/offline-sanaa-map";
import { LocationPicker } from "@/components/location-picker";
import { SANAA_NEIGHBORHOODS, SANAA_NEIGHBORHOOD_SOURCE_NOTE } from "@/data/sanaa-neighborhoods";
import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { HighlightedText, SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { useAccountSession } from "@/lib/account-session";
import { buildId, ENTITY_CATEGORIES, ENTITY_KINDS, SPECIALTIES } from "@/lib/visit-utils";
import { parseEntitiesFromRows } from "@/lib/entity-import";
import { formatEntityMergeReport, mergeEntitiesSmart } from "@/lib/entity-import-merge";
import { normalizeLocation } from "@/lib/location-capture";
import { deriveSanaaLocation, getSanaaLocationFailureReason } from "@/lib/geographic-location";
import { countEntitiesUsingSharedLocation, sharedLocationMatchesCoordinates } from "@/lib/shared-locations";
import { rankEntitiesForSearch } from "@/lib/entity-search";
import { buildEntityExportRows, createEntitiesExcelFile, createEntitiesPdfFile, emailEntitiesFile, shareOrDownloadFile } from "@/lib/entity-export";
import { EntityKind, MedicalEntity, RepresentativeRegion, SharedLocation, VisitLocation } from "@/shared/visit-types";

type SelectedLocation = { label: string; coordinates?: VisitLocation };

const missingEntityFields = (entity: MedicalEntity) => [
  !entity.geographicCoordinates || !Number.isFinite(entity.geographicCoordinates.latitude) || !Number.isFinite(entity.geographicCoordinates.longitude) ? "GPS" : "",
  !entity.address?.trim() ? "العنوان" : "",
  !entity.region ? "المنطقة" : "",
  !entity.specialty?.trim() ? "التخصص" : "",
  !entity.category?.trim() ? "الفئة" : "",
  entity.kind !== "صيدلية" && !entity.nearestPharmacy?.trim() ? "أقرب صيدلية" : "",
].filter(Boolean) as string[];

const buildEntitySearchHelper = (entity: MedicalEntity) => [
  entity.kind,
  entity.specialty ? `التخصص: ${entity.specialty}` : "",
  entity.address ? `العنوان: ${entity.address}` : "العنوان: غير مسجل",
  entity.nearestPharmacy ? `أقرب صيدلية: ${entity.nearestPharmacy}` : "أقرب صيدلية: غير محددة",
  entity.geographicLocation ? `الموقع: ${entity.geographicLocation}` : "",
].filter(Boolean).join(" · ");

export default function EntitiesScreen() {
  const { data, addEntity, updateEntity, deleteEntity, replaceEntities, addSharedLocation, updateSharedLocation, deleteSharedLocation, incrementSharedLocationUsage, adjustSharedLocationUsage } = useVisitStore();
  const { session } = useAccountSession();
  const [modalVisible, setModalVisible] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [kindModal, setKindModal] = useState(false);
  const [specialtyModal, setSpecialtyModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [regionModal, setRegionModal] = useState(false);
  const [pharmacyModal, setPharmacyModal] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [sanaaModal, setSanaaModal] = useState(false);
  const [savedLocationModal, setSavedLocationModal] = useState(false);
  const [savedLocationQuery, setSavedLocationQuery] = useState("");
  const [savedLocationTarget, setSavedLocationTarget] = useState<"create" | "edit">("create");
  const [savedLocationEditorVisible, setSavedLocationEditorVisible] = useState(false);
  const [sharedLocationPickerVisible, setSharedLocationPickerVisible] = useState(false);
  const [editingSharedLocation, setEditingSharedLocation] = useState<SharedLocation | null>(null);
  const [sharedLocationName, setSharedLocationName] = useState("");
  const [sharedLocationAddress, setSharedLocationAddress] = useState("");
  const [sharedLocationLatitude, setSharedLocationLatitude] = useState("");
  const [sharedLocationLongitude, setSharedLocationLongitude] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EntityKind>("عيادة");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState<RepresentativeRegion>("north");
  const [nearestPharmacy, setNearestPharmacy] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [selectedSharedLocationId, setSelectedSharedLocationId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editKindModal, setEditKindModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<MedicalEntity | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<EntityKind>("عيادة");
  const [editNearestPharmacy, setEditNearestPharmacy] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRegion, setEditRegion] = useState<RepresentativeRegion>("north");
  const [editLatitude, setEditLatitude] = useState("");
  const [editLongitude, setEditLongitude] = useState("");
  const [editGeographicLocation, setEditGeographicLocation] = useState("");
  const [editLocationPickerVisible, setEditLocationPickerVisible] = useState(false);
  const [selectedSharedLocationForEditId, setSelectedSharedLocationForEditId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<"all" | "north" | "south">("all");
  // Use the local Sana'a map first on Android to avoid native map initialization crashes; interactive map remains opt-in.
  const [showOfflineMap, setShowOfflineMap] = useState(Platform.OS === "android");
  const [incompleteModalVisible, setIncompleteModalVisible] = useState(false);
  const [entityLimit, setEntityLimit] = useState(25);
  const [entityDropdownVisible, setEntityDropdownVisible] = useState(false);
  const [entityDropdownQuery, setEntityDropdownQuery] = useState("");
  const [entityPreviewVisible, setEntityPreviewVisible] = useState(true);
  const [capturingEntityId, setCapturingEntityId] = useState<string | null>(null);
  const [isResolvingLocations, setIsResolvingLocations] = useState(false);
  const [failedLocationReportVisible, setFailedLocationReportVisible] = useState(false);

  const pharmacyOptions = useMemo(() => {
    const names = new Set<string>();
    data.entities.forEach((entity) => {
      if (entity.kind === "صيدلية" && entity.name !== name) names.add(entity.name.trim());
      if (entity.nearestPharmacy?.trim()) names.add(entity.nearestPharmacy.trim());
    });
    return [{ label: "غير محدد", value: "" }, ...Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar" )).map((pharmacyName) => ({ label: pharmacyName, value: pharmacyName }))];
  }, [data.entities, name]);
  const incompleteEntities = useMemo(() => data.entities.filter((entity) => missingEntityFields(entity).length > 0), [data.entities]);
  const failedLocationEntities = useMemo(() => data.entities.filter((entity) => getSanaaLocationFailureReason(entity.geographicCoordinates?.latitude, entity.geographicCoordinates?.longitude)), [data.entities]);
  const visibleEntities = useMemo(() => data.entities.filter((entity) => regionFilter === "all" || entity.region === regionFilter), [data.entities, regionFilter]);
  const representativesForRegion = (entityRegion?: RepresentativeRegion) => data.representatives.filter((representative) => representative.active && (representative.region === "sanaa" || representative.region === entityRegion));
  const displayedEntities = useMemo(() => visibleEntities.slice(0, entityLimit), [visibleEntities, entityLimit]);
  const hasMoreEntities = displayedEntities.length < visibleEntities.length;
  useEffect(() => { setEntityLimit(25); }, [regionFilter, data.entities.length]);
  const loadMoreEntities = () => { if (hasMoreEntities) setEntityLimit((current) => Math.min(current + 25, visibleEntities.length)); };
  const dropdownEntities = useMemo(() => rankEntitiesForSearch(visibleEntities, entityDropdownQuery, 50), [visibleEntities, entityDropdownQuery]);
  const entityDropdownOptions = useMemo(() => dropdownEntities.map((entity) => ({
    label: entity.name,
    value: entity.id,
    helper: buildEntitySearchHelper(entity),
  })), [dropdownEntities]);
  const entityPreviewEntities = useMemo(() => dropdownEntities.slice(0, 3), [dropdownEntities]);
  const savedLocations = useMemo(() => data.savedLocations ?? [], [data.savedLocations]);
  const savedLocationOptions = useMemo(() => {
    const query = savedLocationQuery.trim().toLocaleLowerCase();
    const maxUsage = Math.max(0, ...savedLocations.map((location) => location.usageCount));
    return savedLocations.filter((location) => !query || `${location.name} ${location.address ?? ""}`.toLocaleLowerCase().includes(query)).map((location) => ({ label: location.name, value: location.id, popular: location.usageCount >= 2 && location.usageCount === maxUsage, helper: `${location.usageCount >= 2 && location.usageCount === maxUsage ? "الأكثر استخداماً · " : ""}${location.address || "عنوان غير مضاف"} · استخدم ${location.usageCount} مرة` }));
  }, [savedLocations, savedLocationQuery]);
  const selectSavedLocation = (locationId: string) => {
    const source = savedLocations.find((location) => location.id === locationId);
    if (!source) return;
    if (savedLocationTarget === "edit") {
      setEditGeographicLocation(source.name);
      setEditLatitude(String(source.coordinates.latitude));
      setEditLongitude(String(source.coordinates.longitude));
      if (!editAddress.trim() && source.address?.trim()) setEditAddress(source.address.trim());
      setSelectedSharedLocationForEditId(source.id);
    } else {
      setSelectedLocation({ label: source.name, coordinates: { ...source.coordinates } });
      setSelectedSharedLocationId(source.id);
      if (!address.trim() && source.address?.trim()) setAddress(source.address.trim());
    }
    setSavedLocationModal(false);
  };

  const openSharedLocationEditor = (location?: SharedLocation) => {
    setEditingSharedLocation(location ?? null);
    setSharedLocationName(location?.name ?? "");
    setSharedLocationAddress(location?.address ?? "");
    setSharedLocationLatitude(location ? String(location.coordinates.latitude) : "");
    setSharedLocationLongitude(location ? String(location.coordinates.longitude) : "");
    setSavedLocationModal(false);
    setSavedLocationEditorVisible(true);
  };

  const saveSharedLocation = () => {
    const trimmedName = sharedLocationName.trim();
    const latitude = Number(sharedLocationLatitude);
    const longitude = Number(sharedLocationLongitude);
    if (!trimmedName) { Alert.alert("اسم الموقع مطلوب", "اكتب اسماً واضحاً مثل «مستشفى جامعة العلوم»."); return; }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { Alert.alert("إحداثيات غير صالحة", "أدخل خط العرض بين -90 و90 وخط الطول بين -180 و180، أو اختر الموقع من الخريطة."); return; }
    const now = new Date().toISOString();
    const location: SharedLocation = { id: editingSharedLocation?.id ?? buildId("shared-location"), name: trimmedName, address: sharedLocationAddress.trim() || undefined, coordinates: { latitude, longitude, accuracy: editingSharedLocation?.coordinates.accuracy ?? null }, usageCount: editingSharedLocation?.usageCount ?? 0, createdAt: editingSharedLocation?.createdAt ?? now, updatedAt: now };
    if (editingSharedLocation) updateSharedLocation(location); else addSharedLocation(location);
    setSavedLocationEditorVisible(false);
    setEditingSharedLocation(null);
    Alert.alert(editingSharedLocation ? "تم تعديل الموقع" : "تم حفظ الموقع", editingSharedLocation ? `تم تحديث «${location.name}» في سجل المواقع المشتركة.` : `تم حفظ «${location.name}» ويمكن استخدامه عند إضافة أي جهة جديدة.`);
  };

  const openEdit = (entity: MedicalEntity) => {
    const linkedLocation = savedLocations.find((location) => entity.sharedLocationId === location.id) ?? savedLocations.find((location) => sharedLocationMatchesCoordinates(location, entity.geographicCoordinates));
    setEditingEntity(entity); setEditName(entity.name); setEditKind(entity.kind); setEditNearestPharmacy(entity.nearestPharmacy ?? ""); setEditAddress(entity.address ?? ""); setEditNotes(entity.notes ?? ""); setEditRegion(entity.region ?? "north"); setEditGeographicLocation(entity.geographicLocation ?? ""); setEditLatitude(entity.geographicCoordinates ? String(entity.geographicCoordinates.latitude) : ""); setEditLongitude(entity.geographicCoordinates ? String(entity.geographicCoordinates.longitude) : ""); setSelectedSharedLocationForEditId(linkedLocation?.id ?? null); setEditKindModal(false); setEditModalVisible(true);
  };

  const resolveLocationsFromCoordinates = () => {
    if (isResolvingLocations) return;
    setIsResolvingLocations(true);
    try {
      let updatedCount = 0;
      const updatedEntities = data.entities.map((entity) => {
        const coordinates = entity.geographicCoordinates;
        if (!coordinates) return entity;
        const derived = deriveSanaaLocation(coordinates.latitude, coordinates.longitude);
        if (!derived || entity.geographicLocation === derived.label) return entity;
        updatedCount += 1;
        return { ...entity, geographicLocation: derived.label };
      });
      if (updatedCount > 0) replaceEntities(updatedEntities);
      Alert.alert("تم تحميل المواقع", updatedCount ? `تم إنشاء وصف جغرافي لـ ${updatedCount} جهة من الإحداثيات المحفوظة دون إنترنت.` : "لا توجد جهات جديدة تحتاج إنشاء وصف جغرافي من الإحداثيات.");
    } finally { setIsResolvingLocations(false); }
  };

  const captureEntityLocation = async (entity: MedicalEntity) => {
    setCapturingEntityId(entity.id);
    try {
      if (!(await Location.hasServicesEnabledAsync())) { Alert.alert("خدمة الموقع متوقفة", "فعّل GPS من إعدادات الهاتف ثم أعد المحاولة."); return; }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { Alert.alert("إذن الموقع مطلوب", "اسمح للتطبيق باستخدام الموقع حتى يتم حفظ إحداثيات الطبيب."); return; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true });
      const coordinates = normalizeLocation(current.coords);
      if (!coordinates) { Alert.alert("إحداثيات غير صالحة", "لم يتم حفظ الموقع لحماية بيانات الطبيب."); return; }
      updateEntity({ ...entity, geographicCoordinates: coordinates, geographicLocation: entity.geographicLocation || "موقع محدث ميدانياً" });
      Alert.alert("تم حفظ الموقع", `تم تحديث إحداثيات ${entity.name} محلياً. ستبقى محفوظة دون إنترنت.`);
    } catch {
      Alert.alert("تعذر التقاط الموقع", "تأكد من تفعيل GPS ووجود إشارة أقمار صناعية، ثم أعد المحاولة في مكان مفتوح.");
    } finally { setCapturingEntityId(null); }
  };

  const confirmDeleteEntity = () => {
    if (!editingEntity) return;
    const entity = editingEntity;
    Alert.alert(
      "تأكيد حذف جهة الزيارة",
      `هل تريد حذف «${entity.name}» نهائياً من قائمة الجهات؟ ستبقى الزيارات التاريخية محفوظة في التقارير.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الجهة",
          style: "destructive",
          onPress: () => {
            deleteEntity(entity.id);
            setEditModalVisible(false);
            setEditingEntity(null);
            Alert.alert("تم الحذف", `تم حذف جهة «${entity.name}» من القائمة.`);
          },
        },
      ],
    );
  };

  const confirmDeleteSharedLocation = (location: SharedLocation) => {
    const linkedCount = countEntitiesUsingSharedLocation(data.entities, location);
    if (linkedCount > 0) {
      Alert.alert("لا يمكن حذف الموقع", `الموقع «${location.name}» مرتبط حالياً بـ ${linkedCount} جهة. غيّر مواقع الجهات المرتبطة أولاً ثم أعد المحاولة.`);
      return;
    }
    Alert.alert("تأكيد حذف الموقع", `هل تريد حذف الموقع المشترك «${location.name}»؟ لن تُحذف أي جهة أو زيارة.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف الموقع", style: "destructive", onPress: () => { deleteSharedLocation(location.id); setSavedLocationEditorVisible(false); setEditingSharedLocation(null); Alert.alert("تم الحذف", `تم حذف «${location.name}» من المواقع المشتركة.`); } },
    ]);
  };

  const saveEdit = () => {
    if (!editingEntity) return;
    if (!editName.trim()) { Alert.alert("اكتب اسم الطبيب", "اسم الطبيب حقل مطلوب قبل الحفظ."); return; }
    const latitude = Number(editLatitude); const longitude = Number(editLongitude);
    const isUnlinkingSharedLocation = selectedSharedLocationForEditId === "__unlink__";
    const coordinates = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, accuracy: editingEntity.geographicCoordinates?.accuracy ?? null } : isUnlinkingSharedLocation ? undefined : editingEntity.geographicCoordinates;
    const previousSharedLocation = savedLocations.find((location) => editingEntity.sharedLocationId === location.id) ?? savedLocations.find((location) => sharedLocationMatchesCoordinates(location, editingEntity.geographicCoordinates));
    const nextSharedLocationId = isUnlinkingSharedLocation ? undefined : selectedSharedLocationForEditId ?? undefined;
    updateEntity({ ...editingEntity, name: editName.trim(), kind: session?.role === "manager" ? editKind : editingEntity.kind, nearestPharmacy: editNearestPharmacy.trim(), address: editAddress.trim(), notes: editNotes.trim(), region: editRegion, geographicLocation: isUnlinkingSharedLocation ? "" : editGeographicLocation.trim(), geographicCoordinates: coordinates, sharedLocationId: nextSharedLocationId });
    if (previousSharedLocation && (isUnlinkingSharedLocation || selectedSharedLocationForEditId !== previousSharedLocation.id)) adjustSharedLocationUsage(previousSharedLocation.id, -1);
    if (!isUnlinkingSharedLocation && selectedSharedLocationForEditId && selectedSharedLocationForEditId !== previousSharedLocation?.id) incrementSharedLocationUsage(selectedSharedLocationForEditId);
    setEditModalVisible(false); setEditingEntity(null); setSelectedSharedLocationForEditId(null);
  };

  const resetForm = () => {
    setName(""); setKind("عيادة"); setContactName(""); setAddress(""); setSpecialty(""); setCategory(""); setRegion("north"); setNearestPharmacy(""); setSelectedLocation(null); setSelectedSharedLocationId(null);
  };

  const saveEntity = () => {
    if (!name.trim()) { Alert.alert("اكتب اسم الطبيب", "اسم الطبيب حقل مطلوب قبل الحفظ."); return; }
    if (!selectedLocation) { Alert.alert("الموقع الجغرافي إلزامي", "اختر منطقة صنعاء من القائمة offline أو استخدم تحديد موقعي الحالي أو الخريطة."); return; }
    addEntity({ id: buildId("entity"), name: name.trim(), kind, contactName: contactName.trim(), address: address.trim(), specialty: specialty.trim(), category: category.trim(), region, geographicLocation: selectedLocation.label, geographicCoordinates: selectedLocation.coordinates, sharedLocationId: selectedSharedLocationId ?? undefined, nearestPharmacy: nearestPharmacy.trim(), createdAt: new Date().toISOString() });
    if (selectedSharedLocationId) incrementSharedLocationUsage(selectedSharedLocationId);
    resetForm(); setModalVisible(false); setSuccessVisible(true);
  };

  const showMergeReport = (result: ReturnType<typeof mergeEntitiesSmart>) => {
    const report = formatEntityMergeReport(result);
    const conflictSummary = report.conflictDetails.slice(0, 5).map((item) => `• ${item.message}`).join("\n");
    const details = `جديدة: ${report.added}\nمحدثة: ${report.updated}\nمكررة دون تغيير: ${report.duplicates}\nمتعارضة: ${report.conflicts}${conflictSummary ? `\n\nتفاصيل التعارضات:\n${conflictSummary}${report.conflicts > 5 ? "\n… توجد تعارضات أخرى في هذا الاستيراد." : ""}` : ""}`;
    Alert.alert("نتيجة الدمج الذكي", details, [{ text: "إغلاق", style: "cancel" }]);
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
      Alert.alert("تمت قراءة الملف", `تم العثور على ${entities.length} طبيباً${missingLocation ? `، منهم ${missingLocation} بلا موقع جغرافي` : ""}. اختر طريقة المعالجة:`, [{ text: "إلغاء", style: "cancel" }, { text: "دمج ذكي", onPress: () => { const result = mergeEntitiesSmart(data.entities, entities); replaceEntities(result.entities); showMergeReport(result); } }, { text: "استبدال بالكامل", style: "destructive", onPress: () => replaceEntities(entities) }]);
    } catch { Alert.alert("تعذر استيراد الملف", "تأكد أن الملف بصيغة Excel أو CSV وأن الصف الأول يحتوي عناوين الأعمدة."); } finally { setIsImporting(false); }
  };

  const exportEntities = async () => {
    if (isExporting) return;
    const rows = buildEntityExportRows(data.entities);
    if (!rows.length) { Alert.alert("لا توجد جهات", "أضف جهة زيارة واحدة على الأقل قبل التصدير."); return; }
    setIsExporting(true);
    try {
      Alert.alert("تصدير جهات الزيارة", `سيتم تصدير ${rows.length} جهة. اختر الصيغة المطلوبة.`, [
        { text: "إلغاء", style: "cancel" },
        { text: "PDF ثم مشاركة/تحميل", onPress: () => void exportEntitiesFile(rows, "pdf", "share") },
        { text: "Excel ثم مشاركة/تحميل", onPress: () => void exportEntitiesFile(rows, "xlsx", "share") },
        { text: "إرسال عبر البريد", onPress: () => void exportEntitiesFile(rows, "xlsx", "email") },
      ]);
    } finally {
      setIsExporting(false);
    }
  };

  const exportEntitiesFile = async (rows: ReturnType<typeof buildEntityExportRows>, format: "pdf" | "xlsx", mode: "share" | "email") => {
    setIsExporting(true);
    try {
      const uri = format === "pdf" ? await createEntitiesPdfFile(rows) : await createEntitiesExcelFile(rows);
      if (mode === "email") await emailEntitiesFile(uri);
      else await shareOrDownloadFile(uri, format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      Alert.alert("تم التصدير", "تم تجهيز الملف. يمكنك مشاركته أو حفظه من نافذة النظام.");
    } catch (error) {
      Alert.alert("تعذر التصدير", error instanceof Error ? error.message : "حدث خطأ أثناء إنشاء الملف.");
    } finally {
      setIsExporting(false);
    }
  };

  const entityKindOptions = ENTITY_KINDS.map((entityKind) => ({ label: entityKind, value: entityKind }));

  return <ScrollView className="flex-1 bg-background px-5 pt-[18px]" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" nestedScrollEnabled><ScreenHeader title="الأطباء وجهات الزيارة" subtitle="سجّل اسم الطبيب ونوع الجهة وموقعها الإلزامي" icon="local-hospital" /><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => setModalVisible(true)} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name="add" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">إضافة طبيب</Text></Pressable><Pressable onPress={importExcel} disabled={isImporting} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed || isImporting ? 0.75 : 1 }]}><MaterialIcons name="upload-file" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">{isImporting ? "جاري القراءة..." : "استيراد Excel"}</Text></Pressable><Pressable onPress={exportEntities} disabled={isExporting} className="flex-1 h-11 rounded-xl bg-success items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed || isExporting ? 0.75 : 1 }]}><MaterialIcons name="file-download" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">{isExporting ? "جاري التصدير" : "تصدير"}</Text></Pressable></View>{session?.role === "manager" ? <><View className="flex-row-reverse gap-2 mb-4"><Pressable disabled={isResolvingLocations} onPress={resolveLocationsFromCoordinates} className={`flex-1 rounded-2xl border p-3 flex-row-reverse items-center gap-2 ${isResolvingLocations ? "bg-muted/10 border-muted/20" : "bg-primary/10 border-primary/25"}`}><MaterialIcons name="my-location" size={21} color={isResolvingLocations ? "#7C8798" : "#1565C0"} /><Text className="flex-1 text-primary text-right text-xs font-bold">{isResolvingLocations ? "جاري تحديث جميع المواقع..." : "تحديث وتحميل جميع المواقع"}</Text></Pressable></View><Pressable onPress={() => setFailedLocationReportVisible(true)} className="rounded-2xl bg-error/10 border border-error/25 p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-error/15 items-center justify-center"><MaterialIcons name="location-off" size={23} color="#B42318" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">تقرير فشل تحديد الحي</Text><Text className="text-xs text-muted text-right mt-1">مراجعة الإحداثيات التي لا تطابق أحياء صنعاء المحلية</Text></View><View className="rounded-full bg-error px-3 py-1.5"><Text className="text-white font-bold">{failedLocationEntities.length}</Text></View><MaterialIcons name="chevron-left" size={22} color="#B42318" /></Pressable><Pressable onPress={() => setIncompleteModalVisible(true)} className="rounded-2xl bg-warning/10 border border-warning/25 p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-warning/20 items-center justify-center"><MaterialIcons name="assignment-late" size={23} color="#B45309" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">سجل الجهات غير المكتملة</Text><Text className="text-xs text-muted text-right mt-1">جهات تحتاج استكمال GPS أو العنوان أو بيانات التصنيف</Text></View><View className="rounded-full bg-warning px-3 py-1.5"><Text className="text-white font-bold">{incompleteEntities.length}</Text></View><MaterialIcons name="chevron-left" size={22} color="#B45309" /></Pressable><Modal visible={incompleteModalVisible} animationType="slide" onRequestClose={() => setIncompleteModalVisible(false)}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 flex-row-reverse items-center justify-between border-b border-border"><Pressable onPress={() => setIncompleteModalVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-xl font-bold text-foreground text-right">الجهات غير المكتملة</Text><Text className="text-xs text-muted text-right mt-1">اضغط «استكمال» لتعديل البيانات وGPS</Text></View></View><FlatList data={incompleteEntities} keyExtractor={(item) => `incomplete-${item.id}`} contentContainerStyle={{ padding: 18, gap: 12 }} ListEmptyComponent={() => <View className="items-center p-8"><MaterialIcons name="task-alt" size={40} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد جهات ناقصة</Text><Text className="text-sm text-muted text-center mt-1">جميع بيانات الجهات مكتملة.</Text></View>} renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-center gap-2"><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-primary text-right mt-1">{item.kind}</Text></View><MaterialIcons name={item.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={23} color="#1565C0" /></View><View className="flex-row-reverse flex-wrap gap-2 mt-3">{missingEntityFields(item).map((field) => <View key={field} className="rounded-full bg-error/10 border border-error/20 px-2.5 py-1"><Text className="text-error text-[10px] font-bold">ناقص: {field}</Text></View>)}</View><View className="flex-row-reverse gap-2 mt-3"><Pressable disabled={capturingEntityId === item.id} onPress={() => void captureEntityLocation(item)} className={`flex-1 h-11 rounded-xl items-center justify-center flex-row-reverse gap-1 ${capturingEntityId === item.id ? "bg-muted" : "bg-success"}`}><MaterialIcons name="my-location" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">{capturingEntityId === item.id ? "جاري الالتقاط..." : "تحديث GPS الآن"}</Text></Pressable><Pressable onPress={() => { setIncompleteModalVisible(false); openEdit(item); }} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="edit" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">استكمال يدوياً</Text></Pressable></View></View>} /></View></Modal><Modal visible={failedLocationReportVisible} animationType="slide" onRequestClose={() => setFailedLocationReportVisible(false)}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 flex-row-reverse items-center justify-between border-b border-border"><Pressable onPress={() => setFailedLocationReportVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-xl font-bold text-foreground text-right">تقرير فشل تحديد الحي</Text><Text className="text-xs text-muted text-right mt-1">{failedLocationEntities.length} سجل يحتاج مراجعة الإحداثيات</Text></View></View><FlatList data={failedLocationEntities} keyExtractor={(item) => `failed-location-${item.id}`} contentContainerStyle={{ padding: 18, gap: 12 }} ListEmptyComponent={() => <View className="items-center p-8"><MaterialIcons name="task-alt" size={40} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد سجلات فاشلة</Text><Text className="text-sm text-muted text-center mt-1">تم تحديد الأحياء لجميع الإحداثيات الصالحة.</Text></View>} renderItem={({ item }) => { const coordinates = item.geographicCoordinates; const reason = getSanaaLocationFailureReason(coordinates?.latitude, coordinates?.longitude) ?? "تعذر تحديد الحي"; return <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-center gap-2"><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-primary text-right mt-1">{item.kind} · {item.region === "south" ? "جنوب صنعاء" : "شمال صنعاء"}</Text></View><MaterialIcons name="location-off" size={23} color="#B42318" /></View><View className="rounded-xl bg-error/5 border border-error/15 p-3 mt-3"><Text className="text-error text-xs font-bold text-right">سبب الفشل: {reason}</Text><Text className="text-muted text-xs text-right mt-2">خط العرض: {coordinates?.latitude ?? "غير موجود"}</Text><Text className="text-muted text-xs text-right mt-1">خط الطول: {coordinates?.longitude ?? "غير موجود"}</Text></View><Pressable onPress={() => { setFailedLocationReportVisible(false); openEdit(item); }} className="h-11 rounded-xl bg-primary mt-3 items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="edit-location" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">مراجعة وتعديل الإحداثيات</Text></Pressable></View>; }} /></View></Modal></> : null}<View className="rounded-2xl overflow-hidden border border-border bg-surface mb-4" style={{ height: 260 }}><View className="px-3 py-3 flex-row-reverse items-stretch gap-2"><View className="flex-1 min-h-16 rounded-xl border-2 border-foreground bg-background px-2 py-2 items-center justify-center"><Text className="font-bold text-foreground text-center text-[11px]" numberOfLines={2}>خريطة مواقع الأطباء</Text><Text className="text-xs text-muted text-center mt-1">{data.entities.filter((entity) => entity.geographicCoordinates).length} مواقع محددة</Text></View><Pressable disabled={isResolvingLocations} onPress={resolveLocationsFromCoordinates} className={`flex-1 min-h-16 rounded-xl border-2 px-2 py-2 items-center justify-center flex-row-reverse gap-1 ${isResolvingLocations ? "bg-muted/10 border-muted" : "bg-background border-primary"}`} style={({ pressed }) => [{ opacity: pressed || isResolvingLocations ? 0.75 : 1 }]}><MaterialIcons name="refresh" size={18} color={isResolvingLocations ? "#7C8798" : "#1565C0"} /><Text className="text-primary text-[10px] font-bold text-center" numberOfLines={2}>{isResolvingLocations ? "جاري التحديث" : "تحديث المواقع"}</Text></Pressable><Pressable onPress={() => setShowOfflineMap((value) => !value)} className="flex-1 min-h-16 rounded-xl border-2 border-success bg-background px-2 py-2 items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><MaterialIcons name={showOfflineMap ? "map" : "cloud-off"} size={18} color="#16835B" /><Text className="text-success text-[10px] font-bold text-center" numberOfLines={2}>{showOfflineMap ? "الخريطة التفاعلية" : "خريطة offline"}</Text></Pressable></View><View className="flex-1">{showOfflineMap ? <OfflineSanaaMap entities={visibleEntities} /> : <MapErrorBoundary fallback={<><Text className="text-foreground font-bold text-center mt-2">تعذر تحميل الخريطة</Text><Text className="text-muted text-xs text-center mt-1">يمكنك متابعة قائمة الأطباء وإضافة أو تعديل البيانات دون الخريطة.</Text></>}><InteractiveMap visits={[]} entities={visibleEntities} representatives={data.representatives} initialRegion={{ latitude: 15.3694, longitude: 44.191, latitudeDelta: 0.12, longitudeDelta: 0.12 }} /></MapErrorBoundary>}</View></View><View className="rounded-2xl bg-surface border border-primary/30 p-3 mb-4"><Text className="font-bold text-foreground text-right mb-2">بحث في جهات الزيارة</Text><Pressable onPress={() => { setEntityDropdownQuery(""); setEntityDropdownVisible(true); }} className="min-h-14 rounded-xl border-2 border-primary bg-background px-3 py-2 flex-row-reverse items-center gap-2" accessibilityRole="button" accessibilityLabel="فتح البحث عن طبيب أو جهة" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="search" size={21} color="#1257A6" /><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">اضغط للبحث عن طبيب أو جهة</Text><Text className="text-[11px] text-muted text-right mt-1">{visibleEntities.length} جهة متاحة بعد فلتر المنطقة</Text></View><MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" /></Pressable><Text className="text-xs text-muted text-right mt-2">اكتب الأحرف الأولى داخل القائمة لتصفية الاسم أو العنوان أو أقرب صيدلية.</Text><Text className="font-bold text-foreground text-right mt-3 mb-2">تصفية حسب المنطقة</Text><View className="flex-row-reverse gap-2"><Pressable onPress={() => setRegionFilter("all")} className={`flex-1 h-11 rounded-xl items-center justify-center ${regionFilter === "all" ? "bg-foreground" : "bg-background border border-border"}`}><Text className={regionFilter === "all" ? "text-white font-bold text-xs" : "text-foreground font-bold text-xs"}>الكل</Text></Pressable><Pressable onPress={() => setRegionFilter("north")} className={`flex-1 h-11 rounded-xl items-center justify-center ${regionFilter === "north" ? "bg-primary" : "bg-background border border-border"}`}><Text className={regionFilter === "north" ? "text-white font-bold text-xs" : "text-foreground font-bold text-xs"}>شمال صنعاء</Text></Pressable><Pressable onPress={() => setRegionFilter("south")} className={`flex-1 h-11 rounded-xl items-center justify-center ${regionFilter === "south" ? "bg-warning" : "bg-background border border-border"}`}><Text className={regionFilter === "south" ? "text-white font-bold text-xs" : "text-foreground font-bold text-xs"}>جنوب صنعاء</Text></Pressable></View></View>{entityPreviewVisible ? <View className="mt-3 rounded-2xl border border-primary/20 bg-background p-3"><View className="flex-row-reverse items-center justify-between mb-2"><View className="items-end flex-1"><Text className="font-bold text-foreground text-right">معاينة نتائج البحث</Text><Text className="text-[11px] text-muted text-right mt-1">{entityDropdownQuery.trim() ? `نتائج مطابقة لـ «${entityDropdownQuery.trim()}»` : "أول النتائج حسب الفلتر الحالي"}</Text></View><Pressable onPress={() => setEntityPreviewVisible(false)} accessibilityRole="button" accessibilityLabel="إخفاء معاينة البحث" className="rounded-lg bg-surface px-2.5 py-1.5" style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}><Text className="text-primary text-[11px] font-bold">إخفاء</Text></Pressable></View>{entityPreviewEntities.length ? entityPreviewEntities.map((entity) => <Pressable key={`preview-${entity.id}`} onPress={() => openEdit(entity)} accessibilityRole="button" accessibilityLabel={`فتح بيانات ${entity.name}`} className="rounded-xl border border-border bg-surface p-3 mb-2 flex-row-reverse items-center gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}><View className="flex-1 items-end"><HighlightedText text={entity.name} query={entityDropdownQuery} className="font-bold text-foreground text-right" numberOfLines={1} /><HighlightedText text={buildEntitySearchHelper(entity)} query={entityDropdownQuery} className="text-[11px] text-muted text-right mt-1" numberOfLines={2} /></View><View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center"><MaterialIcons name={entity.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={19} color="#1565C0" /></View><MaterialIcons name="chevron-left" size={20} color="#64748B" /></Pressable>) : <View className="items-center py-4"><MaterialIcons name="search-off" size={26} color="#7C8798" /><Text className="text-muted text-xs font-bold mt-2">لا توجد نتائج مطابقة</Text></View>}<Pressable onPress={() => { setEntityDropdownQuery(""); setEntityDropdownVisible(true); }} accessibilityRole="button" accessibilityLabel="فتح القائمة الكاملة للبحث" className="h-10 rounded-xl bg-primary/10 border border-primary/25 items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><MaterialIcons name="expand-more" size={18} color="#1257A6" /><Text className="text-primary text-xs font-bold">فتح القائمة الكاملة والبحث</Text></Pressable></View> : <Pressable onPress={() => setEntityPreviewVisible(true)} accessibilityRole="button" accessibilityLabel="إظهار معاينة البحث" className="mt-3 h-10 rounded-xl bg-primary/10 border border-primary/25 items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}><MaterialIcons name="visibility" size={17} color="#1257A6" /><Text className="text-primary text-xs font-bold">إظهار معاينة نتائج البحث</Text></Pressable>}<SelectionModal visible={entityDropdownVisible} title="بحث عن طبيب أو جهة" options={entityDropdownOptions} onClose={() => setEntityDropdownVisible(false)} onSelect={(option) => { const entity = dropdownEntities.find((item) => item.id === option.value); if (entity) openEdit(entity); }} searchable searchValue={entityDropdownQuery} onSearchChange={setEntityDropdownQuery} searchPlaceholder="اكتب الأحرف الأولى أو ابحث بالعنوان أو أقرب صيدلية" emptyMessage="لا توجد جهات مطابقة للبحث" /><View className="rounded-xl bg-primary/10 border border-primary/20 p-3 mb-4 flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={19} color="#1565C0" /><Text className="text-primary text-xs leading-5 flex-1 text-right">الأعمدة المدعومة: اسم الطبيب، نوع الجهة، التخصص، الفئة، أقرب صيدلية، الموقع الجغرافي، خط العرض، خط الطول، المسؤول، الهاتف والعنوان. الموقع مطلوب للإضافة اليدوية.</Text></View><Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8 max-h-[92%]"><View className="flex-row-reverse justify-between items-center mb-4"><Text className="text-lg font-bold text-foreground">استكمال بيانات الطبيب</Text><Pressable onPress={() => setEditModalVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><FormField label="اسم الطبيب" icon="person" value={editName} onChangeText={setEditName} placeholder="اسم الطبيب" /><ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 12 }}>{session?.role === "manager" ? <><FormField label="الجهة" icon="business"><Pressable onPress={() => setEditKindModal(true)} className="h-14 rounded-2xl border-2 border-primary bg-surface px-4 flex-row-reverse items-center justify-between" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} accessibilityRole="button" accessibilityLabel="اختيار أو تعديل نوع الجهة"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="business" size={20} color="#1565C0" /><Text className="font-bold text-foreground">{editKind}</Text></View><MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" /></Pressable><View className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 mt-2 flex-row-reverse items-center gap-2"><MaterialIcons name="admin-panel-settings" size={17} color="#1565C0" /><Text className="text-primary text-xs font-bold flex-1 text-right">يمكن لمدير النظام اختيار الجهة أو تعديلها، بينما لا يظهر هذا الخيار للمندوبين.</Text></View></FormField><Pressable onPress={() => { setEditModalVisible(false); setEditingEntity(null); resetForm(); setModalVisible(true); }} className="h-11 rounded-xl bg-primary/10 border border-primary/25 items-center justify-center flex-row-reverse gap-2 mb-3" style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel="إضافة جهة جديدة"><MaterialIcons name="add-business" size={18} color="#1257A6" /><Text className="text-primary text-xs font-bold">إضافة جهة جديدة</Text></Pressable></> : null}<FormField label="منطقة الزيارة" icon="map"><View className="flex-row-reverse gap-2"><Pressable onPress={() => setEditRegion("north")} className={`flex-1 h-12 rounded-xl items-center justify-center ${editRegion === "north" ? "bg-primary" : "bg-surface border border-border"}`}><Text className={editRegion === "north" ? "text-white font-bold" : "text-foreground font-bold"}>شمال صنعاء</Text></Pressable><Pressable onPress={() => setEditRegion("south")} className={`flex-1 h-12 rounded-xl items-center justify-center ${editRegion === "south" ? "bg-warning" : "bg-surface border border-border"}`}><Text className={editRegion === "south" ? "text-white font-bold" : "text-foreground font-bold"}>جنوب صنعاء</Text></Pressable></View></FormField><FormField label="أقرب صيدلية" icon="local-pharmacy" value={editNearestPharmacy} onChangeText={setEditNearestPharmacy} placeholder="اكتب اسم الصيدلية" /><FormField label="العنوان أو الموقع النصي" icon="place" value={editAddress} onChangeText={setEditAddress} placeholder="الحي أو الشارع" /><FormField label="خط العرض" icon="map" value={editLatitude} onChangeText={setEditLatitude} placeholder="مثال: 15.3694" /><FormField label="خط الطول" icon="map" value={editLongitude} onChangeText={setEditLongitude} placeholder="مثال: 44.1910" /><FormField label="الملاحظات" icon="notes" value={editNotes} onChangeText={setEditNotes} placeholder="ملاحظات إضافية" /><View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={() => setEditLocationPickerVisible(true)} className="flex-1 h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="my-location" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تحديد من الخريطة أو GPS</Text></Pressable><Pressable disabled={!savedLocations.length} onPress={() => { setSavedLocationTarget("edit"); setSavedLocationQuery(""); setSavedLocationModal(true); }} className={`flex-1 h-12 rounded-xl items-center justify-center flex-row-reverse gap-2 ${savedLocations.length ? "bg-primary" : "bg-muted"}`}><MaterialIcons name="link" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">ربط هذا الموقع</Text></Pressable>{selectedSharedLocationForEditId && selectedSharedLocationForEditId !== "__unlink__" ? <Pressable onPress={() => Alert.alert("فك ارتباط الموقع", "سيتم إزالة الموقع والإحداثيات الحالية من الطبيب. يمكنك اختيار موقع جديد لاحقاً.", [{ text: "إلغاء", style: "cancel" }, { text: "فك الارتباط", style: "destructive", onPress: () => { setSelectedSharedLocationForEditId("__unlink__"); setEditLatitude(""); setEditLongitude(""); setEditGeographicLocation(""); } }])} className="flex-1 h-12 rounded-xl bg-warning/15 border border-warning/30 items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="link-off" size={18} color="#B45309" /><Text className="text-warning font-bold text-xs">فك الارتباط</Text></Pressable> : null}</View><Pressable onPress={saveEdit} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ التعديلات</Text></Pressable><Pressable onPress={confirmDeleteEntity} className="h-12 rounded-2xl bg-error/10 border border-error/30 items-center justify-center flex-row-reverse gap-2 mt-3"><MaterialIcons name="delete-outline" size={20} color="#B42318" /><Text className="text-error font-bold">حذف جهة الزيارة</Text></Pressable></ScrollView></View></View></Modal><Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8 max-h-[92%]"><View className="flex-row-reverse justify-between items-center mb-5"><Text className="text-lg font-bold text-foreground">إضافة طبيب</Text><Pressable onPress={() => setModalVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 12 }}><FormField label="اسم الطبيب" icon="person" value={name} onChangeText={setName} placeholder="مثال: د. أحمد محمد" /><FormField label="نوع الجهة" icon="category"><Pressable onPress={() => setKindModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{kind}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="التخصص" icon="medical-services"><Pressable onPress={() => setSpecialtyModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${specialty ? "text-foreground" : "text-muted"}`}>{specialty || "اختر التخصص"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="الفئة" icon="label"><Pressable onPress={() => setCategoryModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${category ? "text-foreground" : "text-muted"}`}>{category || "اختر الفئة"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="منطقة الزيارة" icon="map"><Pressable onPress={() => setRegionModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{region === "south" ? "جنوب صنعاء" : "شمال صنعاء"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="أقرب صيدلية" icon="local-pharmacy"><Pressable onPress={() => setPharmacyModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between"><Text className={`font-bold ${nearestPharmacy ? "text-foreground" : "text-muted"}`}>{nearestPharmacy || "اختر الصيدلية الأقرب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable></FormField><FormField label="المسؤول أو الهاتف (اختياري)" icon="contact-phone" value={contactName} onChangeText={setContactName} placeholder="بيانات إضافية" /><FormField label="العنوان النصي (اختياري)" icon="place" value={address} onChangeText={setAddress} placeholder="المدينة أو الحي" /><FormField label="الموقع الجغرافي *" icon="map"><View className="gap-2"><Pressable onPress={() => setSanaaModal(true)} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="offline-pin" size={19} color="#FFFFFF" /><Text className="text-white font-bold">اختيار منطقة صنعاء دون إنترنت</Text></Pressable><Pressable onPress={() => { setSavedLocationTarget("create"); setSavedLocationQuery(""); setSavedLocationModal(true); }} disabled={!savedLocationOptions.length} className={`h-12 rounded-xl items-center justify-center flex-row-reverse gap-2 ${savedLocationOptions.length ? "bg-primary" : "bg-muted"}`}><MaterialIcons name="location-searching" size={19} color="#FFFFFF" /><Text className="text-white font-bold">استخدام موقع محفوظ ({savedLocations.length})</Text></Pressable><Pressable onPress={() => setLocationPickerVisible(true)} className={`min-h-14 rounded-2xl border px-4 flex-row-reverse items-center justify-between ${selectedLocation ? "border-success bg-success/10" : "border-error bg-surface"}`}><Text className={`font-bold flex-1 text-right ${selectedLocation ? "text-success" : "text-muted"}`}>{selectedLocation ? selectedLocation.label : "حدد الموقع الحالي أو ابحث على الخريطة"}</Text><MaterialIcons name={selectedLocation ? "location-on" : "add-location-alt"} size={22} color={selectedLocation ? "#16835B" : "#C0392B"} /></Pressable><Text className="text-[11px] text-muted text-right">{SANAA_NEIGHBORHOOD_SOURCE_NOTE}</Text></View></FormField><Pressable onPress={saveEntity} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2 mt-1" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الطبيب</Text></Pressable></ScrollView></View></View></Modal><Modal visible={successVisible} transparent animationType="fade" onRequestClose={() => setSuccessVisible(false)}><View className="flex-1 items-center justify-center bg-black/35 px-6"><View className="w-full rounded-3xl bg-background p-6 items-center border border-success/30"><View className="w-16 h-16 rounded-full bg-success items-center justify-center mb-4"><MaterialIcons name="check" size={34} color="#FFFFFF" /></View><Text className="text-xl font-bold text-foreground text-center">تمت إضافة الطبيب بنجاح</Text><Text className="text-sm text-muted text-center mt-2 leading-5">تم حفظ بيانات الطبيب وإحداثيات موقعه في النظام.</Text><Pressable onPress={() => setSuccessVisible(false)} className="h-12 w-full rounded-xl bg-success items-center justify-center mt-5"><Text className="text-white font-bold">حسناً</Text></Pressable></View></View></Modal>
    <Modal visible={savedLocationEditorVisible} transparent animationType="slide" onRequestClose={() => setSavedLocationEditorVisible(false)}><View className="flex-1 justify-end bg-black/35 px-4"><View className="rounded-t-3xl bg-background p-5"><View className="flex-row-reverse items-center justify-between mb-4"><View className="flex-1 items-end"><Text className="text-xl font-bold text-foreground text-right">{editingSharedLocation ? "تعديل موقع محفوظ" : "إضافة موقع مشترك"}</Text>{editingSharedLocation ? <Text className="text-xs text-muted text-right mt-1">مرتبط بـ {countEntitiesUsingSharedLocation(data.entities, editingSharedLocation)} جهة</Text> : null}</View><View className="flex-row-reverse items-center gap-2">{editingSharedLocation ? <Pressable onPress={() => confirmDeleteSharedLocation(editingSharedLocation)} className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center" accessibilityRole="button" accessibilityLabel="حذف الموقع المحفوظ"><MaterialIcons name="delete-outline" size={21} color="#B42318" /></Pressable> : null}<Pressable onPress={() => setSavedLocationEditorVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable></View></View><Text className="text-xs text-muted text-right mb-3">احفظ موقعاً يمكن ربطه بأكثر من طبيب أو جهة، مثل مستشفى جامعة العلوم.</Text><FormField label="اسم الموقع *" icon="business" value={sharedLocationName} onChangeText={setSharedLocationName} placeholder="مثال: مستشفى جامعة العلوم" /><FormField label="العنوان" icon="place" value={sharedLocationAddress} onChangeText={setSharedLocationAddress} placeholder="الحي أو الشارع" /><Pressable onPress={() => setSharedLocationPickerVisible(true)} className="h-12 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-2 mt-1 mb-3"><MaterialIcons name="my-location" size={18} color="#FFFFFF" /><Text className="text-white font-bold">تحديد الموقع من الخريطة أو GPS</Text></Pressable><View className="flex-row-reverse gap-2"><View className="flex-1"><FormField label="خط العرض *" icon="south" value={sharedLocationLatitude} onChangeText={setSharedLocationLatitude} placeholder="15.3694" keyboardType="numeric" /></View><View className="flex-1"><FormField label="خط الطول *" icon="east" value={sharedLocationLongitude} onChangeText={setSharedLocationLongitude} placeholder="44.1910" keyboardType="numeric" /></View></View><View className="flex-row-reverse gap-2 mt-2"><Pressable onPress={() => setSavedLocationEditorVisible(false)} className="flex-1 h-12 rounded-xl bg-surface border border-border items-center justify-center"><Text className="text-foreground font-bold">إلغاء</Text></Pressable><Pressable onPress={saveSharedLocation} className="flex-1 h-12 rounded-xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="save" size={18} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الموقع</Text></Pressable></View></View></View></Modal><LocationPicker visible={sharedLocationPickerVisible} value={Number.isFinite(Number(sharedLocationLatitude)) && Number.isFinite(Number(sharedLocationLongitude)) ? { label: sharedLocationName || sharedLocationAddress || "الموقع المشترك", coordinates: { latitude: Number(sharedLocationLatitude), longitude: Number(sharedLocationLongitude), accuracy: null } } : null} onClose={() => setSharedLocationPickerVisible(false)} onConfirm={(value) => { if (value.coordinates) { setSharedLocationLatitude(String(value.coordinates.latitude)); setSharedLocationLongitude(String(value.coordinates.longitude)); } if (!sharedLocationAddress.trim() && value.label) setSharedLocationAddress(value.label); if (!sharedLocationName.trim() && value.label) setSharedLocationName(value.label); setSharedLocationPickerVisible(false); }} /><SelectionModal visible={editKindModal} title="اختيار الجهة" options={entityKindOptions} selected={editKind} onClose={() => setEditKindModal(false)} onSelect={(option) => { setEditKind(option.value as EntityKind); setEditKindModal(false); }} emptyMessage="لا توجد أنواع جهات متاحة" /><SelectionModal visible={sanaaModal} title="اختر منطقة من صنعاء — offline" options={SANAA_NEIGHBORHOODS.map((area) => ({ label: `${area.district} — ${area.name}`, value: area.id }))} selected={SANAA_NEIGHBORHOODS.find((area) => `صنعاء — ${area.district} — ${area.name}` === selectedLocation?.label)?.id} onClose={() => setSanaaModal(false)} onSelect={(option) => { const area = SANAA_NEIGHBORHOODS.find((item) => item.id === option.value); if (area) { setSelectedLocation({ label: `صنعاء — ${area.district} — ${area.name}`, coordinates: { latitude: area.latitude, longitude: area.longitude, accuracy: null } }); setSelectedSharedLocationId(null); } setSanaaModal(false); }} /><SelectionModal visible={kindModal} title="اختر نوع الجهة" options={ENTITY_KINDS.map((item) => ({ label: item, value: item }))} selected={kind} onClose={() => setKindModal(false)} onSelect={(option) => setKind(option.value as EntityKind)} /><SelectionModal visible={specialtyModal} title="اختر التخصص" options={SPECIALTIES.map((item) => ({ label: item, value: item }))} selected={specialty} onClose={() => setSpecialtyModal(false)} onSelect={(option) => setSpecialty(option.value)} /><SelectionModal visible={categoryModal} title="اختر الفئة" options={ENTITY_CATEGORIES.map((item) => ({ label: item, value: item }))} selected={category} onClose={() => setCategoryModal(false)} onSelect={(option) => setCategory(option.value)} /><SelectionModal visible={regionModal} title="اختر منطقة الطبيب" options={[{ label: "شمال صنعاء", value: "north" }, { label: "جنوب صنعاء", value: "south" }]} selected={region} onClose={() => setRegionModal(false)} onSelect={(option) => { setRegion(option.value as RepresentativeRegion); setRegionModal(false); }} /><SelectionModal visible={pharmacyModal} title="اختر أقرب صيدلية" options={pharmacyOptions} selected={nearestPharmacy} onClose={() => setPharmacyModal(false)} onSelect={(option) => setNearestPharmacy(option.value)} /><LocationPicker visible={locationPickerVisible} value={selectedLocation?.coordinates ? { label: selectedLocation.label, coordinates: selectedLocation.coordinates } : null} onClose={() => setLocationPickerVisible(false)} onConfirm={(value) => { setSelectedLocation(value); setSelectedSharedLocationId(null); setLocationPickerVisible(false); }} /><LocationPicker visible={editLocationPickerVisible} value={editingEntity?.geographicCoordinates ? { label: editingEntity.geographicLocation ?? "الموقع الحالي", coordinates: editingEntity.geographicCoordinates } : null} onClose={() => setEditLocationPickerVisible(false)} onConfirm={(value) => { setEditGeographicLocation(value.label); if (value.coordinates) { setEditLatitude(String(value.coordinates.latitude)); setEditLongitude(String(value.coordinates.longitude)); setSelectedSharedLocationForEditId(null); } setEditLocationPickerVisible(false); }} /><SelectionModal visible={savedLocationModal} title="اختيار موقع محفوظ" options={savedLocationOptions} onClose={() => setSavedLocationModal(false)} onSelect={(option) => selectSavedLocation(option.value)} onAction={() => openSharedLocationEditor()} onEdit={(option) => { const location = savedLocations.find((item) => item.id === option.value); if (location) openSharedLocationEditor(location); }} actionLabel="إضافة موقع" searchable searchValue={savedLocationQuery} onSearchChange={setSavedLocationQuery} searchPlaceholder="ابحث باسم الموقع أو العنوان..." />
  </ScrollView>;
}
