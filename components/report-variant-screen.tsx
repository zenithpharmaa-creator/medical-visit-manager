import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Linking, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { UnifiedDatePicker } from "@/components/unified-date-picker";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { localDateKey } from "@/lib/visit-utils";
import { formatHijriDate } from "@/lib/calendar-date";
import type { OfficialHoliday, PlannedVisit, Representative, RepresentativeLeave, Visit } from "@/shared/visit-types";
import { buildDailyVisitPdfHtml, buildMonthlyReportRows, buildRepresentativeTotalReportRows, createDailyVisitCsvFile, createDailyVisitExcelFile, createDailyVisitHtmlFile, createDailyVisitPdfFile, createMonthlyVisitDetailsCsvFile, createMonthlyVisitExcelFile, createMonthlyVisitPdfFile, createRepresentativeTotalVisitExcelFile, createRepresentativeTotalVisitPdfFile, formatDateArabic } from "@/lib/visit-report-export";
import { shareOrDownloadFile } from "@/lib/entity-export";
import { downloadReportFile } from "@/lib/report-download";
import { getReportVisits } from "@/lib/temporary-report-source";
import { isSingleDateReport, reportDateMatches } from "@/lib/report-date-filter";
import { ReportActionSheet, type ReportActionChannel, type ReportActionContact, type ReportActionFormat } from "@/components/report-action-sheet";
import { buildGoogleMapsUrl, extractCoordinates } from "@/lib/report-action-utils";
import { buildComprehensiveDailyTableRows, buildRepresentativeSummaryRows } from "@/lib/visit-report-format";
import { MiniMapModal } from "@/components/mini-map-modal";
import * as MailComposer from "expo-mail-composer";
import { goBackToPreviousScreen } from "@/lib/navigation";

export type ReportVariant = "search" | "calendar" | "representatives" | "daily" | "monthly-representative" | "representatives-total" | "daily-analysis";
type Config = { title: string; subtitle: string; icon: ComponentProps<typeof MaterialIcons>["name"] };
type ReportRow = { id: string; first: string; second: string; third: string; fourth: string; fifth?: string; sixth?: string; seventh?: string; eighth?: string };
type SortKey = keyof Omit<ReportRow, "id">;
type SelectOption = { value: string; label: string };

const CONFIG: Record<ReportVariant, Config> = {
  search: { title: "يومي شامل", subtitle: "عرض جميع الزيارات اليومية حسب الطبيب والتخصص والفترة والعنوان والصنف والمندوب والمنطقة", icon: "search" },
  calendar: { title: "تقويم الزيارات", subtitle: "عرض الزيارات حسب الأيام والتاريخ المحدد", icon: "calendar-month" },
  representatives: { title: "للمندوبين متنوع", subtitle: "تفاصيل الزيارات والأصناف والملاحظات لكل مندوب", icon: "people" },
  daily: { title: "طباعة", subtitle: "تقرير الزيارات اليومية بصيغة جاهزة للطباعة", icon: "print" },
  "monthly-representative": { title: "شهري حسب المندوب", subtitle: "مقارنة الزيارات الشهرية لكل مندوب", icon: "person" },
  "representatives-total": { title: "إجمالي للمندوبين", subtitle: "ملخص إجمالي الزيارات والزيارات اليومية والشهرية", icon: "summarize" },
  "daily-analysis": { title: "تحليلي يومي", subtitle: "تحليل يومي للزيارات والأطباء والفترات", icon: "analytics" },
};

const REPORT_ROUTES: { route: string; variant: ReportVariant }[] = [
  { route: "report-print", variant: "daily" },
  { route: "report-daily-analysis", variant: "daily-analysis" },
  { route: "report-search", variant: "search" },
  { route: "report-monthly", variant: "monthly-representative" },
  { route: "report-total", variant: "representatives-total" },
  { route: "report-calendar", variant: "calendar" },
  { route: "report-representatives", variant: "representatives" },
];

const REPORT_SELECTIONS_KEY = "medical-visit-manager:report-selection-preferences";
const REGION_OPTIONS = [
  { value: "all", label: "كل المناطق" },
  { value: "north", label: "شمال صنعاء" },
  { value: "south", label: "جنوب صنعاء" },
] as const;
const MONTH_OPTIONS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"].map((label, index) => ({ value: String(index), label }));
const REPORT_TABLE_MIN_WIDTH = 780;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const DETAIL_HEADERS: { key: SortKey; label: string; width?: number }[] = [
  { key: "first", label: "الطبيب" },
  { key: "second", label: "المندوب" },
  { key: "third", label: "التاريخ", width: 112 },
  { key: "fourth", label: "الأصناف", width: 144 },
  { key: "fifth", label: "العنوان", width: 160 },
];
const SUMMARY_HEADERS: { key: SortKey; label: string; width?: number }[] = [
  { key: "first", label: "المندوب" },
  { key: "second", label: "عدد الزيارات", width: 96 },
  { key: "third", label: "عدد الأيام", width: 96 },
  { key: "fourth", label: "آخر زيارة", width: 112 },
];
const DAILY_HEADERS: { key: SortKey; label: string; width?: number }[] = [
  { key: "first", label: "الطبيب", width: 150 },
  { key: "second", label: "الكلاس", width: 110 },
  { key: "third", label: "التخصص", width: 140 },
  { key: "fourth", label: "الفترة", width: 88 },
  { key: "fifth", label: "الملاحظات", width: 220 },
  { key: "sixth", label: "الموقع الجغرافي", width: 260 },
  { key: "seventh", label: "الأصناف", width: 180 },
];
const COMPREHENSIVE_DAILY_HEADERS: { key: SortKey; label: string; width?: number }[] = [
  { key: "first", label: "تاريخ الزيارة", width: 125 },
  { key: "second", label: "الطبيب", width: 155 },
  { key: "third", label: "التخصص", width: 145 },
  { key: "fourth", label: "الفترة", width: 88 },
  { key: "fifth", label: "العنوان", width: 190 },
  { key: "sixth", label: "الأصناف الموصوفة", width: 190 },
  { key: "seventh", label: "المندوب", width: 150 },
  { key: "eighth", label: "المنطقة", width: 125 },
];

const dateText = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : localDateKey(date);
};

const visitShiftText = (iso: string) => {
  const hour = new Date(iso).getHours();
  return hour >= 16 && hour < 21 ? "مساء" : "صباح";
};

const visitLocationText = (visit: Visit) => {
  const label = visit.geographicLocation || visit.entityAddress || "غير محدد";
  const coordinates = visit.geographicCoordinates || visit.location;
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return label;
  return `${label} (${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)})`;
};

const compareValues = (left: string, right: string) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (left !== "" && right !== "" && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right, "ar", { numeric: true, sensitivity: "base" });
};

