import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { useNetworkState } from "expo-network";
import { Alert, FlatList, Image, Modal, Pressable, Text, TextInput, View } from "react-native";

import { buildVisitExportRows, buildVisitsCsv, buildVisitsExcelBase64 } from "@/lib/visit-export";

import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate, isSameLocalDay } from "@/lib/visit-utils";
import { getVisitSyncLabel, getVisitSyncState } from "@/lib/visit-sync-status";
import { canManageVisit } from "@/lib/visit-permissions";

export default function VisitsScreen() {
  const { data, deleteVisit, updateVisit, syncPendingVisits } = useVisitStore();
  const networkState = useNetworkState();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const today = new Date();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "rejected" | "pending" | "unsynced">("all");
  const visibleVisits = data.visits.filter((visit) => isManager || (visit.representativeId === session?.representativeId && isSameLocalDay(new Date(visit.recordedAt), today)));
  const filtered = visibleVisits.filter((visit) => {
    const matchesQuery = isManager ? `${visit.entityName} ${visit.entityKind} ${visit.specialty ?? ""} ${visit.category ?? ""} ${visit.nearestPharmacy ?? ""} ${visit.entityRegion ?? ""} ${visit.entityAddress ?? ""} ${visit.geographicLocation ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()) : true;
    const matchesStatus = statusFilter === "all" || statusFilter === "unsynced" ? (statusFilter === "all" || (statusFilter === "unsynced" ? getVisitSyncState(visit) === "pending" : visit.verificationStatus === statusFilter)) : visit.verificationStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const pendingSyncCount = visibleVisits.filter((visit) => getVisitSyncState(visit) === "pending").length;
  const syncedCount = visibleVisits.filter((visit) => getVisitSyncState(visit) === "synced").length;

  const [exportBusy, setExportBusy] = useState(false);
  const [editVisit, setEditVisit] = useState<typeof data.visits[number] | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const openEdit = (visit: typeof data.visits[number]) => { if (!session || !canManageVisit(visit, session.role, session.representativeId)) { Alert.alert("انتهت فترة التعديل", "يمكن للمندوب تعديل أو حذف الزيارة خلال 24 ساعة من تسجيلها فقط."); return; } setEditVisit(visit); setEditNotes(visit.notes ?? ""); };
  const saveEdit = () => { if (!editVisit) return; updateVisit({ ...editVisit, notes: editNotes.trim() }); setEditVisit(null); Alert.alert("تم التعديل", "تم تحديث ملاحظات الزيارة."); };
  const confirmDelete = (visit: typeof data.visits[number]) => { if (!session || !canManageVisit(visit, session.role, session.representativeId)) { Alert.alert("انتهت فترة الحذف", "يمكن للمندوب تعديل أو حذف الزيارة خلال 24 ساعة من تسجيلها فقط."); return; } Alert.alert("حذف الزيارة", "هل تريد حذف هذه الزيارة نهائياً؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteVisit(visit.id) }]); };
  const [syncBusy, setSyncBusy] = useState(false);
  const lastSeenSyncRef = useRef<string | undefined>(data.lastSuccessfulSyncAt);
  const hadPendingSyncRef = useRef(pendingSyncCount > 0);
  useEffect(() => {
    if (pendingSyncCount > 0) hadPendingSyncRef.current = true;
    if (data.lastSuccessfulSyncAt && data.lastSuccessfulSyncAt !== lastSeenSyncRef.current && !isManager && (Boolean(lastSeenSyncRef.current) || hadPendingSyncRef.current)) {
      Alert.alert("اكتملت المزامنة", "تم رفع الزيارات المحفوظة دون إنترنت ومراجعة مواقعها بنجاح.");
    }
    if (data.lastSuccessfulSyncAt) lastSeenSyncRef.current = data.lastSuccessfulSyncAt;
    if (pendingSyncCount === 0) hadPendingSyncRef.current = false;
  }, [data.lastSuccessfulSyncAt, isManager, pendingSyncCount]);
  const handleManualSync = async () => {
    if (networkState.isInternetReachable !== true) { Alert.alert("لا يوجد اتصال", "فعّل الإنترنت ثم اضغط «مزامنة الآن» مرة أخرى."); return; }
    setSyncBusy(true);
    try {
      const result = await syncPendingVisits();
      if (result.error) { Alert.alert("تعذر المزامنة", result.error); return; }
      if (result.syncedAt) lastSeenSyncRef.current = result.syncedAt;
      Alert.alert("اكتملت المزامنة", result.processed ? `تم رفع ومراجعة ${result.processed} زيارة محفوظة دون إنترنت.` : "لا توجد زيارات معلقة؛ تم تحديث وقت آخر فحص اتصال.");
    } catch { Alert.alert("تعذر المزامنة", "حدث خطأ غير متوقع. حاول مرة أخرى عند توفر اتصال مستقر."); }
    finally { setSyncBusy(false); }
  };
  const exportVisits = async (kind: "excel" | "csv") => {
    if (!isManager) { Alert.alert("غير متاح", "تصدير سجل الزيارات متاح لمدير النظام فقط."); return; }
    if (!filtered.length) { Alert.alert("لا توجد بيانات", "لا توجد زيارات مطابقة للتصدير."); return; }
    setExportBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة مشاركة الملفات على هذا الجهاز."); return; }
      const rows = buildVisitExportRows(filtered, data.representatives);
      const extension = kind === "excel" ? "xlsx" : "csv";
      const uri = `${FileSystem.cacheDirectory}visit-log-${Date.now()}.${extension}`;
      if (kind === "excel") await FileSystem.writeAsStringAsync(uri, buildVisitsExcelBase64(rows), { encoding: FileSystem.EncodingType.Base64 });
      else await FileSystem.writeAsStringAsync(uri, buildVisitsCsv(rows), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, { mimeType: kind === "excel" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv", dialogTitle: kind === "excel" ? "مشاركة سجل الزيارات Excel" : "مشاركة سجل الزيارات CSV" });
    } catch { Alert.alert("تعذر إنشاء الملف", "حاول مرة أخرى بعد التأكد من وجود مساحة تخزين."); }
    finally { setExportBusy(false); }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View className="pt-[18px] flex-1">
        <ScreenHeader title="الزيارات" subtitle={isManager ? `${filtered.length} زيارة محفوظة` : `${filtered.length} زيارة لك اليوم`} icon="event-note" />
        <View className={`rounded-2xl border p-4 mb-3 ${pendingSyncCount ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30"}`}>
          <View className="flex-row-reverse items-center gap-3">
            <View className={`w-10 h-10 rounded-xl items-center justify-center ${pendingSyncCount ? "bg-warning" : "bg-success"}`}><MaterialIcons name={pendingSyncCount ? "cloud-upload" : "cloud-done"} size={21} color="#FFFFFF" /></View>
            <View className="flex-1 items-end">
              <Text className="font-bold text-foreground text-right">{pendingSyncCount ? "مزامنة الزيارات قيد الانتظار" : "حالة المزامنة مستقرة"}</Text>
              <Text className="text-xs text-muted text-right mt-1">{pendingSyncCount ? `${pendingSyncCount} زيارة محفوظة دون إنترنت بانتظار الرفع والتحقق عند عودة الاتصال.` : "لا توجد زيارات offline معلقة حالياً."}</Text>
            </View>
          </View>
          <View className="flex-row-reverse gap-2 mt-3">
            <Pressable disabled={syncBusy || networkState.isInternetReachable !== true} onPress={() => void handleManualSync()} className={`flex-1 min-h-11 rounded-xl items-center justify-center flex-row-reverse gap-2 ${syncBusy || networkState.isInternetReachable !== true ? "bg-border" : "bg-primary"}`}><MaterialIcons name={syncBusy ? "sync" : "sync-alt"} size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">{syncBusy ? "جاري المزامنة..." : "مزامنة الآن"}</Text></Pressable>
            <View className="flex-1 rounded-xl bg-background/70 px-3 py-2"><Text className="text-[11px] text-muted text-right">آخر مزامنة ناجحة</Text><Text className="font-bold text-primary text-right mt-1 text-[11px]">{data.lastSuccessfulSyncAt ? formatArabicDate(data.lastSuccessfulSyncAt) : "لم تتم بعد"}</Text></View>
          </View>
          <View className="flex-row-reverse gap-2 mt-3">
            <View className="flex-1 rounded-xl bg-background/70 px-3 py-2"><Text className="text-[11px] text-muted text-right">بانتظار الرفع</Text><Text className="font-bold text-warning text-right mt-1">{pendingSyncCount}</Text></View>
            <View className="flex-1 rounded-xl bg-background/70 px-3 py-2"><Text className="text-[11px] text-muted text-right">تمت المزامنة</Text><Text className="font-bold text-success text-right mt-1">{syncedCount}</Text></View>
          </View>
        </View>
        {isManager ? <View className="h-13 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center gap-2 mb-3">
          <MaterialIcons name="search" size={21} color="#102A43" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالطبيب أو الصيدلية أو المنطقة أو العنوان أو الموقع" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-full text-foreground font-semibold" />
        </View> : null}
        <View className="flex-row-reverse gap-2 mb-4">
          {([{ value: "all", label: "الكل" }, { value: "verified", label: "مقبولة" }, { value: "rejected", label: "مرفوضة" }, { value: "pending", label: "بانتظار التحقق" }] as const).map((option) => <Pressable key={option.value} onPress={() => setStatusFilter(option.value)} className={`flex-1 min-h-10 rounded-xl items-center justify-center px-1 ${statusFilter === option.value ? option.value === "rejected" ? "bg-error" : option.value === "pending" ? "bg-warning" : "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-[11px] font-bold text-center ${statusFilter === option.value ? "text-white" : "text-foreground"}`}>{option.label}</Text></Pressable>)}
          {!isManager ? <Pressable onPress={() => setStatusFilter("unsynced")} className={`flex-1 min-h-10 rounded-xl items-center justify-center px-1 ${statusFilter === "unsynced" ? "bg-warning" : "bg-surface border border-border"}`}><Text className={`text-[11px] font-bold text-center ${statusFilter === "unsynced" ? "text-white" : "text-foreground"}`}>غير متزامنة</Text></Pressable> : null}
        </View>
        {isManager ? <View className="rounded-2xl bg-surface border border-border p-3 mb-4"><View className="flex-row-reverse items-center gap-2 mb-2"><MaterialIcons name="file-download" size={20} color="#1565C0" /><Text className="font-bold text-foreground flex-1 text-right">تصدير السجل الحالي ({filtered.length})</Text></View><View className="flex-row-reverse gap-2"><Pressable disabled={exportBusy} onPress={() => void exportVisits("excel")} className="flex-1 h-11 rounded-xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="table-view" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">Excel</Text></Pressable><Pressable disabled={exportBusy} onPress={() => void exportVisits("csv")} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="description" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">CSV</Text></Pressable></View><Text className="text-xs text-muted text-right mt-2">يشمل التصدير نتائج البحث وفلتر الحالة الحاليين.</Text></View> : null}
        <Modal visible={Boolean(editVisit)} transparent animationType="slide" onRequestClose={() => setEditVisit(null)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setEditVisit(null)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">تعديل الزيارة</Text><MaterialIcons name="edit" size={23} color="#1565C0" /></View><Text className="text-sm text-muted text-right mb-2">{editVisit?.entityName ?? "الزيارة"}</Text><TextInput value={editNotes} onChangeText={setEditNotes} placeholder="ملاحظات الزيارة" placeholderTextColor="#7C8798" textAlign="right" multiline className="min-h-28 rounded-2xl border border-border bg-surface p-4 text-foreground" /><Pressable onPress={saveEdit} className="h-14 rounded-2xl bg-success items-center justify-center mt-4"><Text className="text-white font-bold">حفظ التعديل</Text></Pressable></View></View></Modal>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={() => <View className="rounded-2xl bg-surface border border-border p-7 items-center"><MaterialIcons name="event-busy" size={30} color="#64748B" /><Text className="font-bold text-foreground mt-3">لا توجد زيارات مطابقة</Text><Text className="text-sm text-muted text-center mt-1">يمكنك تسجيل زيارة جديدة من تبويب «تسجيل».</Text></View>}
          renderItem={({ item }) => {
            const representative = data.representatives.find((rep) => rep.id === item.representativeId)?.name ?? "مندوب غير معروف";
            return (
              <View className="rounded-2xl bg-surface border border-border p-4">
                <View className="flex-row-reverse gap-3 items-start">
                  <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-on" size={20} color="#FFFFFF" /></View>
                  <View className="flex-1 items-end">
                    <Text className="font-bold text-foreground text-right">{item.entityName}</Text>
                    <Text className="text-sm text-primary font-semibold mt-1 text-right">{item.entityKind} · {representative}</Text>{item.specialty || item.category ? <Text className="text-xs text-muted mt-1 text-right">{[item.specialty, item.category].filter(Boolean).join(" · ")}</Text> : null}{item.entityRegion || item.geographicLocation ? <Text className="text-xs text-muted mt-1 text-right">المنطقة: {item.entityRegion === "north" ? "شمال صنعاء" : item.entityRegion === "south" ? "جنوب صنعاء" : item.geographicLocation ?? "صنعاء"}</Text> : null}{item.entityAddress ? <Text className="text-xs text-muted mt-1 text-right">العنوان: {item.entityAddress}</Text> : null}{item.nearestPharmacy ? <Text className="text-xs text-muted mt-1 text-right">أقرب صيدلية: {item.nearestPharmacy}</Text> : null}{item.geographicLocation && item.entityRegion ? <Text className="text-xs text-muted mt-1 text-right">الموقع الجغرافي: {item.geographicLocation}</Text> : null}
                    <Text className="text-xs text-muted mt-1 text-right">{formatArabicDate(item.recordedAt)}</Text>
                    {item.location ? <Text className="text-xs text-success mt-1 text-right">تم توثيق الموقع</Text> : <Text className="text-xs text-warning mt-1 text-right">لم يتوفر الموقع</Text>}
                    {(() => { const syncState = getVisitSyncState(item); return <View className={`mt-2 rounded-xl px-3 py-2 flex-row-reverse items-center gap-2 ${syncState === "pending" ? "bg-warning/10" : syncState === "synced" ? "bg-success/10" : "bg-background"}`}><MaterialIcons name={syncState === "pending" ? "cloud-upload" : syncState === "synced" ? "cloud-done" : "save"} size={16} color={syncState === "pending" ? "#D97706" : syncState === "synced" ? "#16835B" : "#64748B"} /><Text className={`text-xs font-bold flex-1 text-right ${syncState === "pending" ? "text-warning" : syncState === "synced" ? "text-success" : "text-muted"}`}>{getVisitSyncLabel(syncState)}</Text></View>; })()}
                    {item.verificationStatus === "pending" ? <Text className="text-xs text-warning font-bold mt-1 text-right">بانتظار التحقق عند عودة الاتصال</Text> : null}
                    {item.verificationStatus === "verified" ? <Text className="text-xs text-success font-bold mt-1 text-right">تمت مطابقة الموقع وقبول الزيارة</Text> : null}
                    {item.verificationStatus === "rejected" ? <Text className="text-xs text-error font-bold mt-1 text-right">مرفوضة بعد التحقق: {item.verificationReason ?? "الموقع غير مطابق"}</Text> : null}
                    {item.verificationStatus === "override" ? <Text className="text-xs text-primary font-bold mt-1 text-right">مقبولة بتجاوز مدير النظام</Text> : null}
                  </View>
                </View>
                {item.photoUri ? <Image source={{ uri: item.photoUri }} className="w-full h-40 rounded-xl border border-border mt-3" resizeMode="cover" /> : null}
                {item.visitedItems?.length ? <Text className="text-xs text-primary mt-3 text-right">الأصناف المزارة: {item.visitedItems.join("، ")}</Text> : null}
                {item.notes ? <Text className="text-sm text-muted border-t border-border pt-3 mt-3 text-right leading-5">{item.notes}</Text> : null}
                {session && canManageVisit(item, session.role, session.representativeId) ? <View className="flex-row-reverse gap-2 mt-3"><Pressable onPress={() => openEdit(item)} className="flex-1 h-10 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="edit" size={16} color="#1565C0" /><Text className="text-primary font-bold text-xs">تعديل</Text></Pressable><Pressable onPress={() => confirmDelete(item)} className="flex-1 h-10 rounded-xl bg-error/10 border border-error/20 items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="delete-outline" size={16} color="#C0392B" /><Text className="text-error font-bold text-xs">حذف</Text></Pressable></View> : !isManager ? <Text className="text-[11px] text-muted text-right mt-3">انتهت فترة تعديل هذه الزيارة للمندوب.</Text> : null}
              </View>
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}
