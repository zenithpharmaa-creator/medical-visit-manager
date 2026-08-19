import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";

import { buildVisitExportRows, buildVisitsCsv, buildVisitsExcelBase64 } from "@/lib/visit-export";

import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate, isSameLocalDay } from "@/lib/visit-utils";

export default function VisitsScreen() {
  const { data, deleteVisit } = useVisitStore();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const today = new Date();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "rejected" | "pending">("all");
  const visibleVisits = data.visits.filter((visit) => isManager || (visit.representativeId === session?.representativeId && isSameLocalDay(new Date(visit.recordedAt), today)));
  const filtered = visibleVisits.filter((visit) => {
    const matchesQuery = isManager ? `${visit.entityName} ${visit.entityKind} ${visit.specialty ?? ""} ${visit.category ?? ""} ${visit.nearestPharmacy ?? ""} ${visit.entityRegion ?? ""} ${visit.entityAddress ?? ""} ${visit.geographicLocation ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()) : true;
    const matchesStatus = statusFilter === "all" || visit.verificationStatus === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const [exportBusy, setExportBusy] = useState(false);
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
        {isManager ? <View className="h-13 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center gap-2 mb-3">
          <MaterialIcons name="search" size={21} color="#102A43" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالطبيب أو الصيدلية أو المنطقة أو العنوان أو الموقع" placeholderTextColor="#7C8798" textAlign="right" className="flex-1 h-full text-foreground font-semibold" />
        </View> : null}
        <View className="flex-row-reverse gap-2 mb-4">
          {([{ value: "all", label: "الكل" }, { value: "verified", label: "مقبولة" }, { value: "rejected", label: "مرفوضة" }, { value: "pending", label: "بانتظار التحقق" }] as const).map((option) => <Pressable key={option.value} onPress={() => setStatusFilter(option.value)} className={`flex-1 min-h-10 rounded-xl items-center justify-center px-1 ${statusFilter === option.value ? option.value === "rejected" ? "bg-error" : option.value === "pending" ? "bg-warning" : "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-[11px] font-bold text-center ${statusFilter === option.value ? "text-white" : "text-foreground"}`}>{option.label}</Text></Pressable>)}
        </View>
        {isManager ? <View className="rounded-2xl bg-surface border border-border p-3 mb-4"><View className="flex-row-reverse items-center gap-2 mb-2"><MaterialIcons name="file-download" size={20} color="#1565C0" /><Text className="font-bold text-foreground flex-1 text-right">تصدير السجل الحالي ({filtered.length})</Text></View><View className="flex-row-reverse gap-2"><Pressable disabled={exportBusy} onPress={() => void exportVisits("excel")} className="flex-1 h-11 rounded-xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="table-view" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">Excel</Text></Pressable><Pressable disabled={exportBusy} onPress={() => void exportVisits("csv")} className="flex-1 h-11 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="description" size={18} color="#FFFFFF" /><Text className="text-white font-bold text-xs">CSV</Text></Pressable></View><Text className="text-xs text-muted text-right mt-2">يشمل التصدير نتائج البحث وفلتر الحالة الحاليين.</Text></View> : null}
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
                    {item.verificationStatus === "pending" ? <Text className="text-xs text-warning font-bold mt-1 text-right">بانتظار التحقق عند عودة الاتصال</Text> : null}
                    {item.verificationStatus === "verified" ? <Text className="text-xs text-success font-bold mt-1 text-right">تمت مطابقة الموقع وقبول الزيارة</Text> : null}
                    {item.verificationStatus === "rejected" ? <Text className="text-xs text-error font-bold mt-1 text-right">مرفوضة بعد التحقق: {item.verificationReason ?? "الموقع غير مطابق"}</Text> : null}
                    {item.verificationStatus === "override" ? <Text className="text-xs text-primary font-bold mt-1 text-right">مقبولة بتجاوز مدير النظام</Text> : null}
                  </View>
                </View>
                {item.photoUri ? <Image source={{ uri: item.photoUri }} className="w-full h-40 rounded-xl border border-border mt-3" resizeMode="cover" /> : null}
                {item.visitedItems?.length ? <Text className="text-xs text-primary mt-3 text-right">الأصناف المزارة: {item.visitedItems.join("، ")}</Text> : null}
                {item.notes ? <Text className="text-sm text-muted border-t border-border pt-3 mt-3 text-right leading-5">{item.notes}</Text> : null}
                {isManager ? <Pressable onPress={() => Alert.alert("حذف الزيارة", "هل تريد حذف هذه الزيارة نهائياً؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteVisit(item.id) }])} className="self-start mt-3 px-2 py-1" style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}><Text className="text-error font-bold text-xs">حذف</Text></Pressable> : null}
              </View>
            );
          }}
        />
      </View>
    </ScreenContainer>
  );
}
