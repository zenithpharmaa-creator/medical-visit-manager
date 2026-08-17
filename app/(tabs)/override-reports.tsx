import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import * as XLSX from "xlsx";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { buildOverrideReportHtml, overrideRows } from "@/lib/override-report";
import { buildRejectedVisitReportHtml, rejectedVisitRows } from "@/lib/rejected-visit-report";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate } from "@/lib/visit-utils";

export default function OverrideReportsScreen() {
  const { data } = useVisitStore();
  const [busy, setBusy] = useState(false);
  const overrides = useMemo(() => data.visits.filter((visit) => visit.managerOverride).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [data.visits]);
  const rejectedVisits = useMemo(() => data.visits.filter((visit) => visit.verificationStatus === "rejected").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)), [data.visits]);
  const representativeName = (id: string) => data.representatives.find((item) => item.id === id)?.name ?? "غير محدد";

  const shareFile = async (kind: "pdf" | "excel") => {
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة مشاركة الملفات على هذا الجهاز."); return; }
      let uri = "";
      if (kind === "pdf") {
        const result = await Print.printToFileAsync({ html: kind === "pdf" ? buildRejectedVisitReportHtml(rejectedVisits, data.representatives, data.settings.managerName) : buildOverrideReportHtml(overrides, data.representatives, data.settings.managerName) });
        uri = result.uri;
      } else {
        const worksheet = XLSX.utils.json_to_sheet(rejectedVisitRows(rejectedVisits, data.representatives));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "زيارات مرفوضة");
        const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
        uri = `${FileSystem.cacheDirectory}${rejectedVisits.length ? "rejected-visits" : "override-report"}-${Date.now()}.xlsx`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      }
      await Sharing.shareAsync(uri, { mimeType: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: kind === "pdf" ? "مشاركة تقرير PDF" : "مشاركة تقرير Excel" });
    } catch { Alert.alert("تعذر إنشاء الملف", "حاول مرة أخرى بعد التأكد من وجود مساحة تخزين."); }
    finally { setBusy(false); }
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><FlatList data={[...rejectedVisits, ...overrides]} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingTop: 18, paddingBottom: 30, gap: 12, flexGrow: 1 }} ListHeaderComponent={<><ScreenHeader title="تقارير التحقق من الموقع" subtitle="الزيارات المرفوضة وتجاوزات مدير النظام" icon="gpp-maybe" /><View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-3 flex-row-reverse items-center gap-3"><MaterialIcons name="warning" size={24} color="#D97706" /><View className="flex-1 items-end"><Text className="text-warning font-bold text-lg">{rejectedVisits.length}</Text><Text className="text-muted text-xs text-right">زيارات مرفوضة بعد التحقق · {overrides.length} تجاوزات معتمدة</Text></View></View><View className="flex-row-reverse gap-2 mb-2"><Pressable onPress={() => shareFile("pdf")} disabled={busy} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="picture-as-pdf" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تقرير الرفض PDF</Text></Pressable><Pressable onPress={() => shareFile("excel")} disabled={busy} className="flex-1 h-12 rounded-xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="table-view" size={19} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تقرير الرفض Excel</Text></Pressable></View></>} ListEmptyComponent={<View className="rounded-2xl bg-surface border border-border p-7 items-center mt-3"><MaterialIcons name="verified" size={34} color="#16835B" /><Text className="font-bold text-foreground mt-3">لا توجد زيارات مرفوضة أو تجاوزات</Text><Text className="text-sm text-muted mt-1 text-center">ستظهر هنا نتيجة التحقق عند عودة الاتصال.</Text></View>} renderItem={({ item }) => <View className="rounded-2xl bg-surface border border-warning/30 p-4"><View className="flex-row-reverse items-start gap-3"><View className="w-10 h-10 rounded-xl bg-warning items-center justify-center"><MaterialIcons name="gpp-maybe" size={21} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">{item.entityName}</Text><Text className="text-xs text-primary mt-1 text-right">{item.entityKind} · {representativeName(item.representativeId)}</Text></View></View><View className="border-t border-border mt-3 pt-3 gap-2"><Text className="text-xs text-muted text-right">الوقت: {formatArabicDate(item.recordedAt)}</Text>{item.verificationStatus === "rejected" ? <><Text className="text-sm text-error text-right"><Text className="font-bold">سبب الرفض: </Text>{item.verificationReason || "غير مسجل"}</Text>{item.verificationDistanceMeters !== undefined ? <Text className="text-xs text-muted text-right">المسافة المقاسة: {item.verificationDistanceMeters} متر</Text> : null}</> : <Text className="text-sm text-foreground text-right"><Text className="font-bold">سبب التجاوز: </Text>{item.overrideReason || "غير مسجل"}</Text>}</View></View>} /></ScreenContainer>;
}
