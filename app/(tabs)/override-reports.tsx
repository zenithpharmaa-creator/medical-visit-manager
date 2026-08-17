import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Location from "expo-location";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import * as XLSX from "xlsx";

import { ScreenContainer } from "@/components/screen-container";
import { LocationPicker } from "@/components/location-picker";
import { ScreenHeader } from "@/components/screen-header";
import { buildOverrideReportHtml, overrideRows } from "@/lib/override-report";
import { buildRejectedVisitReportHtml, rejectedVisitRows } from "@/lib/rejected-visit-report";
import { useVisitStore } from "@/lib/visit-store";
import { distanceBetweenMeters, formatArabicDate, isWithinGeofence } from "@/lib/visit-utils";

export default function OverrideReportsScreen() {
  const { data, updateVisit, updateEntity } = useVisitStore();
  const [busy, setBusy] = useState(false);
  const [editingVisit, setEditingVisit] = useState<(typeof data.visits)[number] | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const overrides = useMemo(() => data.visits.filter((visit) => visit.managerOverride).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [data.visits]);
  const rejectedVisits = useMemo(() => data.visits.filter((visit) => visit.verificationStatus === "rejected").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [data.visits]);
  const [representativeFilter, setRepresentativeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState<"all" | "north" | "south">("all");
  const [dateFilter, setDateFilter] = useState("");
  const matchesFilters = (visit: (typeof data.visits)[number]) => {
    const entity = data.entities.find((item) => item.id === visit.entityId);
    const dateMatches = !dateFilter.trim() || visit.recordedAt.slice(0, 10) === dateFilter.trim();
    const representativeMatches = representativeFilter === "all" || visit.representativeId === representativeFilter;
    const regionMatches = regionFilter === "all" || entity?.region === regionFilter;
    return dateMatches && representativeMatches && regionMatches;
  };
  const filteredRejectedVisits = useMemo(() => rejectedVisits.filter(matchesFilters), [rejectedVisits, representativeFilter, regionFilter, dateFilter, data.entities]);
  const filteredOverrides = useMemo(() => overrides.filter(matchesFilters), [overrides, representativeFilter, regionFilter, dateFilter, data.entities]);
  const filteredAllVisits = useMemo(() => data.visits.filter(matchesFilters), [data.visits, representativeFilter, regionFilter, dateFilter, data.entities]);
  const summaryRows = useMemo(() => data.representatives.filter((item) => item.active).map((rep) => {
    const visits = filteredAllVisits.filter((visit) => visit.representativeId === rep.id && (visit.verificationStatus === "verified" || visit.verificationStatus === "rejected"));
    const accepted = visits.filter((visit) => visit.verificationStatus === "verified").length;
    const rejected = visits.filter((visit) => visit.verificationStatus === "rejected").length;
    return { ...rep, total: visits.length, accepted, rejected, acceptedRate: visits.length ? Math.round((accepted / visits.length) * 100) : 0 };
  }), [data.representatives, filteredAllVisits]);
  const reverifyVisit = (visit: (typeof data.visits)[number]) => {
    const checkedAt = new Date().toISOString();
    const entity = data.entities.find((item) => item.id === visit.entityId);
    const expected = entity?.geographicCoordinates ?? visit.geographicCoordinates;
    if (!visit.location || !expected) {
      const result = "تعذر إعادة التحقق: لا توجد إحداثيات كافية.";
      updateVisit({ ...visit, verificationStatus: "rejected", verificationCheckedAt: checkedAt, verificationReason: result, verificationLog: [...(visit.verificationLog ?? []), { checkedAt, status: "rejected", result }] });
      Alert.alert("تمت إعادة التحقق", result);
      return;
    }
    const distanceMeters = distanceBetweenMeters(visit.location, expected);
    const accepted = isWithinGeofence(distanceMeters, data.settings.geofenceRadiusMeters);
    const status = accepted ? "verified" as const : "rejected" as const;
    const result = accepted ? "تم قبول الزيارة بعد إعادة التحقق." : `مرفوضة: المسافة ${Math.round(distanceMeters)} متر وتتجاوز الحد ${data.settings.geofenceRadiusMeters} متر.`;
    updateVisit({ ...visit, geographicCoordinates: expected, verificationStatus: status, verificationCheckedAt: checkedAt, verificationDistanceMeters: Math.round(distanceMeters), verificationReason: result, verificationLog: [...(visit.verificationLog ?? []), { checkedAt, status, distanceMeters: Math.round(distanceMeters), result }] });
    Alert.alert("تمت إعادة التحقق", result);
  };
  const representativeName = (id: string) => data.representatives.find((item) => item.id === id)?.name ?? "غير محدد";
  const openLocationEditor = (visit: (typeof data.visits)[number]) => {
    setEditingVisit(visit);
    setLocationPickerVisible(true);
  };
  const saveEditedLocation = (value: { label: string; coordinates: (typeof data.visits)[number]["location"] }) => {
    if (!editingVisit || !value.coordinates) return;
    const entity = data.entities.find((item) => item.id === editingVisit.entityId);
    if (!entity) { Alert.alert("تعذر تحديث الموقع", "لم تعد الجهة المرتبطة بهذه الزيارة موجودة."); return; }
    const checkedAt = new Date().toISOString();
    if (!entity.geographicCoordinates) updateEntity({ ...entity, geographicLocation: value.label, geographicCoordinates: value.coordinates });
    updateVisit({ ...editingVisit, location: value.coordinates, geographicLocation: editingVisit.geographicLocation || value.label, verificationStatus: "pending", verificationCheckedAt: undefined, verificationDistanceMeters: undefined, verificationReason: "تم تعديل موقع GPS للزيارة بواسطة مدير النظام؛ بانتظار إعادة التحقق.", verificationLog: [...(editingVisit.verificationLog ?? []), { checkedAt, status: "pending", result: "تم تعديل موقع GPS للزيارة بواسطة مدير النظام." }] });
    setLocationPickerVisible(false);
    setEditingVisit(null);
    Alert.alert("تم تحديث الموقع", "تم حفظ موقع GPS للزيارة. اضغط «إعادة التحقق» لمطابقة الزيارة مع إحداثيات الجهة.");
  };

  const shareFile = async (kind: "pdf" | "excel") => {
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة مشاركة الملفات على هذا الجهاز."); return; }
      let uri = "";
      if (kind === "pdf") {
        const result = await Print.printToFileAsync({ html: kind === "pdf" ? buildRejectedVisitReportHtml(filteredRejectedVisits, data.representatives, data.settings.managerName) : buildOverrideReportHtml(overrides, data.representatives, data.settings.managerName) });
        uri = result.uri;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(rejectedVisitRows(filteredRejectedVisits, data.representatives));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "زيارات مرفوضة");
        const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        uri = `${FileSystem.cacheDirectory}${filteredRejectedVisits.length ? "rejected-visits" : "override-report"}-${Date.now()}.xlsx`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      }
      await Sharing.shareAsync(uri, { mimeType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: kind === "pdf" ? "مشاركة تقرير PDF" : "مشاركة تقرير Excel" });
    } catch { Alert.alert("تعذر إنشاء الملف", "حاول مرة أخرى بعد التأكد من وجود مساحة تخزين."); }
    finally { setBusy(false); }
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><FlatList data={[...filteredRejectedVisits, ...filteredOverrides]} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingTop: 18, paddingBottom: 30, gap: 12, flexGrow: 1 }} ListHeaderComponent={<><ScreenHeader title="تقارير التحقق من الموقع" subtitle="الزيارات المرفوضة وتجاوزات مدير النظام" icon="gpp-maybe" /><View className="rounded-2xl bg-surface border border-border p-3 mb-3 gap-3"><Text className="text-xs text-muted text-right">تصفية التقرير</Text><View className="flex-row-reverse gap-2"><Pressable onPress={() => setRepresentativeFilter("all")} className={`flex-1 h-10 rounded-xl items-center justify-center ${representativeFilter === "all" ? "bg-primary" : "bg-background border border-border"}`}><Text className={representativeFilter === "all" ? "text-white font-bold text-[10px]" : "text-foreground font-bold text-[10px]"}>كل المندوبين</Text></Pressable>{data.representatives.filter((item) => item.active).map((rep) => <Pressable key={rep.id} onPress={() => setRepresentativeFilter(rep.id)} className={`flex-1 h-10 rounded-xl items-center justify-center ${representativeFilter === rep.id ? "bg-primary" : "bg-background border border-border"}`}><Text className={representativeFilter === rep.id ? "text-white font-bold text-[10px]" : "text-foreground font-bold text-[10px]"} numberOfLines={1}>{rep.name.split(" ")[0]}</Text></Pressable>)}</View><View className="flex-row-reverse gap-2"><Pressable onPress={() => setRegionFilter("all")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "all" ? "bg-foreground" : "bg-background border border-border"}`}><Text className="text-white font-bold text-[10px]">كل المناطق</Text></Pressable><Pressable onPress={() => setRegionFilter("north")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "north" ? "bg-primary" : "bg-background border border-border"}`}><Text className={regionFilter === "north" ? "text-white font-bold text-[10px]" : "text-foreground font-bold text-[10px]"}>شمال</Text></Pressable><Pressable onPress={() => setRegionFilter("south")} className={`flex-1 h-10 rounded-xl items-center justify-center ${regionFilter === "south" ? "bg-warning" : "bg-background border border-border"}`}><Text className={regionFilter === "south" ? "text-white font-bold text-[10px]" : "text-foreground font-bold text-[10px]"}>جنوب</Text></Pressable></View><TextInput value={dateFilter} onChangeText={setDateFilter} placeholder="التاريخ بصيغة YYYY-MM-DD (اختياري)" placeholderTextColor="#64748B" className="h-11 rounded-xl border border-border bg-background px-3 text-foreground text-right" /></View><View className="rounded-2xl bg-surface border border-border p-3 mb-3"><Text className="font-bold text-foreground text-right mb-3">ملخص نتائج التحقق حسب المندوب</Text><View className="gap-3">{summaryRows.map((row) => <View key={row.id} className="rounded-xl bg-background border border-border p-3"><View className="flex-row-reverse justify-between items-center"><Text className="font-bold text-foreground">{row.name}</Text><Text className="text-xs text-muted">{row.total} زيارة مفحوصة</Text></View><View className="h-3 rounded-full bg-error/20 overflow-hidden mt-2"><View className="h-full bg-success rounded-full" style={{ width: `${row.acceptedRate}%` }} /></View><View className="flex-row-reverse justify-between mt-2"><Text className="text-xs text-success font-bold">مقبولة: {row.accepted} ({row.acceptedRate}%)</Text><Text className="text-xs text-error font-bold">مرفوضة: {row.rejected} ({row.total ? 100 - row.acceptedRate : 0}%)</Text></View></View>)}</View></View><View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-3 flex-row-reverse items-center gap-3"><MaterialIcons name="warning" size={24} color="#D97706" /><View className="flex-1 items-end"><Text className="text-warning font-bold text-lg">{filteredRejectedVisits.length}</Text><Text className="text-muted text-xs text-right">زيارات مرفوضة بعد التصفية · {filteredOverrides.length} تجاوزات معتمدة</Text></View></View><View className="flex-row-reverse gap-2 mb-2"><Pressable onPress={() => shareFile("pdf")} disabled={busy} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="picture-as-pdf" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تقرير الرفض PDF</Text></Pressable><Pressable onPress={() => shareFile("excel")} disabled={busy} className="flex-1 h-12 rounded-xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="table-view" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تقرير الرفض Excel</Text></Pressable></View></>} ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-7 items-center mt-3"><MaterialIcons name="verified" size={34} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد زيارات مرفوضة أو تجاوزات</Text><Text className="text-sm text-muted mt-1 text-center">ستظهر هنا نتيجة التحقق عند عودة الاتصال.</Text></View>} renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-warning/30 p-4"><View className="flex-row-reverse items-start gap-3"><View className="w-10 h-10 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="gpp-maybe" size={21} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.entityName}</Text><Text className="text-xs text-primary mt-1 text-right">{item.entityKind} · {representativeName(item.representativeId)}</Text></View></View><View className="border-t border-border mt-3 pt-3 gap-2"><Text className="text-xs text-muted text-right">الوقت: {formatArabicDate(item.recordedAt)}</Text>{item.verificationStatus === "rejected" ? <><Text className="text-sm text-error text-right"><Text className="font-bold">سبب الرفض: </Text>{item.verificationReason || "غير مسجل"}</Text>{item.verificationDistanceMeters !== undefined ? <Text className="text-xs text-muted text-right">المسافة المقاسة: {item.verificationDistanceMeters} متر</Text> : null}</> : <Text className="text-sm text-foreground text-right"><Text className="font-bold">سبب التجاوز: </Text>{item.overrideReason || "غير مسجل"}</Text>}<View className="flex-row-reverse gap-2 mt-2"><Pressable onPress={() => openLocationEditor(item)} className="flex-1 h-10 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="edit-location" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-[11px]">تعديل GPS للزيارة</Text></Pressable><Pressable onPress={() => reverifyVisit(item)} className="flex-1 h-10 rounded-xl bg-primary items-center justify-center"><Text className="text-white font-bold text-[11px]">إعادة التحقق</Text></Pressable></View></View></View>} /><LocationPicker visible={locationPickerVisible} value={(editingVisit?.location ?? editingVisit?.geographicCoordinates) ? { label: editingVisit.geographicLocation || editingVisit.entityName, coordinates: (editingVisit.location ?? editingVisit.geographicCoordinates)! } : null} onClose={() => { setLocationPickerVisible(false); setEditingVisit(null); }} onConfirm={saveEditedLocation} /></ScreenContainer>;
}
