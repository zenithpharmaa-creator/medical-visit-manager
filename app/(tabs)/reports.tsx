import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as MailComposer from "expo-mail-composer";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { buildReportHtml, getPeriodVisits, ReportPeriod, reportTitle } from "@/lib/reporting";
import { useVisitStore } from "@/lib/visit-store";

export default function ReportsScreen() {
  const { data } = useVisitStore();
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [isWorking, setIsWorking] = useState(false);
  const currentVisits = useMemo(() => getPeriodVisits(data.visits, period), [data.visits, period]);
  const title = reportTitle(period);
  const html = useMemo(() => buildReportHtml({ visits: currentVisits, representatives: data.representatives, title, managerName: data.settings.managerName }), [currentVisits, data.representatives, data.settings.managerName, title]);
  const byRepresentative = data.representatives.map((representative) => ({ representative, count: currentVisits.filter((visit) => visit.representativeId === representative.id).length }));

  const run = async (action: "print" | "share" | "email" | "excel") => {
    setIsWorking(true);
    try {
      if (action === "excel") {
        const rows = currentVisits.map((visit, index) => ({
          "#": index + 1,
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

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="التقارير" subtitle="اطبع وشارك تقارير الزيارات" icon="assessment" />
        <View className="flex-row-reverse rounded-2xl bg-surface border border-border p-1 mb-5">
          {(["daily", "monthly"] as ReportPeriod[]).map((item) => <Pressable key={item} onPress={() => setPeriod(item)} className={`flex-1 h-11 rounded-xl items-center justify-center ${period === item ? "bg-primary" : ""}`} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><Text className={`font-bold ${period === item ? "text-white" : "text-muted"}`}>{item === "daily" ? "يومي" : "شهري"}</Text></Pressable>)}
        </View>
        <View className="rounded-2xl bg-primary p-5 mb-5 items-end"><Text className="text-white/80 font-semibold">الفترة المختارة</Text><Text className="text-white font-bold text-lg mt-1">{title}</Text><Text className="text-white/80 text-sm mt-2">{currentVisits.length} زيارة ضمن التقرير</Text></View>
        <Text className="font-bold text-foreground text-right mb-3">توزيع الزيارات حسب المندوب</Text>
        <View className="flex-row-reverse gap-3 mb-6">{byRepresentative.map(({ representative, count }, index) => <MetricCard key={representative.id} label={representative.name.replace("المندوب ", "") || `مندوب ${index + 1}`} value={count} icon="person" tone={index === 1 ? "success" : index === 2 ? "warning" : "primary"} />)}</View>
        <View className="gap-3">
          <Pressable onPress={() => run("print")} disabled={isWorking} className="h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="print" size={21} color="#FFFFFF" /><Text className="text-white font-bold">طباعة التقرير</Text></Pressable>
          <Pressable onPress={() => run("share")} disabled={isWorking} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="share" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ أو مشاركة PDF</Text></Pressable>
          <Pressable onPress={() => run("email")} disabled={isWorking} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="email" size={21} color="#FFFFFF" /><Text className="text-white font-bold">إرسال التقرير بالبريد</Text></Pressable>
          <Pressable onPress={() => run("excel")} disabled={isWorking} className="h-14 rounded-2xl bg-[#217346] items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed || isWorking ? 0.75 : 1 }]}><MaterialIcons name="table-chart" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير Excel</Text></Pressable>
        </View>
        <View className="rounded-2xl bg-surface border border-border p-4 mt-5 flex-row-reverse gap-3"><MaterialIcons name="info-outline" size={21} color="#1565C0" /><Text className="flex-1 text-right text-sm text-muted leading-5">يُنشأ ملف PDF من التقرير داخل الهاتف؛ ويمكن طباعته أو مشاركته أو فتح البريد مع التقرير كمرفق.</Text></View>
      </ScrollView>
    </ScreenContainer>
  );
}
