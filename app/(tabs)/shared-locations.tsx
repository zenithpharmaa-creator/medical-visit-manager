import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { LocationPicker } from "@/components/location-picker";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { countEntitiesUsingSharedLocation, entityUsesSharedLocation } from "@/lib/shared-locations";
import { createSharedLocationExcelFile, createSharedLocationPdfFile, buildSharedLocationReportRows } from "@/lib/shared-location-report";
import { shareOrDownloadFile } from "@/lib/entity-export";
import { useAccountSession } from "@/lib/account-session";
import { buildId } from "@/lib/visit-utils";
import { useVisitStore } from "@/lib/visit-store";
import type { SharedLocation, VisitLocation } from "@/shared/visit-types";

export default function SharedLocationsScreen() {
  const { data, addSharedLocation, updateSharedLocation, deleteSharedLocation, updateEntity, adjustSharedLocationUsage } = useVisitStore();
  const { session } = useAccountSession();
  const [editorVisible, setEditorVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SharedLocation | null>(null);
  const [reportLocation, setReportLocation] = useState<SharedLocation | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coordinates, setCoordinates] = useState<VisitLocation | null>(null);
  const [exportingLocationId, setExportingLocationId] = useState<string | null>(null);

  const locations = useMemo(() => [...(data.savedLocations ?? [])].sort((left, right) => right.usageCount - left.usageCount || left.name.localeCompare(right.name, "ar")), [data.savedLocations]);
  const mostUsedId = locations.find((location) => location.usageCount >= 1)?.id;
  const linkedEntities = useMemo(() => reportLocation ? data.entities.filter((entity) => entityUsesSharedLocation(entity, reportLocation)) : [], [data.entities, reportLocation]);

  const openEditor = (location?: SharedLocation) => {
    setEditingLocation(location ?? null);
    setName(location?.name ?? "");
    setAddress(location?.address ?? "");
    setCoordinates(location ? { ...location.coordinates } : null);
    setEditorVisible(true);
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) { Alert.alert("اسم الموقع مطلوب", "اكتب اسم الموقع المشترك أولاً."); return; }
    if (!coordinates) { Alert.alert("الإحداثيات مطلوبة", "حدد موقعاً من GPS أو اختره من الخريطة قبل الحفظ."); return; }
    const duplicate = locations.find((location) => location.id !== editingLocation?.id && Math.abs(location.coordinates.latitude - coordinates.latitude) < 0.000001 && Math.abs(location.coordinates.longitude - coordinates.longitude) < 0.000001);
    if (duplicate) { Alert.alert("الموقع موجود مسبقاً", `الإحداثيات مرتبطة بالموقع «${duplicate.name}». استخدمه بدلاً من إنشاء نسخة مكررة.`); return; }
    if (editingLocation) updateSharedLocation({ ...editingLocation, name: trimmedName, address: address.trim() || undefined, coordinates: { ...coordinates }, updatedAt: new Date().toISOString() });
    else addSharedLocation({ id: buildId("shared-location"), name: trimmedName, address: address.trim() || undefined, coordinates: { ...coordinates }, usageCount: 0, createdAt: new Date().toISOString() });
    setEditorVisible(false);
    setEditingLocation(null);
    Alert.alert(editingLocation ? "تم تعديل الموقع" : "تمت إضافة الموقع", editingLocation ? "تم تحديث بيانات الموقع المشترك." : "يمكنك الآن ربطه بأي جهة جديدة.");
  };

  const exportReport = async (location: SharedLocation, format: "pdf" | "excel") => {
    setExportingLocationId(location.id);
    try {
      const rows = buildSharedLocationReportRows(location, data.entities.filter((entity) => entityUsesSharedLocation(entity, location)));
      const uri = format === "pdf" ? await createSharedLocationPdfFile(location, rows) : await createSharedLocationExcelFile(location, rows);
      await shareOrDownloadFile(uri, format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (error) {
      Alert.alert("تعذر تصدير التقرير", error instanceof Error ? error.message : "حاول مرة أخرى.");
    } finally {
      setExportingLocationId(null);
    }
  };

  const chooseExportFormat = (location: SharedLocation) => Alert.alert("تصدير الجهات المرتبطة", "اختر صيغة التقرير للمشاركة أو الحفظ.", [
    { text: "PDF", onPress: () => void exportReport(location, "pdf") },
    { text: "Excel", onPress: () => void exportReport(location, "excel") },
    { text: "إلغاء", style: "cancel" },
  ]);

  const confirmDelete = (location: SharedLocation) => {
    const linkedCount = countEntitiesUsingSharedLocation(data.entities, location);
    if (linkedCount > 0) { Alert.alert("لا يمكن حذف الموقع", `الموقع مرتبط بـ ${linkedCount} جهة. افصل ارتباط الجهات أولاً ثم حاول حذفه.`); return; }
    Alert.alert("تأكيد حذف الموقع", `هل تريد حذف «${location.name}» من سجل المواقع المشتركة؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => { deleteSharedLocation(location.id); if (reportLocation?.id === location.id) setReportLocation(null); Alert.alert("تم الحذف", "تم حذف الموقع المشترك بأمان."); } },
    ]);
  };

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="font-bold text-foreground text-center mt-3">هذه الشاشة متاحة لمدير النظام فقط</Text></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="flex-1"><ScreenHeader title="المواقع المشتركة" subtitle="إدارة مواقع المستشفيات والمراكز وربطها بالجهات" icon="place" /><View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-4 flex-row-reverse items-center gap-3"><View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-city" size={23} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-primary text-right">سجل مستقل للمواقع</Text><Text className="text-xs text-muted text-right mt-1">{locations.length} موقعاً محفوظاً · تظهر الأكثر استخداماً أولاً</Text></View></View><Pressable onPress={() => openEditor()} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mb-4" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="add-location-alt" size={21} color="#FFFFFF" /><Text className="text-white font-bold">إضافة موقع مشترك</Text></Pressable><FlatList data={locations} keyExtractor={(item) => item.id} contentContainerStyle={{ gap: 10, paddingBottom: 28 }} keyboardShouldPersistTaps="handled" ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-7 items-center"><MaterialIcons name="location-off" size={38} color="#7C8798" /><Text className="font-bold text-foreground mt-3">لا توجد مواقع مشتركة</Text><Text className="text-sm text-muted text-center mt-1">أضف مستشفى أو مركزاً يمكن ربط الجهات به لاحقاً.</Text></View>} renderItem={({ item }) => { const linkedCount = countEntitiesUsingSharedLocation(data.entities, item); const popular = item.id === mostUsedId && item.usageCount > 0; return <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-start gap-3"><View className={`w-11 h-11 rounded-xl items-center justify-center ${popular ? "bg-warning" : "bg-primary"}`}><MaterialIcons name="location-on" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-muted text-right mt-1">{item.address || "العنوان غير مضاف"}</Text><Text className="text-[11px] text-primary text-right mt-1">{item.coordinates.latitude.toFixed(6)}، {item.coordinates.longitude.toFixed(6)}</Text>{popular ? <View className="rounded-full bg-warning/15 border border-warning/30 px-2 py-1 mt-2 self-end"><Text className="text-warning text-[10px] font-bold">الأكثر استخداماً</Text></View> : null}</View></View><View className="flex-row-reverse flex-wrap gap-2 mt-3"><View className="rounded-full bg-primary/10 px-2.5 py-1"><Text className="text-primary text-[11px] font-bold">استخدم {item.usageCount} مرة</Text></View><View className="rounded-full bg-success/10 px-2.5 py-1"><Text className="text-success text-[11px] font-bold">مرتبط بـ {linkedCount} جهة</Text></View></View><View className="flex-row-reverse gap-2 mt-3"><Pressable onPress={() => setReportLocation(item)} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="list-alt" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">الجهات المرتبطة</Text></Pressable><Pressable onPress={() => openEditor(item)} className="w-11 h-11 rounded-xl bg-primary/10 items-center justify-center"><MaterialIcons name="edit" size={19} color="#1257A6" /></Pressable><Pressable onPress={() => confirmDelete(item)} className="w-11 h-11 rounded-xl bg-error/10 items-center justify-center"><MaterialIcons name="delete-outline" size={20} color="#B42318" /></Pressable></View></View>; }} /></View><Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse justify-between items-center mb-4"><Text className="text-xl font-bold text-foreground">{editingLocation ? "تعديل الموقع المشترك" : "إضافة موقع مشترك"}</Text><Pressable onPress={() => setEditorVisible(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><FormField label="اسم الموقع *" icon="location-city" value={name} onChangeText={setName} placeholder="مثال: مستشفى جامعة العلوم" /><FormField label="العنوان" icon="place" value={address} onChangeText={setAddress} placeholder="الحي أو الشارع" /><Pressable onPress={() => setLocationPickerVisible(true)} className={`h-14 rounded-2xl border px-4 flex-row-reverse items-center justify-between mb-3 ${coordinates ? "border-success bg-success/10" : "border-error bg-surface"}`}><Text className={`font-bold flex-1 text-right ${coordinates ? "text-success" : "text-muted"}`}>{coordinates ? `${coordinates.latitude.toFixed(5)}، ${coordinates.longitude.toFixed(5)}` : "تحديد الموقع من GPS أو الخريطة"}</Text><MaterialIcons name={coordinates ? "location-on" : "add-location-alt"} size={22} color={coordinates ? "#16835B" : "#B42318"} /></Pressable><Pressable onPress={save} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="save" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الموقع</Text></Pressable></View></View></Modal><Modal visible={Boolean(reportLocation)} transparent animationType="slide" onRequestClose={() => setReportLocation(null)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5 max-h-[82%]"><View className="flex-row-reverse justify-between items-center mb-4"><View className="flex-1 items-end"><Text className="text-xl font-bold text-foreground text-right">الجهات المرتبطة</Text><Text className="text-xs text-muted text-right mt-1">{reportLocation?.name}</Text></View><View className="flex-row-reverse items-center gap-3"><Pressable disabled={Boolean(reportLocation && exportingLocationId === reportLocation.id)} onPress={() => reportLocation && chooseExportFormat(reportLocation)} accessibilityRole="button" accessibilityLabel="تصدير تقرير الجهات المرتبطة"><MaterialIcons name="file-download" size={23} color={reportLocation && exportingLocationId === reportLocation.id ? "#94A3B8" : "#1257A6"} /></Pressable><Pressable onPress={() => setReportLocation(null)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View></View><FlatList data={linkedEntities} keyExtractor={(item) => `linked-${item.id}`} contentContainerStyle={{ gap: 9, paddingBottom: 10 }} ListEmptyComponent={<View className="items-center p-6"><MaterialIcons name="link-off" size={34} color="#7C8798" /><Text className="font-bold text-foreground mt-2">لا توجد جهات مرتبطة</Text></View>} renderItem={({ item }) => <View className="rounded-xl bg-surface border border-border p-3 flex-row-reverse items-center gap-3"><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.name}</Text><Text className="text-xs text-muted text-right mt-1">{item.kind} · {item.address || "العنوان غير مضاف"}</Text></View><Pressable onPress={() => Alert.alert("فك ارتباط الموقع", `سيتم إزالة موقع «${reportLocation?.name ?? ""}» من «${item.name}»، ويمكنك اختيار موقع جديد لاحقاً.`, [{ text: "إلغاء", style: "cancel" }, { text: "فك الارتباط", style: "destructive", onPress: () => { updateEntity({ ...item, sharedLocationId: undefined, geographicCoordinates: undefined, geographicLocation: undefined }); if (reportLocation) adjustSharedLocationUsage(reportLocation.id, -1); Alert.alert("تم فك الارتباط", `تم فك ارتباط «${reportLocation?.name ?? "الموقع"}» من «${item.name}». اختر موقعاً جديداً عند الحاجة.`); } }])} className="w-10 h-10 rounded-xl bg-warning/10 items-center justify-center"><MaterialIcons name="link-off" size={18} color="#B45309" /></Pressable></View>} /></View></View></Modal><LocationPicker visible={locationPickerVisible} value={coordinates ? { label: name || "موقع مشترك", coordinates } : null} onClose={() => setLocationPickerVisible(false)} onConfirm={(value) => { setCoordinates({ ...value.coordinates }); if (!address.trim() && value.label !== "الموقع الحالي") setAddress(value.label); setLocationPickerVisible(false); }} /></ScreenContainer>;

}