function HorizontalScrollHint({ label = "اسحب أفقياً لرؤية بقية الأعمدة" }: { label?: string }) {
  return <View accessibilityRole="text" accessibilityLabel={label} style={{ minHeight: 32, marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#B7CDE5", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, shadowColor: "#1257A6", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}><MaterialIcons name="swipe" size={16} color="#1257A6" /><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800", textAlign: "center" }}>{label}</Text><MaterialIcons name="chevron-left" size={18} color="#7C8798" /></View>;
}

function DailyTotalsRow({ rows }: { rows: ReportRow[] }) {
  const morning = rows.filter((row) => row.fourth === "صباح").length;
  const evening = rows.filter((row) => row.fourth === "مساء").length;
  return <View style={{ minHeight: 46, flexDirection: "row-reverse", borderTopWidth: 2, borderTopColor: "#4B78A8", backgroundColor: "#DBEAFE" }}>
    <View style={{ width: 400, paddingHorizontal: 10, paddingVertical: 12, justifyContent: "center" }}><Text style={{ color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "right" }}>إجمالي الزيارات</Text></View>
    <View style={{ width: 88, paddingHorizontal: 6, paddingVertical: 12, justifyContent: "center", borderRightWidth: 1, borderRightColor: "#9DB5CF" }}><Text style={{ color: "#123B68", fontSize: 11, fontWeight: "800", textAlign: "center" }}>صباح: {morning}</Text></View>
    <View style={{ width: 220, paddingHorizontal: 6, paddingVertical: 12, justifyContent: "center", borderRightWidth: 1, borderRightColor: "#9DB5CF" }}><Text style={{ color: "#123B68", fontSize: 11, fontWeight: "800", textAlign: "center" }}>مساء: {evening}</Text></View>
    <View style={{ width: 260, paddingHorizontal: 6, paddingVertical: 12, justifyContent: "center", borderRightWidth: 1, borderRightColor: "#9DB5CF" }}><Text style={{ color: "#123B68", fontSize: 11, fontWeight: "800", textAlign: "center" }}>الكل: {rows.length}</Text></View>
    <View style={{ width: 180 }} />
  </View>;
}

function MonthlyRepresentativeTable({ visits, entities, year, comparisonYear }: { visits: Visit[]; entities: { id: string; name: string }[]; year: number; comparisonYear: number }) {
  const [selectedCell, setSelectedCell] = useState<{ doctor: string; month: string; visits: Visit[] } | null>(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [sortByAnnual, setSortByAnnual] = useState<"asc" | "desc">("desc");
  const [monthlySort, setMonthlySort] = useState<{ column: "annual" | number; direction: "asc" | "desc" }>({ column: "annual", direction: "desc" });
  const doctorRows = useMemo(() => {
    const byDoctor = new Map<string, { id: string; name: string; counts: number[] }>();
    visits.forEach((visit) => {
      const date = new Date(visit.recordedAt);
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
      const key = visit.entityId || visit.entityName;
      const current = byDoctor.get(key) ?? { id: key, name: entities.find((entity) => entity.id === visit.entityId)?.name ?? visit.entityName, counts: Array.from({ length: 12 }, () => 0) };
      current.counts[date.getMonth()] += 1;
      byDoctor.set(key, current);
    });
    const normalizedSearch = doctorSearch.trim().toLowerCase();
    return [...byDoctor.values()].filter((row) => !normalizedSearch || row.name.toLowerCase().includes(normalizedSearch)).sort((left, right) => {
      const leftAnnual = left.counts.reduce((sum, count) => sum + count, 0);
      const rightAnnual = right.counts.reduce((sum, count) => sum + count, 0);
      return sortByAnnual === "asc" ? leftAnnual - rightAnnual || left.name.localeCompare(right.name, "ar") : rightAnnual - leftAnnual || left.name.localeCompare(right.name, "ar");
    });
  }, [doctorSearch, entities, sortByAnnual, visits, year]);
  const comparisonRows = useMemo(() => {
    const normalizedSearch = doctorSearch.trim().toLowerCase();
    return buildMonthlyReportRows(visits.map((visit) => ({ recordedAt: visit.recordedAt, entityId: visit.entityId, entityName: visit.entityName })), comparisonYear).filter((row) => !normalizedSearch || row.entityName.toLowerCase().includes(normalizedSearch)).sort((left, right) => {
      const leftAnnual = left.counts.reduce((sum, count) => sum + count, 0);
      const rightAnnual = right.counts.reduce((sum, count) => sum + count, 0);
      return sortByAnnual === "asc" ? leftAnnual - rightAnnual || left.entityName.localeCompare(right.entityName, "ar") : rightAnnual - leftAnnual || left.entityName.localeCompare(right.entityName, "ar");
    });
  }, [comparisonYear, doctorSearch, sortByAnnual, visits]);
  const totals = doctorRows.reduce((sum, row) => sum.map((value, index) => value + row.counts[index]), Array.from({ length: 12 }, () => 0));
  const sortedDoctorRows = useMemo(() => [...doctorRows].sort((left, right) => {
    const leftValue = monthlySort.column === "annual" ? left.counts.reduce((sum, count) => sum + count, 0) : left.counts[monthlySort.column];
    const rightValue = monthlySort.column === "annual" ? right.counts.reduce((sum, count) => sum + count, 0) : right.counts[monthlySort.column];
    const result = leftValue - rightValue || left.name.localeCompare(right.name, "ar");
    return monthlySort.direction === "asc" ? result : -result;
  }), [doctorRows, monthlySort]);
  const toggleMonthlySort = (column: "annual" | number) => setMonthlySort((current) => current.column === column ? { column, direction: current.direction === "asc" ? "desc" : "asc" } : { column, direction: "desc" });
  const comparisonByDoctor = new Map(comparisonRows.map((row) => [row.entityName, row.counts.reduce((sum, count) => sum + count, 0)]));
  const comparisonDoctorNames = [...new Set([...doctorRows.map((row) => row.name), ...comparisonRows.map((row) => row.entityName)])].sort((left, right) => left.localeCompare(right, "ar"));
  const orderedMonths = MONTH_ABBR.slice().reverse();
  const monthWidth = 92;
  const fixedWidth = 190;
  const cellStyle = { borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#22313F", minHeight: 58, paddingHorizontal: 5, alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 };
  const openDetails = (doctor: { id: string; name: string }, monthName: string, monthIndex: number) => {
    const selectedVisits = visits.filter((visit) => {
      const date = new Date(visit.recordedAt);
      return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === monthIndex && (visit.entityId || visit.entityName) === doctor.id;
    });
    setSelectedCell({ doctor: doctor.name, month: `${monthName}-${year}`, visits: selectedVisits });
  };
  return <View className="rounded-2xl border-2 border-[#22313F] overflow-hidden bg-surface"><View className="px-4 py-3 bg-[#F8FBFF] border-b border-border"><Text className="text-foreground font-bold text-right">الزيارات الشهرية حسب المندوب</Text><Text className="text-muted text-[10px] text-right mt-1">اضغط على أي عدد شهري لعرض تفاصيل الزيارات</Text><View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}><TextInput value={doctorSearch} onChangeText={setDoctorSearch} placeholder="بحث باسم الطبيب" placeholderTextColor="#7C8798" textAlign="right" style={{ flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#B7CDE5", backgroundColor: "#FFFFFF", paddingHorizontal: 12, color: "#102A43" }} /><Pressable onPress={() => setSortByAnnual((current) => current === "asc" ? "desc" : "asc")} accessibilityRole="button" accessibilityLabel="فرز حسب إجمالي السنة" style={{ minHeight: 42, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EAF3FB", borderWidth: 1, borderColor: "#B7CDE5", justifyContent: "center" }}><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800" }}>الإجمالي {sortByAnnual === "asc" ? "تصاعدي" : "تنازلي"}</Text></Pressable></View></View><View style={{ flexDirection: "row-reverse" }}><View style={{ width: fixedWidth, backgroundColor: "#FFFFFF" }}><View style={[cellStyle, { backgroundColor: "#BFE8D6" }]} /><View style={[cellStyle, { backgroundColor: "#BFE8D6" }]}><Text style={{ color: "#1257A6", fontSize: 12, fontWeight: "800", textAlign: "center" }}>اسم الطبيب</Text></View>{sortedDoctorRows.map((row) => <View key={row.id} style={[cellStyle, { alignItems: "flex-end", backgroundColor: "#F8FBFF" }]}><Text style={{ color: "#102A43", fontSize: 12, fontWeight: "700", textAlign: "right" }} numberOfLines={2}>{row.name}</Text></View>)}<View style={[cellStyle, { alignItems: "flex-end", backgroundColor: "#DBEAFE" }]}><Text style={{ color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "right" }}>الإجمالي السنوي</Text></View></View><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: monthWidth * 12 }}><View style={{ minWidth: monthWidth * 12 }}><View style={{ flexDirection: "row-reverse" }}>{orderedMonths.map((monthName, monthIndex) => <Pressable key={monthName} onPress={() => toggleMonthlySort(11 - monthIndex)} accessibilityRole="button" accessibilityLabel={`فرز شهر ${monthName}`} style={[cellStyle, { width: monthWidth, backgroundColor: "#BFE8D6" }]}><Text style={{ color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "center" }}>{monthName}-{year}</Text></Pressable>)}<Pressable onPress={() => toggleMonthlySort("annual")} accessibilityRole="button" accessibilityLabel="فرز حسب إجمالي السنة" style={[cellStyle, { width: monthWidth, backgroundColor: "#BFE8D6" }]}><Text style={{ color: "#123B68", fontSize: 11, fontWeight: "800", textAlign: "center" }}>إجمالي السنة</Text></Pressable></View><View style={{ flexDirection: "row-reverse" }}>{orderedMonths.map((monthName) => <View key={monthName} style={[cellStyle, { width: monthWidth, backgroundColor: "#DFF3FF" }]}><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800", textAlign: "center" }}>عدد الزيارات</Text></View>)}<View style={[cellStyle, { width: monthWidth, backgroundColor: "#DFF3FF" }]}><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800", textAlign: "center" }}>عدد الزيارات</Text></View></View>{sortedDoctorRows.map((row, rowIndex) => <View key={row.id} style={{ flexDirection: "row-reverse" }}>{row.counts.slice().reverse().map((count, monthIndex) => { const actualMonthIndex = 11 - monthIndex; const monthName = MONTH_ABBR[actualMonthIndex]; return <Pressable key={`${row.id}-${actualMonthIndex}`} onPress={() => openDetails(row, monthName, actualMonthIndex)} accessibilityRole="button" accessibilityLabel={`تفاصيل زيارات ${row.name} في ${monthName} ${year}`} style={({ pressed }) => [cellStyle, { width: monthWidth, backgroundColor: rowIndex % 2 ? "#FFFFFF" : "#F8FBFF" }, pressed && { backgroundColor: "#B8D8F2" }]}><Text style={{ color: count ? "#1257A6" : "#7C8798", fontSize: 13, fontWeight: count ? "800" : "500", textAlign: "center" }}>{count || "—"}</Text></Pressable>; })}<View style={[cellStyle, { width: monthWidth, backgroundColor: rowIndex % 2 ? "#FFFFFF" : "#F8FBFF" }]}><Text style={{ color: "#1257A6", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{row.counts.reduce((sum, count) => sum + count, 0) || "—"}</Text></View></View>)}<View style={{ flexDirection: "row-reverse" }}>{totals.slice().reverse().map((total, monthIndex) => <View key={`total-${monthIndex}`} style={[cellStyle, { width: monthWidth, backgroundColor: "#DBEAFE" }]}><Text style={{ color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{total}</Text></View>)}<View style={[cellStyle, { width: monthWidth, backgroundColor: "#DBEAFE" }]}><Text style={{ color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{totals.reduce((sum, count) => sum + count, 0)}</Text></View></View>{!doctorRows.length ? <View style={{ padding: 32, alignItems: "center" }}><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد زيارات للسنة المحددة</Text></View> : null}</View></ScrollView></View><View style={{ marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: "#B7CDE5", overflow: "hidden", backgroundColor: "#FFFFFF" }}><View style={{ padding: 12, backgroundColor: "#EAF3FB" }}><Text style={{ color: "#123B68", fontSize: 14, fontWeight: "800", textAlign: "right" }}>مقارنة الأداء السنوي</Text><Text style={{ color: "#64748B", fontSize: 11, textAlign: "right", marginTop: 3 }}>{year} مقابل {comparisonYear}</Text></View><View style={{ flexDirection: "row-reverse", backgroundColor: "#DFF3FF" }}><Text style={{ flex: 1, padding: 10, color: "#1257A6", fontWeight: "800", textAlign: "right" }}>اسم الطبيب</Text><Text style={{ width: 100, padding: 10, color: "#1257A6", fontWeight: "800", textAlign: "center" }}>{year}</Text><Text style={{ width: 100, padding: 10, color: "#1257A6", fontWeight: "800", textAlign: "center" }}>{comparisonYear}</Text><Text style={{ width: 100, padding: 10, color: "#1257A6", fontWeight: "800", textAlign: "center" }}>الفرق</Text></View>{comparisonDoctorNames.map((doctorName, index) => { const current = doctorRows.find((row) => row.name === doctorName)?.counts.reduce((sum, count) => sum + count, 0) ?? 0; const previous = comparisonByDoctor.get(doctorName) ?? 0; return <View key={doctorName} style={{ flexDirection: "row-reverse", backgroundColor: index % 2 ? "#FFFFFF" : "#F8FBFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}><Text style={{ flex: 1, padding: 10, color: "#102A43", fontWeight: "700", textAlign: "right" }}>{doctorName}</Text><Text style={{ width: 100, padding: 10, color: "#1257A6", fontWeight: "800", textAlign: "center" }}>{current}</Text><Text style={{ width: 100, padding: 10, color: "#64748B", fontWeight: "800", textAlign: "center" }}>{previous}</Text><Text style={{ width: 100, padding: 10, color: current - previous >= 0 ? "#16835B" : "#B42318", fontWeight: "800", textAlign: "center" }}>{current - previous > 0 ? `+${current - previous}` : current - previous}</Text></View>; })}</View><Modal visible={Boolean(selectedCell)} transparent animationType="fade" onRequestClose={() => setSelectedCell(null)}><Pressable onPress={() => setSelectedCell(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 20 }}><Pressable onPress={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 500, maxHeight: "78%", alignSelf: "center", borderRadius: 20, backgroundColor: "#FFFFFF", overflow: "hidden" }}><View style={{ padding: 16, backgroundColor: "#1257A6", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><View style={{ flexDirection: "row-reverse", gap: 8 }}><Pressable onPress={() => { if (!selectedCell) return; void createMonthlyVisitDetailsCsvFile(selectedCell.visits, selectedCell.doctor, selectedCell.month).then((uri) => shareOrDownloadFile(uri, "text/csv")).catch(() => Alert.alert("تعذر التصدير", "لم يتم إنشاء ملف تفاصيل الزيارات.")); }} accessibilityRole="button" accessibilityLabel="تصدير تفاصيل الزيارات" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><MaterialIcons name="download" size={19} color="#FFFFFF" /></Pressable><Pressable onPress={() => setSelectedCell(null)} accessibilityRole="button" accessibilityLabel="إغلاق التفاصيل" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><MaterialIcons name="close" size={20} color="#FFFFFF" /></Pressable></View><View style={{ flex: 1, marginRight: 10 }}><Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", textAlign: "right" }}>{selectedCell?.month}</Text><Text style={{ color: "#DFF3FF", fontSize: 12, textAlign: "right", marginTop: 3 }}>{selectedCell?.doctor}</Text></View></View><ScrollView contentContainerStyle={{ padding: 16 }}>{selectedCell?.visits.length ? selectedCell.visits.map((visit, index) => <View key={visit.id} style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}><Text style={{ color: "#102A43", fontWeight: "700", textAlign: "right" }}>{index + 1}. {visit.entityName}</Text><Text style={{ color: "#64748B", fontSize: 12, textAlign: "right", marginTop: 4 }}>{new Date(visit.recordedAt).toLocaleString("ar-YE")}</Text><Text style={{ color: "#64748B", fontSize: 12, textAlign: "right", marginTop: 2 }}>{visit.entityAddress || visit.geographicLocation || "لا يوجد عنوان مسجل"}</Text></View>) : <Text style={{ color: "#64748B", textAlign: "center", paddingVertical: 24 }}>لا توجد زيارات في هذا الشهر.</Text>}</ScrollView></Pressable></Pressable></Modal></View>;
}

function ReportTableCell({ row, header, onLocationPress }: { row: ReportRow; header: { key: SortKey; label: string; width?: number }; onLocationPress: (location: string) => void }) {
  const value = String(row[header.key] ?? "—");
  const baseStyle = { width: header.width, flex: header.width ? undefined : 1, flexShrink: header.width ? 0 : 1 };
  if (header.label !== "الموقع الجغرافي") return <Text className={`${header.width ? "" : "flex-1"} px-2 py-3 text-right ${header.key === "first" ? "text-foreground" : "text-muted"} text-xs`} style={header.width ? { width: header.width, flexShrink: 0 } : undefined} numberOfLines={1}>{value || "—"}</Text>;
  const mapUrl = buildGoogleMapsUrl(value);
  return <Pressable onPress={() => onLocationPress(value)} accessibilityRole="button" accessibilityLabel={mapUrl ? `عرض موقع ${value} داخل الخريطة` : "إحداثيات غير متاحة"} style={({ pressed }) => [{ ...baseStyle, minHeight: 46, paddingHorizontal: 8, paddingVertical: 9, flexDirection: "row-reverse", alignItems: "center", gap: 5 }, pressed && { backgroundColor: "#EAF3FB" }]}><MaterialIcons name={mapUrl ? "map" : "location-off"} size={17} color={mapUrl ? "#1257A6" : "#7C8798"} /><Text className="flex-1 text-right text-primary text-xs" numberOfLines={2}>{value || "—"}</Text></Pressable>;
}

function SelectField({ title, value, options, onChange }: { title: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const selected = options.find((option) => option.value === value)?.label || title;
  const active = focused || visible;
  return <>
    <Pressable onPress={() => setVisible(true)} onPressIn={() => setFocused(true)} onPressOut={() => setFocused(false)} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: visible }} style={({ pressed }) => [{ minHeight: 48, flex: 1, borderRadius: 12, borderWidth: active ? 2 : 1, borderColor: active ? "#1257A6" : "#D8E0EA", backgroundColor: active ? "#EAF3FB" : "#FFFFFF", paddingHorizontal: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", shadowColor: active ? "#1257A6" : "transparent", shadowOpacity: active ? 0.16 : 0, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: active ? 2 : 0 }, pressed && { opacity: 0.88 }]}>
      <MaterialIcons name="keyboard-arrow-down" size={22} color="#1257A6" />
      <View style={{ flex: 1, marginRight: 8 }}><Text style={{ color: "#1257A6", fontSize: 11, fontWeight: "800", textAlign: "right" }}>{title}</Text><Text style={{ color: value === "all" ? "#7C8798" : "#102A43", fontSize: 13, fontWeight: "700", textAlign: "right", marginTop: 2 }} numberOfLines={1}>{selected}</Text></View>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable onPress={() => setVisible(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", paddingHorizontal: 22 }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 460, alignSelf: "center", maxHeight: "70%", borderRadius: 20, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA" }}>
          <View style={{ padding: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#D8E0EA" }}><Pressable onPress={() => setVisible(false)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" }}><MaterialIcons name="close" size={20} color="#102A43" /></Pressable><Text style={{ flex: 1, marginRight: 10, color: "#102A43", fontSize: 16, fontWeight: "700", textAlign: "right" }}>{title}</Text></View>
          <ScrollView>{options.map((option) => <Pressable key={option.value} onPress={() => { onChange(option.value); setVisible(false); }} style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EEF2F6", backgroundColor: option.value === value ? "#EAF3FB" : "#FFFFFF" }, pressed && { opacity: 0.7 }]}><MaterialIcons name={option.value === value ? "radio-button-checked" : "radio-button-unchecked"} size={19} color={option.value === value ? "#1257A6" : "#7C8798"} /><Text style={{ flex: 1, marginRight: 10, color: option.value === value ? "#1257A6" : "#102A43", fontSize: 14, fontWeight: option.value === value ? "700" : "500", textAlign: "right" }}>{option.label}</Text></Pressable>)}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

function CalendarReport({ visits, leaves, holidays, representatives }: { visits: Pick<Visit, "recordedAt" | "entityName" | "representativeId">[]; leaves: RepresentativeLeave[]; holidays: OfficialHoliday[]; representatives: Representative[] }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [hoveredHolidayDay, setHoveredHolidayDay] = useState<number | null>(null);
  const cells = useMemo(() => { const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); return [...Array(first).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)]; }, [month]);
  const visitsByDay = useMemo(() => visits.reduce<Record<string, { morning: string[]; evening: string[] }>>((result, visit) => { const date = new Date(visit.recordedAt); if (date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()) { const key = String(date.getDate()); const current = result[key] ?? { morning: [], evening: [] }; const shift = date.getHours() >= 16 && date.getHours() < 21 ? "evening" : "morning"; current[shift] = [...current[shift], `${visit.entityName} · ${representatives.find((item) => item.id === visit.representativeId)?.name ?? "مندوب"}`]; result[key] = current; } return result; }, {}), [month, representatives, visits]);
  const leavesByDay = useMemo(() => leaves.reduce<Record<string, RepresentativeLeave[]>>((result, leave) => { const date = new Date(`${leave.date}T12:00:00`); if (date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()) { const key = String(date.getDate()); result[key] = [...(result[key] ?? []), leave]; } return result; }, {}), [leaves, month]);
  const holidaysByDay = useMemo(() => holidays.filter((holiday) => holiday.status === "approved").reduce<Record<string, OfficialHoliday[]>>((result, holiday) => { const cursor = new Date(`${holiday.startDate}T12:00:00`); const end = new Date(`${(holiday.endDate ?? holiday.startDate)}T12:00:00`); while (cursor <= end) { if (cursor.getFullYear() === month.getFullYear() && cursor.getMonth() === month.getMonth()) { const key = String(cursor.getDate()); result[key] = [...(result[key] ?? []), holiday]; } cursor.setDate(cursor.getDate() + 1); } return result; }, {}), [holidays, month]);
  const shiftMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const selectedYear = String(month.getFullYear());
  const yearOptions = useMemo(() => Array.from({ length: 11 }, (_, index) => { const year = new Date().getFullYear() - 5 + index; return { value: String(year), label: String(year) }; }), []);
  const monthPanResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2, onPanResponderRelease: (_, gesture) => { if (gesture.dx < -65) shiftMonth(1); else if (gesture.dx > 65) shiftMonth(-1); } }), []);
  const leaveText = (day: number, period: "morning" | "evening") => { const items = (leavesByDay[String(day)] ?? []).filter((leave) => leave.period === "full-day" || leave.period === period); if (!items.length) return null; const names = items.map((leave) => representatives.find((rep) => rep.id === leave.representativeId)?.name ?? "مندوب"); return `إجازة: ${[...new Set(names)].join("، ")}`; };
  const holidayText = (day: number) => { const items = holidaysByDay[String(day)] ?? []; if (!items.length) return null; return `إجازة عامة: ${[...new Set(items.map((holiday) => holiday.name))].join("، ")}`; };
  const holidayNames = (day: number) => [...new Set((holidaysByDay[String(day)] ?? []).map((holiday) => holiday.name))];
  const renderShift = (day: number, period: "morning" | "evening") => { const holiday = holidayText(day); const leave = leaveText(day, period); const names = visitsByDay[String(day)]?.[period] ?? []; const banner = holiday ?? leave; const backgroundColor = holiday ? "#DDF4E5" : leave ? "#F9D4D0" : period === "morning" ? "#E8F6EE" : "#EEEAFB"; const color = holiday ? "#176B3A" : leave ? "#9B1C1C" : period === "morning" ? "#16734D" : "#5B4B9A"; const borderColor = holiday ? "#58B77A" : leave ? "#E6A8A2" : period === "morning" ? "#B7E2C9" : "#D6C9F5"; return <View style={{ minHeight: 32, marginTop: 2, paddingHorizontal: 3, paddingVertical: 3, borderRadius: 6, backgroundColor, borderWidth: 1, borderColor: borderColor }}><Text style={{ color, fontSize: 8, fontWeight: "800", textAlign: "right" }}>{banner ?? (names.length ? names[0] : period === "morning" ? "صباح" : "مساء")}</Text>{!banner && names.length > 1 ? <Text style={{ color, fontSize: 7, textAlign: "right" }}>+{names.length - 1}</Text> : null}</View>; };
  return <View {...monthPanResponder.panHandlers} className="rounded-2xl border border-border overflow-hidden bg-surface"><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: REPORT_TABLE_MIN_WIDTH }}><View style={{ minWidth: REPORT_TABLE_MIN_WIDTH }}><View className="p-4 border-b border-border"><View className="flex-row-reverse items-center justify-between"><Pressable onPress={() => shiftMonth(1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialIcons name="chevron-right" size={24} color="#1257A6" /></Pressable><View className="items-center"><Text className="text-lg font-bold text-foreground">{month.toLocaleDateString("ar", { month: "long", year: "numeric" })}</Text><Text className="text-[10px] text-muted mt-1">اسحب يميناً أو يساراً لتغيير الشهر</Text></View><Pressable onPress={() => shiftMonth(-1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialIcons name="chevron-left" size={24} color="#1257A6" /></Pressable></View><View className="flex-row-reverse gap-2 mt-3"><View className="flex-1"><SelectField title="الشهر" value={String(month.getMonth())} options={MONTH_OPTIONS} onChange={(value) => setMonth((current) => new Date(current.getFullYear(), Number(value), 1))} /></View><View className="flex-1"><SelectField title="السنة" value={selectedYear} options={yearOptions} onChange={(value) => setMonth((current) => new Date(Number(value), current.getMonth(), 1))} /></View></View></View><View className="flex-row-reverse items-center justify-center gap-4 px-3 py-2 border-b border-border"><View className="flex-row-reverse items-center gap-1"><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#E8F6EE" }} /><Text className="text-[9px] text-muted">صباح</Text></View><View className="flex-row-reverse items-center gap-1"><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#EEEAFB" }} /><Text className="text-[9px] text-muted">مساء</Text></View><View className="flex-row-reverse items-center gap-1"><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#F9D4D0" }} /><Text className="text-[9px] text-muted">إجازة فردية</Text></View><View className="flex-row-reverse items-center gap-1"><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: "#DDF4E5", borderWidth: 1, borderColor: "#58B77A" }} /><Text className="text-[9px] text-muted">عطلة رسمية يمنية</Text></View></View><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => <Text key={day} className="flex-1 py-3 text-center text-primary font-bold text-[10px]">{day}</Text>)}</View><View className="flex-row-reverse flex-wrap p-2">{cells.map((day, index) => <View key={`${day || "empty"}-${index}`} className="w-[14.285%] p-1"><View className={`min-h-28 rounded-xl border ${day ? "border-border bg-background" : "border-transparent bg-transparent"} p-1`}>{day ? <>{(() => { const dayDate = new Date(month.getFullYear(), month.getMonth(), day); const holidayNamesForDay = holidayNames(day); const isHoliday = holidayNamesForDay.length > 0; return <Pressable disabled={!isHoliday} onHoverIn={() => setHoveredHolidayDay(day)} onHoverOut={() => setHoveredHolidayDay(null)} onPress={() => { if (isHoliday) Alert.alert("العطلة الرسمية", holidayNamesForDay.join("، ")); }} accessibilityLabel={isHoliday ? `العطلة الرسمية: ${holidayNamesForDay.join("، ")}` : `اليوم ${day}`} style={{ position: "relative" }}><Text style={{ color: isHoliday ? "#176B3A" : "#102A43", fontSize: 12, fontWeight: "800", textAlign: "right" }}>{day}</Text><Text style={{ color: "#6B7280", fontSize: 8, textAlign: "right", marginTop: 1 }}>{formatHijriDate(dayDate)}</Text>{hoveredHolidayDay === day ? <View pointerEvents="none" style={{ position: "absolute", zIndex: 20, top: 20, right: 0, minWidth: 120, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: "#176B3A", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 4, elevation: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700", textAlign: "right" }}>{holidayNamesForDay.join("، ")}</Text></View> : null}</Pressable>; })()}{renderShift(day, "morning")}{renderShift(day, "evening")}</> : null}</View></View>)}</View></View></ScrollView></View>;
}

type DailyAnalysisTableProps = { visits: Visit[]; monthlyVisits: Visit[]; representatives: Representative[] };

function DailyAnalysisTable({ visits, monthlyVisits, representatives }: DailyAnalysisTableProps) {
  const rows = useMemo(() => representatives.filter((rep) => rep.active).map((rep) => {
    const representativeVisits = visits.filter((visit) => visit.representativeId === rep.id);
    const monthlyVisitsForRep = monthlyVisits.filter((visit) => visit.representativeId === rep.id);
    const morning = representativeVisits.filter((visit) => { const hour = new Date(visit.recordedAt).getHours(); return hour >= 8 && hour < 14; }).length;
    const evening = representativeVisits.filter((visit) => { const hour = new Date(visit.recordedAt).getHours(); return hour >= 16 && hour < 21; }).length;
    return { id: rep.id, name: rep.name, dailyVisits: representativeVisits.length, evening, morning, monthlyVisits: monthlyVisitsForRep.length, monthlyDoctors: new Set(monthlyVisitsForRep.map((visit) => visit.entityName.trim()).filter(Boolean)).size };
  }), [monthlyVisits, representatives, visits]);
  const headerCellStyle = { minHeight: 48, paddingHorizontal: 8, alignItems: "center" as const, justifyContent: "center" as const, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#D8E0EA", flexShrink: 0 };
  const widths = [154, 110, 88, 88, 100, 126];
  return <View className="rounded-2xl border border-border overflow-hidden bg-surface"><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}><View style={{ minWidth: widths.reduce((sum, width) => sum + width, 0) }}><View className="flex-row-reverse"><View style={[headerCellStyle, { width: widths[0], backgroundColor: "#F5F8FC" }]} /><View style={[headerCellStyle, { width: widths[1] + widths[2] + widths[3], backgroundColor: "#BFE8D6" }]}><Text className="text-primary font-bold text-sm">يومي</Text></View><View style={[headerCellStyle, { width: widths[4] + widths[5], backgroundColor: "#DCEBFA" }]}><Text className="text-primary font-bold text-sm">شهري</Text></View></View><View className="flex-row-reverse bg-[#E8F2FB]">{["المندوب", "عدد الزيارات", "مساء", "صباح", "الزيارات", "الأطباء شهرياً"].map((label, index) => <View key={label} style={[headerCellStyle, { width: widths[index] }]}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{label}</Text></View>)}</View>{rows.length ? rows.map((row, index) => <View key={row.id} className={`flex-row-reverse ${index % 2 ? "bg-background" : "bg-surface"}`}>{[row.name, String(row.dailyVisits), String(row.evening), String(row.morning), String(row.monthlyVisits), String(row.monthlyDoctors)].map((value, valueIndex) => <View key={`${row.id}-${valueIndex}`} style={[{ width: widths[valueIndex], minHeight: 48, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#E5EAF0" }]}><Text className={`${valueIndex === 0 ? "text-foreground" : "text-primary"} text-xs font-bold text-center`} numberOfLines={2}>{value}</Text></View>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات تحليل ضمن الاختيارات الحالية</Text></View>}</View></ScrollView><Text className="px-3 py-2 text-[10px] text-muted text-right">الأطباء شهرياً = عدد الأطباء المختلفين في الزيارات خلال شهر التاريخ المحدد.</Text></View>;
}

type DailyDetailTableProps = { dailyVisits: Visit[]; scopedVisits: Visit[]; monthlyPlans: PlannedVisit[]; representatives: Representative[]; reportDate: string };
type DailyDetailSortKey = "representative" | "doctor" | "period" | "lastVisit" | "daysSince" | "monthlyVisits" | "totalVisits" | "totalMorning" | "totalEvening" | "visitRate";

function DailyDetailTable({ dailyVisits, scopedVisits, monthlyPlans, representatives, reportDate }: DailyDetailTableProps) {
  const selectedDate = new Date(`${reportDate}T12:00:00`);
  const columns = [
    { key: "representative", label: "المندوب", width: 150 },
    { key: "doctor", label: "الطبيب", width: 188 },
    { key: "period", label: "الفترة", width: 92 },
    { key: "lastVisit", label: "تاريخ آخر زيارة", width: 132 },
    { key: "daysSince", label: "الأيام ↑", width: 82 },
    { key: "monthlyVisits", label: "العدد", width: 76 },
    { key: "totalVisits", label: "الكلي", width: 76 },
    { key: "totalMorning", label: "صباح", width: 76 },
    { key: "totalEvening", label: "مساء", width: 76 },
    { key: "visitRate", label: "نسبة الزيارة", width: 104 },
  ] as const;
  const groupHeaders = [
    { label: "بيانات الزيارة اليومية", span: 3, color: "#BFE8D6" },
    { label: "بيانات آخر زيارة", span: 2, color: "#DCEBFA" },
    { label: "الزيارات الشهرية", span: 1, color: "#E8F2FB" },
    { label: "عدد الزيارات الكلي", span: 3, color: "#FCE8D8" },
    { label: "بيانات الزيارة الشهرية", span: 1, color: "#E8E1F7" },
  ];
  const widthByKey = Object.fromEntries(columns.map((column) => [column.key, column.width]));
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const rows = dailyVisits.map((visit) => {
    const related = scopedVisits.filter((candidate) => candidate.representativeId === visit.representativeId && candidate.entityId === visit.entityId);
    const latest = related.reduce<Visit | null>((current, candidate) => !current || candidate.recordedAt > current.recordedAt ? candidate : current, null);
    const monthly = related.filter((candidate) => {
      const date = new Date(candidate.recordedAt);
      return !Number.isNaN(date.getTime()) && !Number.isNaN(selectedDate.getTime()) && date.getFullYear() === selectedDate.getFullYear() && date.getMonth() === selectedDate.getMonth();
    });
    const latestDate = latest ? new Date(latest.recordedAt) : null;
    const daysSince = latestDate && !Number.isNaN(latestDate.getTime()) && !Number.isNaN(selectedDate.getTime()) ? Math.max(0, Math.floor((selectedDate.getTime() - latestDate.getTime()) / 86400000)) : null;
    const period = new Date(visit.recordedAt).getHours() >= 8 && new Date(visit.recordedAt).getHours() < 14 ? "صباح" : new Date(visit.recordedAt).getHours() >= 16 && new Date(visit.recordedAt).getHours() < 21 ? "مساء" : "خارج الدوام";
    const totalMorning = related.filter((candidate) => { const hour = new Date(candidate.recordedAt).getHours(); return hour >= 8 && hour < 14; }).length;
    const totalEvening = related.filter((candidate) => { const hour = new Date(candidate.recordedAt).getHours(); return hour >= 16 && hour < 21; }).length;
    const representative = representatives.find((candidate) => candidate.id === visit.representativeId)?.name || "غير محدد";
    const plannedForDoctor = monthlyPlans.filter((plan) => {
      const planDate = new Date(`${plan.scheduledDate}T12:00:00`);
      return plan.representativeId === visit.representativeId && plan.entityId === visit.entityId && plan.planStatus !== "cancelled" && plan.approvalStatus !== "rejected" && !Number.isNaN(planDate.getTime()) && !Number.isNaN(selectedDate.getTime()) && planDate.getFullYear() === selectedDate.getFullYear() && planDate.getMonth() === selectedDate.getMonth();
    }).length;
    const visitRate = plannedForDoctor ? `${((monthly.length / plannedForDoctor) * 100).toFixed(1)}%` : "—";
    return { id: visit.id, representative, doctor: visit.entityName, period, lastVisit: latest ? dateText(latest.recordedAt) : "—", daysSince: daysSince === null ? "—" : String(daysSince), monthlyVisits: String(monthly.length), totalVisits: String(related.length), totalMorning: String(totalMorning), totalEvening: String(totalEvening), visitRate } as const;
  });
  const [sortKey, setSortKey] = useState<DailyDetailSortKey>("lastVisit");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const sortedRows = useMemo(() => [...rows].sort((left, right) => { const result = compareValues(String(left[sortKey] ?? ""), String(right[sortKey] ?? "")); return sortDirection === "asc" ? result : -result; }), [rows, sortDirection, sortKey]);
  const toggleDetailSort = (key: DailyDetailSortKey) => { if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("asc"); } };
  const headerCellStyle = { minHeight: 50, paddingHorizontal: 8, alignItems: "center" as const, justifyContent: "center" as const, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#22313F", flexShrink: 0 };
  const valueFor = (row: (typeof rows)[number], key: (typeof columns)[number]["key"]) => row[key];
  return <View className="mt-4 rounded-2xl border-2 border-[#22313F] overflow-hidden bg-surface"><View className="px-4 py-3 bg-[#F8FBFF] border-b border-border"><Text className="text-foreground font-bold text-right">تفاصيل الزيارات اليومية وآخر زيارة والمؤشرات الشهرية</Text><Text className="text-muted text-[10px] text-right mt-1">اضغط على عنوان العمود للفرز {sortDirection === "asc" ? "التصاعدي" : "التنازلي"}.</Text></View><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: totalWidth }}><View style={{ minWidth: totalWidth }}><View className="flex-row-reverse">{groupHeaders.map((group) => <View key={group.label} style={[headerCellStyle, { width: columns.slice(groupHeaders.slice(0, groupHeaders.indexOf(group)).reduce((sum, item) => sum + item.span, 0), groupHeaders.slice(0, groupHeaders.indexOf(group)).reduce((sum, item) => sum + item.span, 0) + group.span).reduce((sum, column) => sum + column.width, 0), backgroundColor: group.color }]}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{group.label}</Text></View>)}</View><View className="flex-row-reverse bg-[#D7EFDF]">{columns.map((column) => <Pressable key={column.key} onPress={() => toggleDetailSort(column.key)} style={[headerCellStyle, { width: widthByKey[column.key] }, sortKey === column.key && { backgroundColor: "#B8D8F2" }]} accessibilityRole="button" accessibilityLabel={`فرز حسب ${column.label}`}><Text className="text-primary font-bold text-xs text-center" numberOfLines={2}>{column.label}</Text><MaterialIcons name={sortKey === column.key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={14} color={sortKey === column.key ? "#1257A6" : "#7C8798"} /></Pressable>)}</View>{sortedRows.length ? sortedRows.map((row, index) => <View key={row.id} className={`flex-row-reverse ${index % 2 ? "bg-background" : "bg-surface"}`}>{columns.map((column) => <View key={`${row.id}-${column.key}`} style={{ width: widthByKey[column.key], minHeight: 48, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#9AA7B2" }}><Text className={`${column.key === "representative" || column.key === "doctor" ? "text-foreground" : "text-primary"} text-xs font-bold text-center`} numberOfLines={2}>{valueFor(row, column.key)}</Text></View>)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد زيارات في التاريخ المحدد</Text></View>}</View></ScrollView><Text className="px-3 py-2 text-[10px] text-muted text-right">نسبة الزيارة = الزيارات المنفذة في الشهر ÷ الزيارات المخططة في الشهر × 100. إذا لم توجد خطة شهرية يظهر «—».</Text></View>;
}

export function ReportVariantScreen({ variant }: { variant: ReportVariant }) {
  const router = useRouter();
  const { session } = useAccountSession();
  const { data } = useVisitStore();
  const reportVisits = useMemo(() => getReportVisits(session?.role === "manager" ? data.visits : data.visits.filter((visit) => visit.representativeId === session?.representativeId)), [data.visits, session?.representativeId, session?.role]);
  const config = CONFIG[variant];
  const [search, setSearch] = useState("");
  const [representativeId, setRepresentativeId] = useState("all");
  const [fromDate, setFromDate] = useState(() => isSingleDateReport(variant) ? localDateKey(new Date()) : "");
  const [toDate, setToDate] = useState("");
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [comparisonYear, setComparisonYear] = useState(new Date().getFullYear() - 1);
  const [region, setRegion] = useState<"all" | "north" | "south">("all");
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"from" | "to" | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const [reportProgressMessage, setReportProgressMessage] = useState("");
  const [mapLocation, setMapLocation] = useState<{ label: string; coordinates: { latitude: number; longitude: number } } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("third");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const progress = useRef(new Animated.Value(0)).current;
  const reportIndex = REPORT_ROUTES.findIndex((item) => item.variant === variant);
  const representativeOptions = useMemo<SelectOption[]>(() => [{ value: "all", label: "كل المندوبين" }, ...data.representatives.filter((rep) => rep.active).sort((left, right) => left.name.localeCompare(right.name, "ar")).map((rep) => ({ value: rep.id, label: rep.name }))], [data.representatives]);

  useEffect(() => {
    if (session?.role !== "manager") return;
    let active = true;
    void AsyncStorage.getItem(REPORT_SELECTIONS_KEY).then((raw) => {
      if (!active) return;
      try {
        const saved = raw ? JSON.parse(raw) as { representativeId?: string; region?: "all" | "north" | "south" } : {};
        if (saved.region === "all" || saved.region === "north" || saved.region === "south") setRegion(saved.region);
        if (saved.representativeId === "all" || data.representatives.some((rep) => rep.id === saved.representativeId)) setRepresentativeId(saved.representativeId || "all");
      } catch { /* ignore malformed local preferences */ }
      setSelectionHydrated(true);
    }).catch(() => { if (active) setSelectionHydrated(true); });
    return () => { active = false; };
  }, [data.representatives, session?.role]);
  useEffect(() => {
    if (session?.role !== "manager" || !selectionHydrated) return;
    void AsyncStorage.setItem(REPORT_SELECTIONS_KEY, JSON.stringify({ representativeId, region }));
  }, [representativeId, region, selectionHydrated, session?.role]);

  function showLoading(duration = 650) { setLoading(true); setTimeout(() => setLoading(false), duration); }
  function triggerFilter<T>(setter: (value: T) => void, value: T) { setter(value); showLoading(500); }
  const goToReport = useCallback((offset: number) => { if (session?.role !== "manager") return; const nextIndex = (reportIndex + offset + REPORT_ROUTES.length) % REPORT_ROUTES.length; router.replace(`/(tabs)/${REPORT_ROUTES[nextIndex].route}` as never); }, [reportIndex, router, session?.role]);
  useEffect(() => { if (!loading) { progress.stopAnimation(); progress.setValue(0); return; } const loop = Animated.loop(Animated.sequence([Animated.timing(progress, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false }), Animated.timing(progress, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: false })])); loop.start(); return () => loop.stop(); }, [loading, progress]);
  const reportPanResponder = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25, onPanResponderRelease: (_, gesture) => { if (gesture.dx < -70) goToReport(1); else if (gesture.dx > 70) goToReport(-1); } }), [goToReport]);

  const filteredVisits = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return reportVisits.filter((visit) => {
      const day = dateText(visit.recordedAt);
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      const dateMatches = variant === "monthly-representative" ? true : reportDateMatches(variant, day, fromDate, toDate);
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region) && dateMatches;
    });
  }, [data.entities, fromDate, region, reportVisits, representativeId, search, toDate, variant]);

  const reportRows = useMemo(() => filteredVisits.map((visit) => {
    const hour = new Date(visit.recordedAt).getHours();
    return {
      representativeName: data.representatives.find((rep) => rep.id === visit.representativeId)?.name ?? "غير محدد",
      entityName: visit.entityName,
      category: visit.category,
      specialty: visit.specialty,
      entityAddress: visit.entityAddress,
      geographicLocation: visitLocationText(visit),
      shift: hour >= 16 && hour < 21 ? "مساء" : "صباح",
      visitedItems: visit.visitedItems?.join("، ") || "—",
      notes: visit.notes,
    };
  }), [data.representatives, filteredVisits]);

  const monthlyReportYear = variant === "monthly-representative" ? reportYear : Number((fromDate || new Date().toISOString()).slice(0, 4));
  const monthlyExportRows = useMemo(() => buildMonthlyReportRows(filteredVisits.map((visit) => ({ recordedAt: visit.recordedAt, entityId: visit.entityId, entityName: visit.entityName })), monthlyReportYear), [filteredVisits, monthlyReportYear]);
  const representativeTotalExportRows = useMemo(() => buildRepresentativeTotalReportRows(filteredVisits.map((visit) => ({ representativeId: visit.representativeId, representativeName: data.representatives.find((representative) => representative.id === visit.representativeId)?.name ?? "مندوب", entityId: visit.entityId, entityName: visit.entityName, recordedAt: visit.recordedAt })), data.representatives), [data.representatives, filteredVisits]);

  const handlePrint = async () => {
    if (loading || variant !== "daily") return;
    setLoading(true);
    try {
      const html = buildDailyVisitPdfHtml(reportRows, fromDate || new Date().toISOString(), "مدير الزيارات الطبية");
      await Print.printAsync({
        html,
        orientation: Print.Orientation.landscape,
        width: 1123,
        height: 794,
        margins: { left: 28, right: 28, top: 28, bottom: 34 },
      });
    } catch (error) {
      console.error("تعذر تجهيز تقرير الطباعة", error);
    } finally {
      setLoading(false);
    }
  };

  const createActionFile = async (format: ReportActionFormat, onProgress?: (value: number, message: string) => void) => {
    const reportDate = fromDate || new Date().toISOString();
    onProgress?.(0.08, "جاري إنشاء محتوى التقرير...");
    let file: { uri: string; mimeType: string; label: string };
    if (variant === "representatives-total" && format === "pdf") file = { uri: await createRepresentativeTotalVisitPdfFile(representativeTotalExportRows, data.representatives), mimeType: "application/pdf", label: "PDF" };
    else if (variant === "representatives-total" && format === "xlsx") file = { uri: await createRepresentativeTotalVisitExcelFile(representativeTotalExportRows, data.representatives), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" };
    else if (variant === "monthly-representative" && format === "pdf") file = { uri: await createMonthlyVisitPdfFile(monthlyExportRows, monthlyReportYear), mimeType: "application/pdf", label: "PDF" };
    else if (variant === "monthly-representative" && format === "xlsx") file = { uri: await createMonthlyVisitExcelFile(monthlyExportRows, monthlyReportYear), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" };
    else if (format === "pdf") file = { uri: await createDailyVisitPdfFile(reportRows, reportDate), mimeType: "application/pdf", label: "PDF" };
    else if (format === "xlsx") file = { uri: await createDailyVisitExcelFile(reportRows, reportDate), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" };
    else if (format === "csv") file = { uri: await createDailyVisitCsvFile(reportRows, reportDate), mimeType: "text/csv", label: "CSV" };
    else file = { uri: await createDailyVisitHtmlFile(reportRows, reportDate), mimeType: "text/html", label: "HTML" };
    onProgress?.(0.68, "اكتمل إنشاء الملف، جاري بدء التنزيل...");
    return file;
  };

  const handleActionExport = async (format: ReportActionFormat) => {
    if (loading) return;
    setActionSheetVisible(false);
    setLoading(true);
    try {
      const updateReportProgress = (value: number, message: string) => {
        setReportProgress(Math.min(1, Math.max(0, value)));
        setReportProgressMessage(message);
      };
      updateReportProgress(0.04, "جاري تجهيز التقرير...");
      const file = await createActionFile(format, updateReportProgress);
      const result = await downloadReportFile(file.uri, format, updateReportProgress);
      Alert.alert(result.mode === "download" ? "تم بدء التنزيل" : "تم تجهيز الملف", result.message);
    } catch (error) {
      Alert.alert("تعذر تنفيذ الإجراء", error instanceof Error ? error.message : "تعذر إنشاء الملف أو فتح نافذة المشاركة.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setReportProgress(0);
        setReportProgressMessage("");
      }, 250);
    }
  };

  const handleActionSend = async (channel: ReportActionChannel, format: ReportActionFormat, contacts: ReportActionContact[], template: string) => {
    if (loading) return;
    if (!contacts.length) {
      Alert.alert("حدد جهة اتصال", "حدد جهة اتصال واحدة على الأقل أو أضف جهة جديدة قبل الإرسال.");
      return;
    }
    setActionSheetVisible(false);
    setLoading(true);
    try {
      const file = await createActionFile(format);
      if (channel === "email") {
        const recipients = contacts.map((contact) => contact.email).filter((email): email is string => Boolean(email));
        if (!recipients.length) throw new Error("الجهات المحددة لا تحتوي عناوين بريد إلكتروني.");
        if (!(await MailComposer.isAvailableAsync())) throw new Error("البريد الإلكتروني غير متاح على هذا الجهاز.");
        await MailComposer.composeAsync({ recipients, subject: `${config.title} — ${formatDateArabic(fromDate || new Date().toISOString())}`, body: template, attachments: [file.uri] });
        Alert.alert("تم تجهيز البريد", `تم فتح رسالة بريد إلى ${recipients.length} مستلم. اضغط إرسال من تطبيق البريد.`);
      } else {
        await shareOrDownloadFile(file.uri, file.mimeType);
        const phones = contacts.map((contact) => contact.whatsapp).filter(Boolean).join("، ");
        Alert.alert("تم تجهيز مشاركة WhatsApp", phones ? `اختر WhatsApp من نافذة المشاركة. الأرقام المحددة: ${phones}` : "اختر WhatsApp من نافذة المشاركة، ثم حدد جهة الإرسال.");
      }
    } catch (error) {
      Alert.alert("تعذر الإرسال", error instanceof Error ? error.message : "تعذر تجهيز التقرير للإرسال.");
    } finally {
      setLoading(false);
    }
  };

  const analysisMonthlyVisits = useMemo(() => {
    if (variant !== "daily-analysis") return [];
    const anchor = new Date(`${fromDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return [];
    const normalized = search.trim().toLowerCase();
    return reportVisits.filter((visit) => {
      const date = new Date(visit.recordedAt);
      if (Number.isNaN(date.getTime()) || date.getFullYear() !== anchor.getFullYear() || date.getMonth() !== anchor.getMonth()) return false;
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region);
    });
  }, [data.entities, fromDate, region, reportVisits, representativeId, search, variant]);

  const analysisScopedVisits = useMemo(() => {
    if (variant !== "daily-analysis") return [];
    const normalized = search.trim().toLowerCase();
    return reportVisits.filter((visit) => {
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      const text = [visit.entityName, visit.entityAddress, visit.geographicLocation, visit.nearestPharmacy, visit.specialty, visit.category, visit.notes, ...(visit.visitedItems || [])].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || text.includes(normalized)) && (representativeId === "all" || visit.representativeId === representativeId) && (region === "all" || entity?.region === region);
    });
  }, [data.entities, region, reportVisits, representativeId, search, variant]);

  const rows = useMemo<ReportRow[]>(() => {
    if (variant === "monthly-representative" || variant === "representatives-total") return data.representatives.map((rep) => { const visits = filteredVisits.filter((visit) => visit.representativeId === rep.id); return { id: rep.id, first: rep.name, second: String(visits.length), third: String(new Set(visits.map((visit) => dateText(visit.recordedAt))).size), fourth: visits.length ? dateText(visits.reduce((latest, visit) => latest.recordedAt > visit.recordedAt ? latest : visit).recordedAt) : "—" }; });
      if (variant === "daily") return filteredVisits.map((visit) => ({
      id: visit.id,
      first: visit.entityName,
      second: visit.category || "—",
      third: visit.specialty || "—",
      fourth: visitShiftText(visit.recordedAt),
      fifth: visit.notes || "—",
      sixth: visitLocationText(visit),
      seventh: visit.visitedItems?.join("، ") || "—",
    }));
    if (variant === "search") return buildComprehensiveDailyTableRows(filteredVisits.map((visit) => {
      const entity = data.entities.find((candidate) => candidate.id === visit.entityId);
      return {
        id: visit.id,
        visitDate: dateText(visit.recordedAt),
        doctor: visit.entityName,
        specialty: visit.specialty || entity?.specialty || "—",
        shift: visitShiftText(visit.recordedAt),
        address: visit.entityAddress || entity?.address || visit.geographicLocation || "—",
        prescribedItems: visit.visitedItems?.join("، ") || "—",
        representative: data.representatives.find((rep) => rep.id === visit.representativeId)?.name || "غير محدد",
        region: entity?.region === "south" ? "الجنوبية" : entity?.region === "north" ? "الشمالية" : entity?.region === "central" ? "الوسطى" : "غير محددة",
      };
    })).map((row) => ({ id: row.id, first: row.visitDate, second: row.doctor, third: row.specialty, fourth: row.shift, fifth: row.address, sixth: row.prescribedItems, seventh: row.representative, eighth: row.region }));
    return filteredVisits.map((visit) => ({ id: visit.id, first: visit.entityName, second: data.representatives.find((rep) => rep.id === visit.representativeId)?.name || "غير محدد", third: dateText(visit.recordedAt), fourth: visit.visitedItems?.join("، ") || "—", fifth: visit.entityAddress || visit.geographicLocation || "—" }));
  }, [data.entities, data.representatives, filteredVisits, variant]);
  const sortedRows = useMemo(() => [...rows].sort((left, right) => { const result = compareValues(String(left[sortKey] ?? ""), String(right[sortKey] ?? "")); return sortDirection === "asc" ? result : -result; }), [rows, sortDirection, sortKey]);
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("asc"); } };
  const headers = variant === "daily" ? DAILY_HEADERS : variant === "search" ? COMPREHENSIVE_DAILY_HEADERS : ["monthly-representative", "representatives-total"].includes(variant) ? SUMMARY_HEADERS : DETAIL_HEADERS;
  const sortLabel = sortDirection === "asc" ? "تصاعدي" : "تنازلي";
  const previousReport = REPORT_ROUTES[(reportIndex - 1 + REPORT_ROUTES.length) % REPORT_ROUTES.length];
  const nextReport = REPORT_ROUTES[(reportIndex + 1) % REPORT_ROUTES.length];

  if (session?.role !== "manager") return <ScreenContainer className="px-5"><View className="flex-1 items-center justify-center"><MaterialIcons name="lock" size={42} color="#B42318" /><Text className="text-xl font-bold text-foreground text-center mt-4">هذا التقرير متاح لمدير النظام فقط</Text><Pressable onPress={goBackToPreviousScreen} className="h-12 rounded-xl bg-primary px-6 items-center justify-center mt-5"><Text className="text-white font-bold">رجوع</Text></Pressable></View></ScreenContainer>;

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"><ScreenHeader title={config.title} subtitle={config.subtitle} icon={config.icon} /><View {...reportPanResponder.panHandlers} style={{ minHeight: 54, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: "#D8E0EA", backgroundColor: "#F5F8FC", paddingHorizontal: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}><Pressable onPress={() => goToReport(-1)} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }, pressed && { backgroundColor: "#EAF3FB" }]}><MaterialIcons name="chevron-right" size={22} color="#1257A6" /></Pressable><View style={{ flex: 1, alignItems: "center" }}><Text style={{ color: "#7C8798", fontSize: 10, fontWeight: "700" }}>اسحب للتنقل بين التقارير</Text><Text style={{ color: "#102A43", fontSize: 13, fontWeight: "700", marginTop: 2 }}>{config.title}</Text></View><Pressable onPress={() => goToReport(1)} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }, pressed && { backgroundColor: "#EAF3FB" }]}><MaterialIcons name="chevron-left" size={22} color="#1257A6" /></Pressable><Text style={{ position: "absolute", right: 8, top: 3, color: "#94A3B8", fontSize: 9 }}>{CONFIG[previousReport.variant].title}</Text><Text style={{ position: "absolute", left: 8, top: 3, color: "#94A3B8", fontSize: 9 }}>{CONFIG[nextReport.variant].title}</Text></View><UnifiedDatePicker visible={datePickerTarget === "from"} value={fromDate} title="اختر تاريخ البداية" onClose={() => setDatePickerTarget(null)} onSelect={(value) => { triggerFilter(setFromDate, value); setDatePickerTarget(null); }} /><UnifiedDatePicker visible={datePickerTarget === "to"} value={toDate} title="اختر تاريخ النهاية" onClose={() => setDatePickerTarget(null)} onSelect={(value) => { triggerFilter(setToDate, value); setDatePickerTarget(null); }} /><View className="rounded-2xl bg-surface border border-border p-4 mb-4 gap-3"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="filter-alt" size={20} color="#1257A6" /><Text className="flex-1 text-right font-bold text-foreground">الفلاتر والبحث</Text></View>{variant === "monthly-representative" ? <View className="rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><View className="flex-row-reverse gap-2"><View className="flex-1"><SelectField title="السنة الأساسية" value={String(reportYear)} options={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} onChange={(value) => triggerFilter(setReportYear, Number(value))} /></View><View className="flex-1"><SelectField title="عام المقارنة" value={String(comparisonYear)} options={Array.from({ length: 7 }, (_, index) => { const year = new Date().getFullYear() - 3 + index; return { value: String(year), label: String(year) }; })} onChange={(value) => triggerFilter(setComparisonYear, Number(value))} /></View></View></View> : null}<TextInput value={search} onChangeText={(value) => triggerFilter(setSearch, value)} placeholder="بحث باسم الطبيب أو العنوان أو الصنف" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-background px-4 text-foreground" />{variant === "monthly-representative" ? null : isSingleDateReport(variant) ? <Pressable onPress={() => setDatePickerTarget("from")} className="h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${fromDate ? "text-foreground" : "text-muted"}`}>{fromDate || "تاريخ التقرير"}</Text></Pressable> : <View className="flex-row-reverse gap-2"><Pressable onPress={() => setDatePickerTarget("from")} className="flex-1 h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${fromDate ? "text-foreground" : "text-muted"}`}>{fromDate || "من تاريخ"}</Text></Pressable><Pressable onPress={() => setDatePickerTarget("to")} className="flex-1 h-11 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="calendar-month" size={18} color="#1257A6" /><Text className={`text-right text-xs ${toDate ? "text-foreground" : "text-muted"}`}>{toDate || "إلى تاريخ"}</Text></Pressable></View>}<View className="flex-row-reverse gap-3"><View className="flex-1 rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><SelectField title="المنطقة" value={region} options={REGION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => triggerFilter(setRegion, value as typeof region)} /></View><View className="flex-1 rounded-2xl border-2 border-[#B7CDE5] bg-[#F8FBFF] p-2"><SelectField title="المندوب" value={representativeId} options={representativeOptions} onChange={(value) => triggerFilter(setRepresentativeId, value)} /></View></View></View><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => showLoading(650)} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#102A43", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="refresh" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">تحديث</Text></Pressable><Pressable onPress={() => setActionSheetVisible(true)} disabled={loading} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#16835B", opacity: loading ? 0.7 : 1 }}><MaterialIcons name="pending-actions" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">إجراءات</Text></Pressable><Pressable onPress={() => { void handlePrint(); }} disabled={loading || variant !== "daily"} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#1257A6", opacity: loading || variant !== "daily" ? 0.65 : 1 }}><MaterialIcons name="print" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-xs">طباعة</Text></Pressable></View>{loading ? <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-4 gap-3"><View className="flex-row-reverse items-center justify-center gap-3"><ActivityIndicator size="small" color="#1257A6" /><Text className="text-primary font-bold text-sm">{reportProgressMessage || "جاري جلب بيانات التقرير، يرجى الانتظار..."}</Text></View><View style={{ height: 8, borderRadius: 8, backgroundColor: "#D8EAF7", overflow: "hidden" }}><Animated.View style={{ height: 8, width: reportProgressMessage ? `${Math.max(6, Math.round(reportProgress * 100))}%` : progress.interpolate({ inputRange: [0, 1], outputRange: ["18%", "100%"] }), borderRadius: 8, backgroundColor: "#1257A6" }} /></View>{reportProgressMessage ? <Text className="text-[10px] text-primary text-center">{Math.round(reportProgress * 100)}%</Text> : null}</View> : null}{variant === "calendar" ? <CalendarReport visits={filteredVisits.map((visit) => ({ recordedAt: visit.recordedAt, entityName: visit.entityName, representativeId: visit.representativeId }))} leaves={data.representativeLeaves ?? []} holidays={data.officialHolidays ?? []} representatives={data.representatives} /> : variant === "daily-analysis" ? <><DailyAnalysisTable visits={filteredVisits} monthlyVisits={analysisMonthlyVisits} representatives={data.representatives} /><DailyDetailTable dailyVisits={filteredVisits} scopedVisits={analysisScopedVisits} monthlyPlans={data.plannedVisits} representatives={data.representatives} reportDate={fromDate} /></> : variant === "monthly-representative" ? <MonthlyRepresentativeTable visits={filteredVisits} entities={data.entities} year={monthlyReportYear} comparisonYear={comparisonYear} /> : variant === "representatives-total" ? <RepresentativesTotalTable visits={filteredVisits} representatives={data.representatives} /> : variant === "search" ? <ComprehensiveSearchTable visits={filteredVisits} entities={data.entities} /> : <><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: REPORT_TABLE_MIN_WIDTH }}><View style={{ minWidth: REPORT_TABLE_MIN_WIDTH }}><View className="rounded-2xl border border-border overflow-hidden bg-surface"><View className="px-3 py-2 bg-primary/5 border-b border-border"><Text className="text-xs text-primary font-bold text-right">اضغط على عنوان أي عمود للترتيب {sortLabel}: {headers.find((header) => header.key === sortKey)?.label}</Text></View><ScrollView style={{ maxHeight: 560 }} nestedScrollEnabled showsVerticalScrollIndicator stickyHeaderIndices={[0]}><View className="flex-row-reverse bg-[#BFE8D6] border-b border-border">{headers.map((header) => <Pressable key={header.key} onPress={() => toggleSort(header.key)} style={{ flex: header.width ? undefined : 1, width: header.width, flexShrink: header.width ? 0 : 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 4 }}><Text className="text-right text-primary font-bold text-xs" numberOfLines={2}>{header.label}</Text><MaterialIcons name={sortKey === header.key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={15} color={sortKey === header.key ? "#1257A6" : "#7C8798"} /></Pressable>)}</View>{sortedRows.length ? sortedRows.map((row, index) => <View key={row.id} className={`flex-row-reverse border-b border-border ${index % 2 ? "bg-background" : "bg-surface"}`}>{headers.map((header) => <ReportTableCell key={header.key} row={row} header={header} onLocationPress={(location) => { const coordinates = extractCoordinates(location); if (!coordinates) { Alert.alert("الموقع غير متاح", "لا توجد إحداثيات محفوظة لهذه الجهة لعرضها على الخريطة."); return; } setMapLocation({ label: location, coordinates }); }} />)}</View>) : <View className="p-8 items-center"><MaterialIcons name="inbox" size={32} color="#7C8798" /><Text className="text-muted font-bold mt-2">لا توجد بيانات ضمن الفلاتر الحالية</Text></View>}</ScrollView></View>{variant === "daily" ? <DailyTotalsRow rows={rows} /> : null}</View></ScrollView></>}<Text className="text-[11px] text-muted text-right mt-3">اسحب أفقياً لرؤية جميع أعمدة التقرير. تُعرض البيانات الفعلية المخزنة في التطبيق، ويمكن استخدام البحث والفلاتر والترتيب قبل الطباعة أو التصدير.</Text></ScrollView><ReportActionSheet visible={actionSheetVisible} title={config.title} onClose={() => setActionSheetVisible(false)} onExport={handleActionExport} onSend={(channel, format, contacts, template) => { void handleActionSend(channel, format, contacts, template); }} /><MiniMapModal visible={Boolean(mapLocation)} label={mapLocation?.label ?? ""} coordinates={mapLocation?.coordinates ?? null} onClose={() => setMapLocation(null)} onOpenExternal={() => { if (!mapLocation) return; const url = buildGoogleMapsUrl(mapLocation.label); if (!url) { Alert.alert("الموقع غير متاح", "لا توجد إحداثيات صالحة لفتحها خارجياً."); return; } void Linking.openURL(url).catch(() => Alert.alert("تعذر فتح Google Maps", "تحقق من اتصال الإنترنت أو وجود متصفح على الجهاز.")); }} /></ScreenContainer>;
}


function RepresentativesTotalTable({ visits, representatives }: { visits: Visit[]; representatives: Representative[] }) {
  const [doctorSearch, setDoctorSearch] = useState("");
  const [sortKey, setSortKey] = useState<"representative" | "total" | "morning" | "evening" | "percentage" | "doctors">("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [reportMode, setReportMode] = useState("total");
  const modeOptions = [
    { value: "total", label: "إجمالي" },
    { value: "analysis", label: "تحليلي" },
    { value: "planned", label: "مخطط" },
    { value: "daily", label: "يومي" },
    { value: "monthly", label: "شهري" },
  ];
  const rows = useMemo(() => buildRepresentativeSummaryRows(representatives.map((representative) => ({ id: representative.id, name: representative.name, visits: visits.filter((visit) => visit.representativeId === representative.id).map((visit) => ({ recordedAt: visit.recordedAt, entityId: visit.entityId, entityName: visit.entityName })) }))), [representatives, visits]);
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const sortedRows = useMemo(() => {
    const normalized = doctorSearch.trim().toLocaleLowerCase("ar");
    return rows.filter((row) => !normalized || row.representative.toLocaleLowerCase("ar").includes(normalized)).sort((left, right) => {
      const leftValue = sortKey === "percentage" ? (grandTotal ? left.total / grandTotal : 0) : left[sortKey];
      const rightValue = sortKey === "percentage" ? (grandTotal ? right.total / grandTotal : 0) : right[sortKey];
      const result = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue), "ar", { sensitivity: "base", numeric: true });
      return sortDirection === "asc" ? result : -result;
    });
  }, [doctorSearch, grandTotal, rows, sortDirection, sortKey]);
  const totals = useMemo(() => ({ total: rows.reduce((sum, row) => sum + row.total, 0), morning: rows.reduce((sum, row) => sum + row.morning, 0), evening: rows.reduce((sum, row) => sum + row.evening, 0), doctors: new Set(visits.map((visit) => visit.entityId || visit.entityName)).size }), [rows, visits]);
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection(key === "representative" ? "asc" : "desc"); }
  };
  const header = (key: typeof sortKey, label: string, width: number) => <Pressable onPress={() => toggleSort(key)} style={({ pressed }) => [{ width, minHeight: 54, paddingHorizontal: 8, paddingVertical: 10, borderLeftWidth: 1, borderColor: "#536273", flexShrink: 0, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4 }, pressed && { backgroundColor: "#A8DCC4" }]}><Text style={{ color: "#1257A6", fontSize: 12, fontWeight: "800", textAlign: "center" }} numberOfLines={2}>{label}</Text><MaterialIcons name={sortKey === key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={14} color="#1257A6" /></Pressable>;
  return <View className="rounded-2xl border-2 border-[#22313F] overflow-hidden bg-surface"><View className="px-3 py-3 bg-primary/5 border-b border-border"><View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 }}><View style={{ flex: 1 }}><Text className="text-sm text-primary font-bold text-right">للمندوبين متنوع</Text><Text className="text-[11px] text-muted text-right mt-1">النمط الحالي: {modeOptions.find((option) => option.value === reportMode)?.label}</Text></View><View style={{ width: 150 }}><SelectField title="نوع العرض" value={reportMode} options={modeOptions} onChange={setReportMode} /></View></View><View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 10 }}><MaterialIcons name="search" size={18} color="#1257A6" /><TextInput value={doctorSearch} onChangeText={setDoctorSearch} placeholder="بحث باسم المندوب" placeholderTextColor="#7C8798" textAlign="right" returnKeyType="search" style={{ flex: 1, minHeight: 42, borderWidth: 1, borderColor: "#B7CDE5", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 12, color: "#102A43", fontSize: 12 }} accessibilityLabel="البحث باسم المندوب" /></View></View><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: 900 }}><View style={{ minWidth: 900 }}><ScrollView style={{ maxHeight: 560 }} nestedScrollEnabled showsVerticalScrollIndicator stickyHeaderIndices={[0]}><View style={{ flexDirection: "row-reverse", backgroundColor: "#BFE8D6" }}>{header("representative", "المندوب", 210)}{header("total", "عدد الزيارات", 160)}{header("morning", "صباح", 130)}{header("evening", "مساء", 130)}{header("percentage", "النسبة %", 140)}{header("doctors", "عدد الأطباء", 150)}</View>{sortedRows.length ? sortedRows.map((row, index) => <View key={row.id} style={{ flexDirection: "row-reverse", backgroundColor: index % 2 ? "#FFFFFF" : "#F8FBFF" }}><Text style={{ width: 210, minHeight: 52, paddingHorizontal: 8, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#102A43", fontSize: 12, fontWeight: "700", textAlign: "right" }}>{row.representative}</Text><Text style={{ width: 160, minHeight: 52, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#1257A6", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{row.total}</Text><Text style={{ width: 130, minHeight: 52, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 13, textAlign: "center" }}>{row.morning}</Text><Text style={{ width: 130, minHeight: 52, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 13, textAlign: "center" }}>{row.evening}</Text><Text style={{ width: 140, minHeight: 52, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#B42318", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{grandTotal ? ((row.total / grandTotal) * 100).toFixed(2) : "0.00"}</Text><Text style={{ width: 150, minHeight: 52, paddingVertical: 15, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#B42318", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{row.doctors}</Text></View>) : <View style={{ minHeight: 90, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#64748B", fontWeight: "700" }}>لا توجد نتائج مطابقة</Text></View>}</ScrollView><View style={{ flexDirection: "row-reverse", backgroundColor: "#DBEAFE", borderTopWidth: 2, borderColor: "#4B78A8" }}><Text style={{ width: 210, minHeight: 56, paddingHorizontal: 8, paddingVertical: 17, color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "right" }}>الإجمالي</Text><Text style={{ width: 160, minHeight: 56, paddingVertical: 17, color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{totals.total}</Text><Text style={{ width: 130, minHeight: 56, paddingVertical: 17, color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{totals.morning}</Text><Text style={{ width: 130, minHeight: 56, paddingVertical: 17, color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{totals.evening}</Text><Text style={{ width: 140, minHeight: 56, paddingVertical: 17, color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{grandTotal ? "100.00" : "0.00"}</Text><Text style={{ width: 150, minHeight: 56, paddingVertical: 17, color: "#123B68", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{totals.doctors}</Text></View></View></ScrollView></View>;
}

function ComprehensiveSearchTable({ visits, entities }: { visits: Visit[]; entities: { id: string; name: string; specialty?: string; address?: string; region?: "north" | "south" | "central" }[] }) {
  const [doctorSearch, setDoctorSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<"all" | "north" | "south" | "sanaa">("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"doctor" | "specialty" | "address" | "count" | "lastVisit" | "days">("count");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const specialtyOptions = useMemo(() => [{ value: "all", label: "كل التخصصات" }, ...Array.from(new Set(entities.map((entity) => entity.specialty?.trim()).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, "ar")).map((value) => ({ value, label: value }))], [entities]);
  const scopedVisits = useMemo(() => visits.filter((visit) => {
    const entity = entityById.get(visit.entityId);
    return (regionFilter === "all" || entity?.region === regionFilter) && (specialtyFilter === "all" || (visit.specialty || entity?.specialty || "") === specialtyFilter);
  }), [entityById, regionFilter, specialtyFilter, visits]);
  const rows = useMemo(() => {
    const normalized = doctorSearch.trim().toLocaleLowerCase("ar");
    const grouped = new Map<string, { id: string; doctor: string; specialty: string; address: string; count: number; lastVisit: string; days: number; region: string }>();
    scopedVisits.forEach((visit) => {
      const entity = entityById.get(visit.entityId);
      const key = visit.entityId || visit.entityName;
      const current = grouped.get(key);
      const visitDate = dateText(visit.recordedAt);
      const next = current ?? { id: key, doctor: visit.entityName, specialty: visit.specialty || entity?.specialty || "—", address: visit.entityAddress || entity?.address || visit.geographicLocation || "—", count: 0, lastVisit: visitDate, days: 0, region: entity?.region === "south" ? "الجنوبية" : entity?.region === "north" ? "الشمالية" : "غير محددة" };
      next.count += 1;
      next.days = new Set(scopedVisits.filter((candidate) => (candidate.entityId || candidate.entityName) === key).map((candidate) => dateText(candidate.recordedAt))).size;
      if (visit.recordedAt > next.lastVisit) next.lastVisit = visitDate;
      grouped.set(key, next);
    });
    return [...grouped.values()].filter((row) => !normalized || row.doctor.toLocaleLowerCase("ar").includes(normalized)).sort((left, right) => {
      const result = sortKey === "count" ? left.count - right.count : sortKey === "days" ? left.days - right.days : sortKey === "lastVisit" ? left.lastVisit.localeCompare(right.lastVisit) : left[sortKey].localeCompare(right[sortKey], "ar", { numeric: true, sensitivity: "base" });
      return sortDirection === "asc" ? result : -result;
    });
  }, [doctorSearch, entityById, scopedVisits, sortDirection, sortKey]);
  const morning = scopedVisits.filter((visit) => visitShiftText(visit.recordedAt) === "صباح").length;
  const evening = scopedVisits.length - morning;
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDirection(key === "count" || key === "days" ? "desc" : "asc"); }
  };
  const header = (key: typeof sortKey, label: string, width: number) => <Pressable onPress={() => toggleSort(key)} style={({ pressed }) => [{ width, minHeight: 54, paddingHorizontal: 8, paddingVertical: 10, borderLeftWidth: 1, borderColor: "#536273", flexShrink: 0, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4 }, pressed && { backgroundColor: "#A8DCC4" }]}><Text style={{ color: "#1257A6", fontSize: 12, fontWeight: "800", textAlign: "center" }} numberOfLines={2}>{label}</Text><MaterialIcons name={sortKey === key ? (sortDirection === "asc" ? "arrow-upward" : "arrow-downward") : "unfold-more"} size={14} color="#1257A6" /></Pressable>;
  return <View className="rounded-2xl border-2 border-[#22313F] overflow-hidden bg-surface"><View className="px-4 py-3 bg-[#F8FBFF] border-b border-border"><Text style={{ color: "#123B68", fontSize: 14, fontWeight: "800", textAlign: "right" }}>ملخص الزيارات حسب الطبيب</Text><Text style={{ color: "#64748B", fontSize: 11, textAlign: "right", marginTop: 3 }}>{rows.length} طبيب — اضغط على عنوان العمود للفرز</Text><View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10, flexWrap: "wrap" }}><TextInput value={doctorSearch} onChangeText={setDoctorSearch} placeholder="بحث باسم الطبيب حسب الحروف" placeholderTextColor="#7C8798" textAlign="right" returnKeyType="search" style={{ flex: 1, minWidth: 220, minHeight: 44, borderWidth: 1, borderColor: "#B7CDE5", borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 12, color: "#102A43" }} accessibilityLabel="البحث باسم الطبيب" /><View style={{ flex: 1, minWidth: 170 }}><SelectField title="المنطقة" value={regionFilter} options={[...REGION_OPTIONS, { value: "sanaa", label: "صنعاء" }].map((option) => ({ value: option.value, label: option.label }))} onChange={(value) => setRegionFilter(value as typeof regionFilter)} /></View><View style={{ flex: 1, minWidth: 190 }}><SelectField title="التخصص" value={specialtyFilter} options={specialtyOptions} onChange={setSpecialtyFilter} /></View></View></View><HorizontalScrollHint /><ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled contentContainerStyle={{ minWidth: 970 }}><View style={{ minWidth: 970 }}><ScrollView style={{ maxHeight: 560 }} nestedScrollEnabled showsVerticalScrollIndicator stickyHeaderIndices={[0]}><View style={{ flexDirection: "row-reverse", backgroundColor: "#BFE8D6" }}>{header("doctor", "الطبيب", 180)}{header("specialty", "التخصص", 150)}{header("address", "العنوان", 330)}{header("count", "عدد الزيارات", 150)}{header("lastVisit", "آخر زيارة", 140)}{header("days", "عدد الأيام", 130)}</View>{rows.length ? rows.map((row, index) => <View key={row.id} style={{ flexDirection: "row-reverse", backgroundColor: index % 2 ? "#FFFFFF" : "#F8FBFF" }}><Text style={{ width: 180, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#102A43", fontSize: 12, fontWeight: "700", textAlign: "right" }} numberOfLines={2}>{row.doctor}</Text><Text style={{ width: 150, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 12, textAlign: "right" }} numberOfLines={2}>{row.specialty}</Text><Text style={{ width: 330, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 12, textAlign: "right" }} numberOfLines={2}>{row.address}</Text><Text style={{ width: 150, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#1257A6", fontSize: 13, fontWeight: "800", textAlign: "center" }}>{row.count}</Text><Text style={{ width: 140, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 12, textAlign: "center" }}>{row.lastVisit}</Text><Text style={{ width: 130, flexShrink: 0, minHeight: 50, paddingHorizontal: 8, paddingVertical: 14, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: "#B8C5D1", color: "#172B4D", fontSize: 13, fontWeight: "700", textAlign: "center" }}>{row.days}</Text></View>) : <View style={{ minHeight: 90, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#64748B", fontWeight: "700" }}>لا توجد نتائج مطابقة للفلاتر الحالية</Text></View>}</ScrollView><View style={{ flexDirection: "row-reverse", backgroundColor: "#DBEAFE", borderTopWidth: 2, borderColor: "#4B78A8" }}><Text style={{ width: 510, minHeight: 54, paddingHorizontal: 8, paddingVertical: 16, color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "right" }}>إجمالي الزيارات — {rows.length} طبيب</Text><Text style={{ width: 150, minHeight: 54, paddingHorizontal: 8, paddingVertical: 16, color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "center" }}>صباح: {morning}</Text><Text style={{ width: 150, minHeight: 54, paddingHorizontal: 8, paddingVertical: 16, color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "center" }}>مساء: {evening}</Text><Text style={{ width: 140, minHeight: 54, paddingHorizontal: 8, paddingVertical: 16, color: "#123B68", fontSize: 12, fontWeight: "800", textAlign: "center" }}>الكل: {scopedVisits.length}</Text></View></View></ScrollView></View>;
}
