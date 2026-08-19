import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import * as XLSX from "xlsx";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { NativeDateTimePicker } from "@/components/native-date-time-picker";
import { buildReportHtml, formatVisitTime, getPeriodVisits, ReportPeriod, reportTitle, sortVisitsByRecordedAt } from "@/lib/reporting";

const REPORT_FILTERS_KEY = "medical-visit-manager:report-filters";
const pad2 = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
import { useVisitStore } from "@/lib/visit-store";
import { useAccountSession } from "@/lib/account-session";

export default function ReportsScreen() {
  const { session } = useAccountSession();
  const { period: routePeriod } = useLocalSearchParams<{ period?: string }>();
  const { data, updateVisit } = useVisitStore();
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [isWorking, setIsWorking] = useState(false);
  const [representativeFilter, setRepresentativeFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [calendarTarget, setCalendarTarget] = useState<"day" | "from" | "to" | null>(null);
  const [dailyDate, setDailyDate] = useState("");
  const [representativeMenuVisible, setRepresentativeMenuVisible] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [editVisit, setEditVisit] = useState<typeof data.visits[number] | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const basePeriodVisits = useMemo(() => period === "daily" && dailyDate ? getPeriodVisits(data.visits, "daily", new Date(`${dailyDate}T12:00:00`)) : getPeriodVisits(data.visits, period), [data.visits, period, dailyDate]);
  const currentVisits = useMemo(() => sortVisitsByRecordedAt(basePeriodVisits.filter((visit) => { const day = visit.recordedAt.slice(0, 10); const inRange = period !== "monthly" || ((!fromDate || day >= fromDate) && (!toDate || day <= toDate)); const byRep = representativeFilter === "all" || visit.representativeId === representativeFilter; return inRange && byRep; })), [basePeriodVisits, fromDate, toDate, representativeFilter]);
  const selectedRepName = data.representatives.find((item) => item.id === representativeFilter)?.name ?? "كل المندوبين";
  const title = period === "daily" && dailyDate ? `تقرير الزيارات اليومي — ${dailyDate}` : period === "monthly" && (fromDate || toDate) ? `تقرير شهري من ${fromDate || "البداية"} إلى ${toDate || "النهاية"}` : reportTitle(period);
  useEffect(() => { if (routePeriod === "daily" || routePeriod === "monthly") setPeriod(routePeriod); }, [routePeriod]);
  useEffect(() => { void AsyncStorage.getItem(REPORT_FILTERS_KEY).then((raw) => { if (!raw) return; try { const saved = JSON.parse(raw) as { representativeFilter?: string; fromDate?: string; toDate?: string; dailyDate?: string }; setRepresentativeFilter(saved.representativeFilter ?? "all"); setFromDate(saved.fromDate ?? ""); setToDate(saved.toDate ?? ""); setDailyDate(saved.dailyDate ?? ""); } catch { /* ignore malformed preferences */ } }); }, []);
  useEffect(() => { void AsyncStorage.setItem(REPORT_FILTERS_KEY, JSON.stringify({ representativeFilter, fromDate, toDate, dailyDate })); }, [representativeFilter, fromDate, toDate, dailyDate]);
  const logoUri = Asset.fromModule(require("../../assets/images/icon.png")).uri;
  const html = useMemo(() => buildReportHtml({ visits: currentVisits, representatives: data.representatives, title, managerName: data.settings.managerName, logoUri }), [currentVisits, data.representatives, data.settings.managerName, title, logoUri]);
  const byRepresentative = data.representatives.map((representative) => ({ representative, count: currentVisits.filter((visit) => visit.representativeId === representative.id).length }));
  useEffect(() => {
    if (period !== "monthly") { setMonthlyLoading(false); return; }
    setMonthlyLoading(true);
    const timer = setTimeout(() => setMonthlyLoading(false), 450);
    return () => clearTimeout(timer);
  }, [period, fromDate, toDate, representativeFilter, data.visits.length]);

  if (session?.role !== "manager") {
    return <ScreenContainer className="px-5" containerClassName="bg-background"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">التقارير متاحة لمدير النظام فقط</Text><Text className="text-sm text-muted text-center mt-2 leading-5">لا يملك حساب المندوب صلاحية عرض التقارير أو فلاترها.</Text></View></ScreenContainer>;
  }

  const run = async (action: "print" | "share" | "email" | "excel") => {
    setIsWorking(true);
    try {
      if (action === "excel") {
        const rows = currentVisits.map((visit, index) => ({
          "#": index + 1,
          "وقت الزيارة": formatVisitTime(visit.recordedAt),
          "اسم الطبيب": visit.entityName,
          "نوع الجهة": visit.entityKind,
          "التخصص": visit.specialty || "",
          "الفئة": visit.category || "",
          "الأصناف المزارة": visit.visitedItems?.join("، ") || "",
          "أقرب صيدلية": visit.nearestPharmacy || "",
          "الموقع الجغرافي": visit.geographicLocation || "",
          "المندوب": data.representatives.find((item) => item.id === visit.representativeId)?.name || "غير محدد",
          "الوقت": visit.recordedAt,
          "GPS": visit.location ? "موثّق" : "غير متوفر",
          "ملاحظات": visit.notes || "",
        }));
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, "الزيارات");
        const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        const uri = `${FileSystem.cacheDirectory}تقرير-الزيارات-${Date.now()}.xlsx`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح قائمة المشاركة على هذا الجهاز."); return; }
        await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: "مشاركة تقرير الزيارات Excel" });
        return;
      }
      if (action === "print") { await Print.printAsync({ html }); return; }
      const pdf = await Print.printToFileAsync({ html });
      if (action === "share") {
        if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح قائمة المشاركة على هذا الجهاز."); return; }
        await Sharing.shareAsync(pdf.uri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: "مشاركة تقرير الزيارات" });
        return;
      }
      if (!(await MailComposer.isAvailableAsync())) { Alert.alert("البريد غير متاح", "يرجى إعداد تطبيق بريد على الهاتف ثم أعد المحاولة."); return; }
      await MailComposer.composeAsync({ recipients: data.settings.reportEmail ? [data.settings.reportEmail] : [], subject: title, body: `مرفق ${title}.`, attachments: [pdf.uri] });
    } catch {
      Alert.alert("تعذر تجهيز التقرير", "حدثت مشكلة أثناء إنشاء ملف PDF. أعد المحاولة لاحقاً.");
    } finally { setIsWorking(false); }
  };

  const reportPreview = (expanded = false) => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: expanded ? 1040 : 720 }}><View className="border border-border rounded-xl overflow-hidden" style={{ minWidth: expanded ? 1040 : 720 }}><View className="flex-row-reverse bg-foreground"><Text className="w-10 px-2 py-2 text-white text-[10px] font-bold text-center">#</Text><Text className="w-16 px-2 py-2 text-white text-[10px] font-bold text-center">إجراء</Text><Text className="w-20 px-2 py-2 text-white text-[10px] font-bold text-center">الوقت</Text><Text className="w-44 px-2 py-2 text-white text-[10px] font-bold text-right">اسم الطبيب</Text><Text className="w-36 px-2 py-2 text-white text-[10px] font-bold text-right">العنوان</Text><Text className="w-32 px-2 py-2 text-white text-[10px] font-bold text-right">الأصناف</Text><Text className="w-36 px-2 py-2 text-white text-[10px] font-bold text-right">الملاحظات</Text></View>{currentVisits.length ? currentVisits.map((visit, index) => <View key={visit.id} className={`flex-row-reverse border-t border-border ${index % 2 ? "bg-background" : "bg-surface"}`}><View className="w-10 px-2 py-2 items-center justify-center"><Text className="text-foreground text-[10px] text-center">{index + 1}</Text></View><Pressable onPress={() => { setEditVisit(visit); setEditNotes(visit.notes || ""); }} className="w-16 px-1 py-1 items-center justify-center"><View className="rounded-lg bg-primary px-1.5 py-1"><MaterialIcons name="edit" size={13} color="#FFFFFF" /></View></Pressable><Text className="w-20 px-2 py-2 text-primary text-[10px] font-bold text-center">{formatVisitTime(visit.recordedAt)}</Text><Text numberOfLines={1} className="w-44 px-2 py-2 text-foreground text-[10px] text-right">{visit.entityName}</Text><Text numberOfLines={1} className="w-36 px-2 py-2 text-muted text-[10px] text-right">{visit.entityAddress || visit.geographicLocation || "—"}</Text><Text numberOfLines={1} className="w-32 px-2 py-2 text-muted text-[10px] text-right">{visit.visitedItems?.join("، ") || "—"}</Text><Text numberOfLines={1} className="w-36 px-2 py-2 text-muted text-[10px] text-right">{visit.notes || "—"}</Text></View>) : <Text className="p-5 text-muted text-center text-xs">لا توجد زيارات لهذا اليوم.</Text>}</View></ScrollView>;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="التقارير" subtitle="اطبع وشارك تقارير الزيارات" icon="assessment" />
        <Pressable onPress={() => setReportMenuVisible(true)} className="h-14 rounded-2xl bg-surface border border-border px-4 mb-5 flex-row-reverse items-center justify-between" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="assessment" size={22} color="#1257A6" /><View className="items-end"><Text className="text-xs text-muted">نوع التقرير</Text><Text className="font-bold text-foreground">{period === "daily" ? "تقرير الزيارات اليومية" : "تقرير الزيارات الشهرية"}</Text></View></View><MaterialIcons name="keyboard-arrow-down" size={24} color="#1257A6" /></Pressable>
        <Modal visible={reportMenuVisible} transparent animationType="fade" onRequestClose={() => setReportMenuVisible(false)}><View className="flex-1 justify-start pt-24 px-5 bg-black/25"><View className="rounded-2xl bg-background border border-border overflow-hidden"><Text className="px-4 py-3 text-right text-xs font-bold text-muted bg-surface">اختر نوع التقرير</Text><Pressable onPress={() => { setPeriod("daily"); setReportMenuVisible(false); }} className={`h-14 px-4 flex-row-reverse items-center justify-between border-b border-border ${period === "daily" ? "bg-primary/10" : "bg-background"}`}><Text className="font-bold text-foreground">تقرير الزيارات اليومية</Text>{period === "daily" ? <MaterialIcons name="check" size={21} color="#1257A6" /> : <MaterialIcons name="chevron-left" size={21} color="#7C8798" />}</Pressable><Pressable onPress={() => { setPeriod("monthly"); setReportMenuVisible(false); }} className={`h-14 px-4 flex-row-reverse items-center justify-between ${period === "monthly" ? "bg-primary/10" : "bg-background"}`}><Text className="font-bold text-foreground">تقرير الزيارات الشهرية</Text>{period === "monthly" ? <MaterialIcons name="check" size={21} color="#1257A6" /> : <MaterialIcons name="chevron-left" size={21} color="#7C8798" />}</Pressable></View></View></Modal>
        {period === "daily" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-5 gap-3"><Text className="font-bold text-foreground text-right">تخصيص التقرير اليومي</Text><Pressable onPress={() => setCalendarTarget("day")} className="h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="event" size={18} color="#1565C0" /><Text className={`font-bold text-right ${dailyDate ? "text-foreground" : "text-muted"}`}>{dailyDate || "اختر يوم التقرير من التقويم"}</Text></Pressable><Pressable onPress={() => setRepresentativeMenuVisible(true)} className="h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="keyboard-arrow-down" size={22} color="#1565C0" /><Text className="font-bold text-foreground text-right">{selectedRepName}</Text></Pressable><Pressable onPress={() => { setDailyDate(""); setRepresentativeFilter("all"); }} className="h-10 rounded-xl border border-border items-center justify-center"><Text className="text-xs font-bold text-muted">مسح فلاتر التقرير اليومي</Text></Pressable></View> : null}
        {period === "monthly" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-5 gap-3"><Text className="font-bold text-foreground text-right">تخصيص التقرير الشهري</Text><View className="flex-row-reverse gap-2"><Pressable onPress={() => setCalendarTarget("from")} className="flex-1 h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="event" size={18} color="#1565C0" /><Text className={`text-xs font-bold text-right ${fromDate ? "text-foreground" : "text-muted"}`}>{fromDate || "من تاريخ"}</Text></Pressable><Pressable onPress={() => setCalendarTarget("to")} className="flex-1 h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="event" size={18} color="#1565C0" /><Text className={`text-xs font-bold text-right ${toDate ? "text-foreground" : "text-muted"}`}>{toDate || "إلى تاريخ"}</Text></Pressable></View><View className="flex-row-reverse flex-wrap gap-2"><Pressable onPress={() => setRepresentativeFilter("all")} className={`flex-1 min-w-[30%] h-10 rounded-xl items-center justify-center ${representativeFilter === "all" ? "bg-primary" : "bg-background border border-border"}`}><Text className={`text-xs font-bold ${representativeFilter === "all" ? "text-white" : "text-foreground"}`}>كل المندوبين</Text></Pressable>{data.representatives.filter((item) => item.active).map((rep) => <Pressable key={rep.id} onPress={() => setRepresentativeFilter(rep.id)} className={`flex-1 min-w-[30%] h-10 rounded-xl items-center justify-center ${representativeFilter === rep.id ? "bg-primary" : "bg-background border border-border"}`}><Text className={`text-xs font-bold ${representativeFilter === rep.id ? "text-white" : "text-foreground"}`} numberOfLines={1}>{rep.name.replace("المندوب ", "")}</Text></Pressable>)}</View><Pressable onPress={() => { setFromDate(""); setToDate(""); setRepresentativeFilter("all"); }} className="h-10 rounded-xl border border-border items-center justify-center"><Text className="text-xs font-bold text-muted">مسح فلاتر التقرير</Text></Pressable></View> : null}
        {period === "daily" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-5"><View className="flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground text-right">معاينة التقرير اليومي</Text><Pressable onPress={() => setPreviewFullscreen(true)} className="h-9 rounded-xl bg-foreground px-3 items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="fullscreen" size={17} color="#FFFFFF" /><Text className="text-white text-xs font-bold">تكبير</Text></Pressable></View>{reportPreview()}</View> : null}
        <Modal visible={previewFullscreen} animationType="slide" onRequestClose={() => setPreviewFullscreen(false)}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 border-b border-border flex-row-reverse items-center justify-between"><Pressable onPress={() => setPreviewFullscreen(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-lg font-bold text-foreground">معاينة التقرير بملء الشاشة</Text><Text className="text-xs text-muted mt-1">أعمدة ثابتة · ترتيب تصاعدي حسب وقت الزيارة</Text></View><MaterialIcons name="table-view" size={22} color="#1257A6" /></View><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>{reportPreview(true)}</ScrollView></View></Modal>
        {period === "monthly" && monthlyLoading ? <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-5 flex-row-reverse items-center gap-3"><ActivityIndicator size="small" color="#1257A6" /><View className="flex-1 items-end"><Text className="font-bold text-primary text-right">جاري جلب بيانات التقرير الشهري</Text><Text className="text-xs text-muted text-right mt-1">يتم تصفية الزيارات وحساب الإحصاءات حسب النطاق المحدد...</Text></View></View> : null}
        <Modal visible={Boolean(editVisit)} transparent animationType="slide" onRequestClose={() => setEditVisit(null)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setEditVisit(null)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">تعديل الزيارة رقم {editVisit ? currentVisits.findIndex((visit) => visit.id === editVisit.id) + 1 : ""}</Text></View><Text className="text-sm text-muted text-right mb-2">{editVisit?.entityName || "الزيارة"}</Text><TextInput value={editNotes} onChangeText={setEditNotes} placeholder="ملاحظات الزيارة" placeholderTextColor="#7C8798" textAlign="right" multiline className="min-h-28 rounded-2xl border border-border bg-surface p-4 text-foreground" /><Pressable onPress={() => { if (editVisit) updateVisit({ ...editVisit, notes: editNotes.trim() }); setEditVisit(null); Alert.alert("تم التعديل", "تم تحديث الزيارة بنجاح."); }} className="h-14 rounded-2xl bg-success items-center justify-center mt-4"><Text className="text-white font-bold">حفظ التعديل</Text></Pressable></View></View></Modal>
        <View className="rounded-2xl bg-primary p-5 mb-5 items-end"><Text className="text-white/80 font-semibold">الفترة المختارة</Text><Text className="text-white font-bold text-lg mt-1">{title}</Text><Text className="text-white/80 text-sm mt-2">{currentVisits.length} زيارة ضمن التقرير</Text></View>
        <Text className="font-bold text-foreground text-right mb-3">توزيع الزيارات حسب المندوب</Text>
        <View className="flex-row-reverse gap-3 mb-6">{byRepresentative.map(({ representative, count }, index) => <MetricCard key={representative.id} label={representative.name.replace("المندوب ", "") || `مندوب ${index + 1}`} value={count} icon="person" tone={index === 1 ? "success" : index === 2 ? "warning" : "primary"} />)}</View>
        <View className="gap-3">
          <View className="flex-row-reverse gap-2"><Pressable onPress={() => run("print")} disabled={isWorking} className="flex-1 h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="print" size={21} color="#FFFFFF" /><Text className="text-white font-bold">طباعة مباشرة</Text></Pressable><Pressable onPress={() => run("share")} disabled={isWorking} className="flex-1 h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="picture-as-pdf" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير PDF</Text></Pressable></View>
          <Pressable onPress={() => run("email")} disabled={isWorking} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="email" size={21} color="#FFFFFF" /><Text className="text-white font-bold">إرسال التقرير بالبريد</Text></Pressable>
          <Pressable onPress={() => run("excel")} disabled={isWorking} className="h-14 rounded-2xl bg-[#217346] items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="table-chart" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير Excel</Text></Pressable>
        </View>
        <Modal visible={representativeMenuVisible} transparent animationType="slide" onRequestClose={() => setRepresentativeMenuVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8 max-h-[70%]"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setRepresentativeMenuVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">اختر مندوب التقرير</Text></View><ScrollView showsVerticalScrollIndicator={false}><Pressable onPress={() => { setRepresentativeFilter("all"); setRepresentativeMenuVisible(false); }} className={`h-12 rounded-xl border px-4 mb-2 flex-row-reverse items-center justify-between ${representativeFilter === "all" ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}><Text className="font-bold text-foreground">كل المندوبين</Text>{representativeFilter === "all" ? <MaterialIcons name="check" size={20} color="#1565C0" /> : null}</Pressable>{data.representatives.filter((item) => item.active).map((rep) => <Pressable key={rep.id} onPress={() => { setRepresentativeFilter(rep.id); setRepresentativeMenuVisible(false); }} className={`h-12 rounded-xl border px-4 mb-2 flex-row-reverse items-center justify-between ${representativeFilter === rep.id ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}><Text className="font-bold text-foreground">{rep.name}</Text>{representativeFilter === rep.id ? <MaterialIcons name="check" size={20} color="#1565C0" /> : null}</Pressable>)}</ScrollView></View></View></Modal>        <Modal visible={calendarTarget !== null} transparent animationType="slide" onRequestClose={() => setCalendarTarget(null)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setCalendarTarget(null)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">اختر {calendarTarget === "day" ? "يوم التقرير" : calendarTarget === "from" ? "تاريخ البداية" : "تاريخ النهاية"}</Text></View><NativeDateTimePicker mode="date" value={new Date((calendarTarget === "day" ? dailyDate : calendarTarget === "from" ? fromDate : toDate) ? `${calendarTarget === "day" ? dailyDate : calendarTarget === "from" ? fromDate : toDate}T12:00:00` : Date.now())} onChange={(date) => { const key = dateKey(date); if (calendarTarget === "day") setDailyDate(key); else if (calendarTarget === "from") setFromDate(key); else setToDate(key); setCalendarTarget(null); }} /></View></View></Modal>
        <View className="rounded-2xl bg-surface border border-border p-4 mt-5 flex-row-reverse gap-3"><MaterialIcons name="info-outline" size={21} color="#1565C0" /><Text className="flex-1 text-right text-sm text-muted leading-5">يُنشأ ملف PDF من التقرير داخل الهاتف؛ ويمكن طباعته أو مشاركته أو فتح البريد مع التقرير كمرفق.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}
