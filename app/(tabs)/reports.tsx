import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import * as XLSX from "xlsx";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { MetricCard } from "@/components/metric-card";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { NativeDateTimePicker } from "@/components/native-date-time-picker";
import {
  buildReportHtml,
  formatVisitTime,
  getPeriodVisits,
  ReportPeriod,
  reportTitle,
  sortVisitsByRecordedAt,
} from "@/lib/reporting";
import { localDateKey } from "@/lib/visit-utils";

const REPORT_FILTERS_KEY = "medical-visit-manager:report-filters";
const pad2 = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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
  const [calendarTarget, setCalendarTarget] = useState<
    "day" | "from" | "to" | null
  >(null);
  const [dailyDate, setDailyDate] = useState("");
  const [representativeMenuVisible, setRepresentativeMenuVisible] =
    useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [downloadMenuVisible, setDownloadMenuVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(data.settings.reportEmail || "");
  const [emailFrequency, setEmailFrequency] = useState<"manual" | "daily" | "weekly" | "monthly">("manual");
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [dailyPrintPreviewVisible, setDailyPrintPreviewVisible] =
    useState(false);
  const [dailyPrintLoading, setDailyPrintLoading] = useState(false);
  const reportScrollRef = useRef<ScrollView>(null);
  const [editVisit, setEditVisit] = useState<
    (typeof data.visits)[number] | null
  >(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEntityName, setEditEntityName] = useState("");
  const [editProducts, setEditProducts] = useState("");
  const [editGeographicLocation, setEditGeographicLocation] = useState("");
  const [editLatitude, setEditLatitude] = useState("");
  const [editLongitude, setEditLongitude] = useState("");
  const [editAccuracy, setEditAccuracy] = useState("");
  const basePeriodVisits = useMemo(() => {
    if (period === "daily" && dailyDate) {
      const selectedDay = dailyDate.trim();
      return data.visits.filter((visit) => {
        const parsed = new Date(visit.recordedAt);
        const localMatch =
          !Number.isNaN(parsed.getTime()) &&
          localDateKey(parsed) === selectedDay;
        const rawMatch =
          typeof visit.recordedAt === "string" &&
          visit.recordedAt.startsWith(selectedDay);
        return localMatch || rawMatch;
      });
    }
    return getPeriodVisits(data.visits, period);
  }, [data.visits, period, dailyDate]);
  const currentVisits = useMemo(
    () =>
      sortVisitsByRecordedAt(
        basePeriodVisits.filter((visit) => {
          const parsed = new Date(visit.recordedAt);
          const day = !Number.isNaN(parsed.getTime())
            ? localDateKey(parsed)
            : visit.recordedAt.slice(0, 10);
          const inRange =
            period !== "monthly" ||
            ((!fromDate || day >= fromDate) && (!toDate || day <= toDate));
          const byRep =
            representativeFilter === "all" ||
            visit.representativeId === representativeFilter;
          return inRange && byRep;
        }),
      ),
    [basePeriodVisits, fromDate, toDate, representativeFilter, period],
  );
  const selectedRepName =
    data.representatives.find((item) => item.id === representativeFilter)
      ?.name ?? "كل المندوبين";
  const title =
    period === "daily" && dailyDate
      ? `تقرير الزيارات اليومي — ${dailyDate}`
      : period === "monthly" && (fromDate || toDate)
        ? `تقرير شهري من ${fromDate || "البداية"} إلى ${toDate || "النهاية"}`
        : reportTitle(period);
  useEffect(() => {
    if (routePeriod === "daily" || routePeriod === "monthly")
      setPeriod(routePeriod);
  }, [routePeriod]);
  useEffect(() => {
    void AsyncStorage.multiGet([REPORT_FILTERS_KEY, "medical-visit-manager:report-email-settings"]).then((entries) => {
      const raw = entries[0]?.[1];
      const emailSettings = entries[1]?.[1];
      if (emailSettings) {
        try {
          const parsed = JSON.parse(emailSettings) as { recipient?: string; frequency?: "manual" | "daily" | "weekly" | "monthly" };
          setEmailRecipient(parsed.recipient || data.settings.reportEmail || "");
          setEmailFrequency(parsed.frequency || "manual");
        } catch {
          setEmailRecipient(data.settings.reportEmail || "");
        }
      } else {
        setEmailRecipient(data.settings.reportEmail || "");
      }
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as {
          representativeFilter?: string;
          fromDate?: string;
          toDate?: string;
          dailyDate?: string;
        };
        setRepresentativeFilter(saved.representativeFilter ?? "all");
        setFromDate(saved.fromDate ?? "");
        setToDate(saved.toDate ?? "");
        setDailyDate(saved.dailyDate ?? "");
      } catch {
        /* ignore malformed preferences */
      }
    });
  }, [data.settings.reportEmail]);
  useEffect(() => {
    void AsyncStorage.setItem(
      REPORT_FILTERS_KEY,
      JSON.stringify({ representativeFilter, fromDate, toDate, dailyDate }),
    );
  }, [representativeFilter, fromDate, toDate, dailyDate]);
  const logoUri = Asset.fromModule(require("../../assets/images/icon.png")).uri;
  const html = useMemo(
    () =>
      buildReportHtml({
        visits: currentVisits,
        representatives: data.representatives,
        title,
        managerName: data.settings.managerName,
        logoUri,
        appName: "مدير الزيارات الطبية",
        printedAt: new Date().toISOString(),
      }),
    [
      currentVisits,
      data.representatives,
      data.settings.managerName,
      title,
      logoUri,
      period,
    ],
  );
  const byRepresentative = data.representatives.map((representative) => ({
    representative,
    count: currentVisits.filter(
      (visit) => visit.representativeId === representative.id,
    ).length,
  }));
  const acceptedVisits = currentVisits.filter(
    (visit) =>
      visit.verificationStatus === "verified" ||
      visit.verificationStatus === "override",
  ).length;
  const rejectedVisits = currentVisits.filter(
    (visit) => visit.verificationStatus === "rejected",
  ).length;
  const statusSummary = () => (
    <View className="flex-row-reverse gap-2 mb-3">
      <View className="flex-1 rounded-xl bg-success/10 border border-success/25 px-3 py-2 flex-row-reverse items-center justify-between">
        <Text className="text-xs font-bold text-success">مقبولة</Text>
        <Text className="text-lg font-bold text-success">{acceptedVisits}</Text>
      </View>
      <View className="flex-1 rounded-xl bg-error/10 border border-error/25 px-3 py-2 flex-row-reverse items-center justify-between">
        <Text className="text-xs font-bold text-error">مرفوضة</Text>
        <Text className="text-lg font-bold text-error">{rejectedVisits}</Text>
      </View>
    </View>
  );
  useEffect(() => {
    if (period !== "monthly") {
      setMonthlyLoading(false);
      return;
    }
    setMonthlyLoading(true);
    const timer = setTimeout(() => setMonthlyLoading(false), 450);
    return () => clearTimeout(timer);
  }, [period, fromDate, toDate, representativeFilter, data.visits.length]);
  useEffect(() => {
    if (period !== "daily" || !dailyDate) {
      setDailyPrintPreviewVisible(false);
      setDailyPrintLoading(false);
      return;
    }
    setDailyPrintPreviewVisible(true);
    setDailyPrintLoading(true);
    const timer = setTimeout(() => setDailyPrintLoading(false), 450);
    return () => clearTimeout(timer);
  }, [period, dailyDate, representativeFilter, data.visits.length]);

  if (session?.role !== "manager") {
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <View className="flex-1 items-center justify-center">
          <MaterialIcons name="lock" size={42} color="#B42318" />
          <Text className="text-xl font-bold text-foreground text-center mt-4">
            التقارير متاحة لمدير النظام فقط
          </Text>
          <Text className="text-sm text-muted text-center mt-2 leading-5">
            لا يملك حساب المندوب صلاحية عرض التقارير أو فلاترها.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const saveEmailSettings = async () => {
    const recipient = emailRecipient.trim();
    if (recipient && !/^\S+@\S+\.\S+$/.test(recipient)) {
      Alert.alert("بريد غير صالح", "أدخل عنوان بريد إلكتروني صحيحاً.");
      return false;
    }
    await AsyncStorage.setItem("medical-visit-manager:report-email-settings", JSON.stringify({ recipient, frequency: emailFrequency }));
    setEmailModalVisible(false);
    Alert.alert("تم الحفظ", emailFrequency === "manual" ? "سيتم استخدام العنوان عند الضغط على إرسال البريد." : "تم حفظ الدورية المطلوبة. الإرسال التلقائي يحتاج خدمة بريد مجدولة مرتبطة بالتطبيق.");
    return true;
  };

  const run = async (action: "print" | "share" | "email" | "excel" | "pdf") => {
    setIsWorking(true);
    try {
      if (action === "excel") {
        const rows = currentVisits.map((visit, index) => ({
          "#": index + 1,
          "وقت الزيارة": formatVisitTime(visit.recordedAt),
          "اسم الطبيب": visit.entityName,
          "نوع الجهة": visit.entityKind,
          التخصص: visit.specialty || "",
          الفئة: visit.category || "",
          "الأصناف المزارة": visit.visitedItems?.join("، ") || "",
          "أقرب صيدلية": visit.nearestPharmacy || "",
          "الموقع الجغرافي": visit.geographicLocation || "",
          المندوب:
            data.representatives.find(
              (item) => item.id === visit.representativeId,
            )?.name || "غير محدد",
          الوقت: visit.recordedAt,
          GPS: visit.location ? "موثّق" : "غير متوفر",
          ملاحظات: visit.notes || "",
        }));
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, "الزيارات");
        const base64 = XLSX.write(workbook, {
          type: "base64",
          bookType: "xlsx",
        });
        const uri = `${FileSystem.cacheDirectory}تقرير-الزيارات-${Date.now()}.xlsx`;
        await FileSystem.writeAsStringAsync(uri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(
            "المشاركة غير متاحة",
            "تعذر فتح قائمة المشاركة على هذا الجهاز.",
          );
          return;
        }
        await Sharing.shareAsync(uri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "مشاركة تقرير الزيارات Excel",
        });
        return;
      }
      if (action === "print") {
        await Print.printAsync({
          html,
          orientation: Print.Orientation.landscape,
        });
        return;
      }
      const pdf = await Print.printToFileAsync({ html });
      if (action === "share" || action === "pdf") {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert(
            "المشاركة غير متاحة",
            "تعذر فتح قائمة المشاركة على هذا الجهاز.",
          );
          return;
        }
        await Sharing.shareAsync(pdf.uri, {
          mimeType: "application/pdf",
          UTI: ".pdf",
          dialogTitle: action === "pdf" ? "تحميل تقرير الزيارات PDF" : "مشاركة تقرير الزيارات",
        });
        return;
      }
      if (!(await MailComposer.isAvailableAsync())) {
        Alert.alert(
          "البريد غير متاح",
          "يرجى إعداد تطبيق بريد على الهاتف ثم أعد المحاولة.",
        );
        return;
      }
      await MailComposer.composeAsync({
        recipients: emailRecipient.trim() ? [emailRecipient.trim()] : data.settings.reportEmail ? [data.settings.reportEmail] : [],
        subject: title,
        body: `مرفق ${title}.`,
        attachments: [pdf.uri],
      });
    } catch {
      Alert.alert(
        "تعذر تجهيز التقرير",
        "حدثت مشكلة أثناء إنشاء ملف PDF. أعد المحاولة لاحقاً.",
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleDailyPrint = async () => {
    if (isWorking || dailyPrintLoading) return;
    setDailyPrintLoading(true);
    setDailyPrintPreviewVisible(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    reportScrollRef.current?.scrollToEnd({ animated: true });
    await new Promise((resolve) => setTimeout(resolve, 450));
    setDailyPrintLoading(false);
    await run("print");
  };

  const saveVisitEdit = () => {
    if (!editVisit) return;
    const products = editProducts
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const latitude = Number(editLatitude);
    const longitude = Number(editLongitude);
    const accuracyNumber = Number(editAccuracy);
    const nextLocation =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? {
            latitude,
            longitude,
            accuracy: Number.isFinite(accuracyNumber) ? accuracyNumber : null,
          }
        : editVisit.location;
    const changedFields = [
      editEntityName.trim() !== editVisit.entityName ? "اسم الطبيب" : null,
      products.join("،") !== (editVisit.visitedItems || []).join("،")
        ? "الأصناف المزارة"
        : null,
      editGeographicLocation.trim() !== (editVisit.geographicLocation || "")
        ? "الموقع الجغرافي"
        : null,
      JSON.stringify(nextLocation) !== JSON.stringify(editVisit.location)
        ? "الإحداثيات"
        : null,
      editNotes.trim() !== editVisit.notes ? "الملاحظات" : null,
    ].filter((item): item is string => Boolean(item));
    if (!changedFields.length) {
      setEditVisit(null);
      return;
    }
    const actedAt = new Date().toISOString();
    updateVisit({
      ...editVisit,
      entityName: editEntityName.trim() || editVisit.entityName,
      visitedItems: products,
      geographicLocation: editGeographicLocation.trim(),
      location: nextLocation,
      geographicCoordinates: nextLocation ?? editVisit.geographicCoordinates,
      notes: editNotes.trim(),
      auditLog: [
        {
          id: `visit-audit-${Date.now()}`,
          action: "updated",
          actedAt,
          actedBy: data.settings.managerName || "مدير النظام",
          actedByRole: "manager",
          changedFields,
        },
        ...(editVisit.auditLog || []),
      ],
    });
    setEditVisit(null);
    Alert.alert(
      "تم التعديل",
      `تم تحديث الزيارة وتسجيل التعديل في سجل التدقيق بتاريخ ${actedAt.slice(0, 16).replace("T", " ")}.`,
    );
  };

  const reportPreview = (expanded = false) => {
    const paperWidth = expanded ? 1040 : 720;
    const paperHeight = Math.round((paperWidth * 210) / 297);
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ minWidth: paperWidth }}
      >
        <View
          className="border border-border rounded-xl overflow-hidden bg-background"
          style={{ width: paperWidth, minHeight: paperHeight }}
        >
        <View className="flex-row-reverse bg-foreground">
          <Text className="w-10 px-2 py-2 text-white text-[10px] font-bold text-center">
            #
          </Text>
          <Text className="w-16 px-2 py-2 text-white text-[10px] font-bold text-center">
            إجراء
          </Text>
          <Text className="w-20 px-2 py-2 text-white text-[10px] font-bold text-center">
            الوقت
          </Text>
          <Text className="w-44 px-2 py-2 text-white text-[10px] font-bold text-right">
            اسم الطبيب
          </Text>
          <Text className="w-36 px-2 py-2 text-white text-[10px] font-bold text-right">
            العنوان
          </Text>
          <Text className="w-32 px-2 py-2 text-white text-[10px] font-bold text-right">
            الأصناف
          </Text>
          <Text className="w-36 px-2 py-2 text-white text-[10px] font-bold text-right">
            الملاحظات
          </Text>
        </View>
        {currentVisits.length ? (
          currentVisits.map((visit, index) => (
            <View
              key={visit.id}
              className={`flex-row-reverse border-t border-border ${index % 2 ? "bg-background" : "bg-surface"}`}
            >
              <View className="w-10 px-2 py-2 items-center justify-center">
                <Text className="text-foreground text-[10px] text-center">
                  {index + 1}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setEditVisit(visit);
                  setEditNotes(visit.notes || "");
                  setEditEntityName(visit.entityName);
                  setEditProducts((visit.visitedItems || []).join(", "));
                  setEditGeographicLocation(visit.geographicLocation || "");
                  setEditLatitude(
                    String(
                      visit.location?.latitude ??
                        visit.geographicCoordinates?.latitude ??
                        "",
                    ),
                  );
                  setEditLongitude(
                    String(
                      visit.location?.longitude ??
                        visit.geographicCoordinates?.longitude ??
                        "",
                    ),
                  );
                  setEditAccuracy(
                    String(
                      visit.location?.accuracy ??
                        visit.geographicCoordinates?.accuracy ??
                        "",
                    ),
                  );
                }}
                className="w-16 px-1 py-1 items-center justify-center"
              >
                <View className="rounded-lg bg-primary px-1.5 py-1">
                  <MaterialIcons name="edit" size={13} color="#FFFFFF" />
                </View>
              </Pressable>
              <Text className="w-20 px-2 py-2 text-primary text-[10px] font-bold text-center">
                {formatVisitTime(visit.recordedAt)}
              </Text>
              <Text
                numberOfLines={1}
                className="w-44 px-2 py-2 text-foreground text-[10px] text-right"
              >
                {visit.entityName}
              </Text>
              <Text
                numberOfLines={1}
                className="w-36 px-2 py-2 text-muted text-[10px] text-right"
              >
                {visit.entityAddress || visit.geographicLocation || "—"}
              </Text>
              <Text
                numberOfLines={1}
                className="w-32 px-2 py-2 text-muted text-[10px] text-right"
              >
                {visit.visitedItems?.join("، ") || "—"}
              </Text>
              <Text
                numberOfLines={1}
                className="w-36 px-2 py-2 text-muted text-[10px] text-right"
              >
                {visit.notes || "—"}
              </Text>
            </View>
          ))
        ) : (
          <Text className="p-5 text-muted text-center text-xs">
            لا توجد زيارات لهذا اليوم.
          </Text>
        )}
        </View>
      </ScrollView>
    );
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView
        ref={reportScrollRef}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="التقارير"
          subtitle="اطبع وشارك تقارير الزيارات"
          icon="assessment"
        />
        {period === "daily" ? (
          <View className="rounded-2xl bg-surface border border-border p-4 mb-5 gap-3">
            <Text className="font-bold text-foreground text-right">
              تخصيص التقرير اليومي
            </Text>
            <Pressable
              onPress={() => setCalendarTarget("day")}
              className="h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"
            >
              <MaterialIcons name="event" size={18} color="#1565C0" />
              <Text
                className={`font-bold text-right ${dailyDate ? "text-foreground" : "text-muted"}`}
              >
                {dailyDate || "اختر يوم التقرير من التقويم"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setRepresentativeMenuVisible(true)}
              className="h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"
            >
              <MaterialIcons
                name="keyboard-arrow-down"
                size={22}
                color="#1565C0"
              />
              <Text className="font-bold text-foreground text-right">
                {selectedRepName}
              </Text>
            </Pressable>
            <View className="flex-row-reverse gap-2">
              <Pressable
                onPress={() => setActionMenuVisible((visible) => !visible)}
                className="flex-1 h-10 rounded-xl border border-border bg-background items-center justify-center flex-row-reverse gap-1"
              >
                <MaterialIcons name="tune" size={16} color="#1257A6" />
                <Text className="text-xs font-bold text-foreground">إجراء</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleDailyPrint()}
                disabled={isWorking || dailyPrintLoading}
                accessibilityRole="button"
                accessibilityLabel="طباعة التقرير اليومي"
                className="flex-1 h-10 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"
              >
                <MaterialIcons name="print" size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">طباعة</Text>
              </Pressable>
              <Pressable
                onPress={() => setPreviewFullscreen(true)}
                className="flex-1 h-10 rounded-xl bg-primary items-center justify-center flex-row-reverse gap-1"
              >
                <MaterialIcons name="preview" size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">معاينة</Text>
              </Pressable>
            </View>
            {actionMenuVisible ? (
              <View className="rounded-xl border border-border bg-background overflow-hidden">
                <Pressable onPress={() => setDownloadMenuVisible((visible) => !visible)} className="h-11 px-3 flex-row-reverse items-center justify-between border-b border-border">
                  <MaterialIcons name="download" size={18} color="#1257A6" />
                  <Text className="text-sm font-bold text-foreground">تحميل التقرير</Text>
                </Pressable>
                {downloadMenuVisible ? (
                  <View className="bg-surface flex-row-reverse gap-2 p-2">
                    <Pressable onPress={() => { setActionMenuVisible(false); setDownloadMenuVisible(false); void run("pdf"); }} className="flex-1 h-10 rounded-lg bg-primary items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="picture-as-pdf" size={16} color="#FFFFFF" /><Text className="text-xs font-bold text-white">PDF</Text></Pressable>
                    <Pressable onPress={() => { setActionMenuVisible(false); setDownloadMenuVisible(false); void run("excel"); }} className="flex-1 h-10 rounded-lg bg-[#217346] items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="table-chart" size={16} color="#FFFFFF" /><Text className="text-xs font-bold text-white">Excel</Text></Pressable>
                  </View>
                ) : null}
                <Pressable onPress={() => { setActionMenuVisible(false); setEmailModalVisible(true); }} className="h-11 px-3 flex-row-reverse items-center justify-between border-b border-border"><MaterialIcons name="email" size={18} color="#16835B" /><Text className="text-sm font-bold text-foreground">إرسال التقرير بالبريد</Text></Pressable>
                <Pressable onPress={() => { setActionMenuVisible(false); setEmailModalVisible(true); }} className="h-11 px-3 flex-row-reverse items-center justify-between"><MaterialIcons name="schedule" size={18} color="#1257A6" /><Text className="text-sm font-bold text-foreground">إعداد المستلم والدورية</Text></Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
        {period === "monthly" ? (
          <View className="rounded-2xl bg-surface border border-border p-4 mb-5 gap-3">
            <Text className="font-bold text-foreground text-right">
              تخصيص التقرير الشهري
            </Text>
            <View className="flex-row-reverse gap-2">
              <Pressable
                onPress={() => setCalendarTarget("from")}
                className="flex-1 h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"
              >
                <MaterialIcons name="event" size={18} color="#1565C0" />
                <Text
                  className={`text-xs font-bold text-right ${fromDate ? "text-foreground" : "text-muted"}`}
                >
                  {fromDate || "من تاريخ"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCalendarTarget("to")}
                className="flex-1 h-12 rounded-xl border border-border bg-background px-3 flex-row-reverse items-center justify-between"
              >
                <MaterialIcons name="event" size={18} color="#1565C0" />
                <Text
                  className={`text-xs font-bold text-right ${toDate ? "text-foreground" : "text-muted"}`}
                >
                  {toDate || "إلى تاريخ"}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row-reverse flex-wrap gap-2">
              <Pressable
                onPress={() => setRepresentativeFilter("all")}
                className={`flex-1 min-w-[30%] h-10 rounded-xl items-center justify-center ${representativeFilter === "all" ? "bg-primary" : "bg-background border border-border"}`}
              >
                <Text
                  className={`text-xs font-bold ${representativeFilter === "all" ? "text-white" : "text-foreground"}`}
                >
                  كل المندوبين
                </Text>
              </Pressable>
              {data.representatives
                .filter((item) => item.active)
                .map((rep) => (
                  <Pressable
                    key={rep.id}
                    onPress={() => setRepresentativeFilter(rep.id)}
                    className={`flex-1 min-w-[30%] h-10 rounded-xl items-center justify-center ${representativeFilter === rep.id ? "bg-primary" : "bg-background border border-border"}`}
                  >
                    <Text
                      className={`text-xs font-bold ${representativeFilter === rep.id ? "text-white" : "text-foreground"}`}
                      numberOfLines={1}
                    >
                      {rep.name.replace("المندوب ", "")}
                    </Text>
                  </Pressable>
                ))}
            </View>
            <Pressable
              onPress={() => {
                setFromDate("");
                setToDate("");
                setRepresentativeFilter("all");
              }}
              className="h-10 rounded-xl border border-border items-center justify-center"
            >
              <Text className="text-xs font-bold text-muted">
                مسح فلاتر التقرير
              </Text>
            </Pressable>
          </View>
        ) : null}
        <Modal
          visible={previewFullscreen}
          animationType="slide"
          onRequestClose={() => setPreviewFullscreen(false)}
        >
          <View className="flex-1 bg-background">
            <View className="px-5 pt-5 pb-3 border-b border-border flex-row-reverse items-center justify-between">
              <Pressable
                onPress={() => setPreviewFullscreen(false)}
                className="w-10 h-10 rounded-xl bg-surface items-center justify-center"
              >
                <MaterialIcons name="close" size={23} color="#102A43" />
              </Pressable>
              <View className="flex-1 items-end mr-3">
                <Text className="text-lg font-bold text-foreground">
                  معاينة التقرير بملء الشاشة
                </Text>
                <Text className="text-xs text-muted mt-1">
                  أعمدة ثابتة · ترتيب تصاعدي حسب وقت الزيارة
                </Text>
              </View>
              <MaterialIcons name="table-view" size={22} color="#1257A6" />
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            >
              {statusSummary()}
              {reportPreview(true)}
            </ScrollView>
          </View>
        </Modal>
        {period === "monthly" && monthlyLoading ? (
          <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-5 flex-row-reverse items-center gap-3">
            <ActivityIndicator size="small" color="#1257A6" />
            <View className="flex-1 items-end">
              <Text className="font-bold text-primary text-right">
                جاري جلب بيانات التقرير الشهري
              </Text>
              <Text className="text-xs text-muted text-right mt-1">
                يتم تصفية الزيارات وحساب الإحصاءات حسب النطاق المحدد...
              </Text>
            </View>
          </View>
        ) : null}
        <Modal
          visible={Boolean(editVisit)}
          transparent
          animationType="slide"
          onRequestClose={() => setEditVisit(null)}
        >
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] p-5 max-h-[92%]">
              <View className="flex-row-reverse items-center justify-between mb-4">
                <Pressable
                  onPress={() => setEditVisit(null)}
                  className="w-10 h-10 rounded-xl bg-surface items-center justify-center"
                >
                  <MaterialIcons name="close" size={22} color="#102A43" />
                </Pressable>
                <Text className="text-xl font-bold text-foreground">
                  تعديل الزيارة رقم{" "}
                  {editVisit
                    ? currentVisits.findIndex(
                        (visit) => visit.id === editVisit.id,
                      ) + 1
                    : ""}
                </Text>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text className="text-xs text-muted text-right mb-1">
                  اسم الطبيب
                </Text>
                <TextInput
                  value={editEntityName}
                  onChangeText={setEditEntityName}
                  placeholder="اسم الطبيب"
                  placeholderTextColor="#7C8798"
                  textAlign="right"
                  className="h-12 rounded-xl border border-border bg-surface px-4 text-foreground mb-3"
                />
                <Text className="text-xs text-muted text-right mb-1">
                  الأصناف المزارة — افصل بين الأصناف بفاصلة
                </Text>
                <TextInput
                  value={editProducts}
                  onChangeText={setEditProducts}
                  placeholder="مثال: Akisol 2mg tab, Losart 50mg tab"
                  placeholderTextColor="#7C8798"
                  textAlign="right"
                  className="h-12 rounded-xl border border-border bg-surface px-4 text-foreground mb-3"
                />
                <Text className="text-xs text-muted text-right mb-1">
                  الموقع الجغرافي / العنوان
                </Text>
                <TextInput
                  value={editGeographicLocation}
                  onChangeText={setEditGeographicLocation}
                  placeholder="اسم الحي أو العنوان"
                  placeholderTextColor="#7C8798"
                  textAlign="right"
                  className="h-12 rounded-xl border border-border bg-surface px-4 text-foreground mb-3"
                />
                <View className="flex-row-reverse gap-2">
                  <View className="flex-1">
                    <Text className="text-xs text-muted text-right mb-1">
                      خط العرض
                    </Text>
                    <TextInput
                      value={editLatitude}
                      onChangeText={setEditLatitude}
                      keyboardType="decimal-pad"
                      placeholder="15.3694"
                      placeholderTextColor="#7C8798"
                      textAlign="right"
                      className="h-12 rounded-xl border border-border bg-surface px-3 text-foreground"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted text-right mb-1">
                      خط الطول
                    </Text>
                    <TextInput
                      value={editLongitude}
                      onChangeText={setEditLongitude}
                      keyboardType="decimal-pad"
                      placeholder="44.1910"
                      placeholderTextColor="#7C8798"
                      textAlign="right"
                      className="h-12 rounded-xl border border-border bg-surface px-3 text-foreground"
                    />
                  </View>
                  <View className="w-24">
                    <Text className="text-xs text-muted text-right mb-1">
                      الدقة متر
                    </Text>
                    <TextInput
                      value={editAccuracy}
                      onChangeText={setEditAccuracy}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor="#7C8798"
                      textAlign="right"
                      className="h-12 rounded-xl border border-border bg-surface px-3 text-foreground"
                    />
                  </View>
                </View>
                <Text className="text-xs text-muted text-right mt-3 mb-1">
                  ملاحظات الزيارة
                </Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="ملاحظات الزيارة"
                  placeholderTextColor="#7C8798"
                  textAlign="right"
                  multiline
                  className="min-h-24 rounded-2xl border border-border bg-surface p-4 text-foreground"
                />
                <View className="rounded-xl bg-primary/10 border border-primary/20 p-3 mt-3 flex-row-reverse items-start gap-2">
                  <MaterialIcons name="history" size={19} color="#1257A6" />
                  <Text className="flex-1 text-primary text-xs text-right leading-5">
                    سيتم تسجيل اسم مدير النظام ووقت التعديل والحقول التي تغيرت
                    في سجل التدقيق.
                  </Text>
                </View>
                {editVisit?.auditLog?.length ? (
                  <View className="rounded-xl bg-surface border border-border p-3 mt-3">
                    <Text className="font-bold text-foreground text-right mb-2">
                      سجل التدقيق السابق
                    </Text>
                    {editVisit.auditLog.slice(0, 5).map((entry) => (
                      <View
                        key={entry.id}
                        className="border-t border-border py-2"
                      >
                        <Text className="text-xs font-bold text-foreground text-right">
                          {entry.actedBy} ·{" "}
                          {entry.actedAt.slice(0, 16).replace("T", " ")}
                        </Text>
                        <Text className="text-[11px] text-muted text-right mt-1">
                          الحقول: {entry.changedFields.join("، ")}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  onPress={saveVisitEdit}
                  className="h-14 rounded-2xl bg-success items-center justify-center mt-4 mb-3"
                >
                  <Text className="text-white font-bold">
                    حفظ التعديل وتسجيله
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
        {period === "monthly" ? (
          <>
            <View className="rounded-2xl bg-primary p-5 mb-5 items-end">
              <Text className="text-white/80 font-semibold">
                الفترة المختارة
              </Text>
              <Text className="text-white font-bold text-lg mt-1">{title}</Text>
              <Text className="text-white/80 text-sm mt-2">
                {currentVisits.length} زيارة ضمن التقرير
              </Text>
            </View>
            <Text className="font-bold text-foreground text-right mb-3">
              توزيع الزيارات حسب المندوب
            </Text>
            <View className="flex-row-reverse gap-3 mb-6">
              {byRepresentative.map(({ representative, count }, index) => (
                <MetricCard
                  key={representative.id}
                  label={
                    representative.name.replace("المندوب ", "") ||
                    `مندوب ${index + 1}`
                  }
                  value={count}
                  icon="person"
                  tone={
                    index === 1
                      ? "success"
                      : index === 2
                        ? "warning"
                        : "primary"
                  }
                />
              ))}
            </View>
          </>
        ) : null}
        {period === "monthly" ? (
          <View className="gap-3">
            <View className="flex-row-reverse gap-2">
              <Pressable
                onPress={() => run("print")}
                disabled={isWorking}
                className="flex-1 h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2"
                style={({ pressed }) => [
                  { opacity: pressed || isWorking ? 0.75 : 1 },
                ]}
              >
                <MaterialIcons name="print" size={21} color="#FFFFFF" />
                <Text className="text-white font-bold">طباعة مباشرة</Text>
              </Pressable>
              <Pressable
                onPress={() => run("share")}
                disabled={isWorking}
                className="flex-1 h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2"
                style={({ pressed }) => [
                  { opacity: pressed || isWorking ? 0.75 : 1 },
                ]}
              >
                <MaterialIcons
                  name="picture-as-pdf"
                  size={21}
                  color="#FFFFFF"
                />
                <Text className="text-white font-bold">تصدير PDF</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => run("email")}
              disabled={isWorking}
              className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"
              style={({ pressed }) => [
                { opacity: pressed || isWorking ? 0.75 : 1 },
              ]}
            >
              <MaterialIcons name="email" size={21} color="#FFFFFF" />
              <Text className="text-white font-bold">
                إرسال التقرير بالبريد
              </Text>
            </Pressable>
            <Pressable
              onPress={() => run("excel")}
              disabled={isWorking}
              className="h-14 rounded-2xl bg-[#217346] items-center justify-center flex-row-reverse gap-2"
              style={({ pressed }) => [
                { opacity: pressed || isWorking ? 0.75 : 1 },
              ]}
            >
              <MaterialIcons name="table-chart" size={21} color="#FFFFFF" />
              <Text className="text-white font-bold">تصدير Excel</Text>
            </Pressable>
          </View>
        ) : null}
        {period === "daily" && dailyPrintPreviewVisible ? (
          <View className="rounded-2xl bg-surface border border-border p-4 mt-5">
            <View className="flex-row-reverse items-center justify-between mb-3">
              {dailyPrintLoading ? (
                <View className="flex-row-reverse items-center gap-2">
                  <ActivityIndicator size="small" color="#1257A6" />
                  <Text className="text-xs font-bold text-primary">
                    جاري جلب البيانات وتجهيزها للطباعة...
                  </Text>
                </View>
              ) : (
                <View className="flex-row-reverse items-center gap-2">
                  <MaterialIcons
                    name="check-circle"
                    size={18}
                    color="#16A34A"
                  />
                  <Text className="text-xs font-bold text-success">
                    تم تجهيز البيانات
                  </Text>
                </View>
              )}
              <Text className="font-bold text-foreground text-right">
                بيانات التقرير للطباعة
              </Text>
            </View>
                          {!dailyPrintLoading && currentVisits.length === 0 ? (
                <View className="rounded-xl bg-warning/10 border border-warning/25 p-4 mb-3 items-end">
                  <Text className="font-bold text-warning text-right">
                    لا توجد زيارات في التاريخ المحدد
                  </Text>
                  <Text className="text-xs text-muted text-right mt-1">
                    جرّب اختيار تاريخ آخر أو «كل المندوبين» لعرض السجلات المتاحة.
                  </Text>
                </View>
              ) : null}
              {statusSummary()}
              {reportPreview()}

          </View>
        ) : null}
        <Modal
          visible={representativeMenuVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRepresentativeMenuVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8 max-h-[70%]">
              <View className="flex-row-reverse items-center justify-between mb-4">
                <Pressable
                  onPress={() => setRepresentativeMenuVisible(false)}
                  className="w-10 h-10 rounded-xl bg-surface items-center justify-center"
                >
                  <MaterialIcons name="close" size={22} color="#102A43" />
                </Pressable>
                <Text className="text-xl font-bold text-foreground">
                  اختر مندوب التقرير
                </Text>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable
                  onPress={() => {
                    setRepresentativeFilter("all");
                    setRepresentativeMenuVisible(false);
                  }}
                  className={`h-12 rounded-xl border px-4 mb-2 flex-row-reverse items-center justify-between ${representativeFilter === "all" ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}
                >
                  <Text className="font-bold text-foreground">
                    كل المندوبين
                  </Text>
                  {representativeFilter === "all" ? (
                    <MaterialIcons name="check" size={20} color="#1565C0" />
                  ) : null}
                </Pressable>
                {data.representatives
                  .filter((item) => item.active)
                  .map((rep) => (
                    <Pressable
                      key={rep.id}
                      onPress={() => {
                        setRepresentativeFilter(rep.id);
                        setRepresentativeMenuVisible(false);
                      }}
                      className={`h-12 rounded-xl border px-4 mb-2 flex-row-reverse items-center justify-between ${representativeFilter === rep.id ? "bg-primary/10 border-primary" : "bg-surface border-border"}`}
                    >
                      <Text className="font-bold text-foreground">
                        {rep.name}
                      </Text>
                      {representativeFilter === rep.id ? (
                        <MaterialIcons name="check" size={20} color="#1565C0" />
                      ) : null}
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <Modal visible={emailModalVisible} transparent animationType="slide" onRequestClose={() => setEmailModalVisible(false)}>
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] p-5">
              <View className="flex-row-reverse items-center justify-between mb-4">
                <Pressable onPress={() => setEmailModalVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable>
                <Text className="text-xl font-bold text-foreground">إرسال التقرير بالبريد</Text>
              </View>
              <Text className="text-xs text-muted text-right mb-1">البريد المستلم</Text>
              <TextInput value={emailRecipient} onChangeText={setEmailRecipient} keyboardType="email-address" autoCapitalize="none" placeholder="example@email.com" placeholderTextColor="#7C8798" textAlign="right" className="h-12 rounded-xl border border-border bg-surface px-4 text-foreground mb-4" />
              <Text className="text-xs text-muted text-right mb-2">الدورية المطلوبة</Text>
              <View className="flex-row-reverse flex-wrap gap-2 mb-4">
                {([['manual', 'يدوي'], ['daily', 'يومي'], ['weekly', 'أسبوعي'], ['monthly', 'شهري']] as const).map(([value, label]) => <Pressable key={value} onPress={() => setEmailFrequency(value)} className={`flex-1 min-w-[22%] h-10 rounded-xl items-center justify-center ${emailFrequency === value ? 'bg-primary' : 'bg-surface border border-border'}`}><Text className={`text-xs font-bold ${emailFrequency === value ? 'text-white' : 'text-foreground'}`}>{label}</Text></Pressable>)}
              </View>
              {emailFrequency !== "manual" ? <Text className="text-xs text-warning text-right leading-5 mb-3">سيتم حفظ الدورية كإعداد. الإرسال التلقائي يحتاج خدمة بريد مجدولة مرتبطة بالخادم، أما الإرسال اليدوي فيفتح تطبيق البريد مع التقرير مرفقاً.</Text> : null}
              <View className="flex-row-reverse gap-2">
                <Pressable onPress={() => void saveEmailSettings()} className="flex-1 h-12 rounded-xl bg-success items-center justify-center"><Text className="text-white font-bold">حفظ الإعداد</Text></Pressable>
                <Pressable onPress={() => { setEmailModalVisible(false); void run("email"); }} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center"><Text className="text-white font-bold">إرسال الآن</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={calendarTarget !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setCalendarTarget(null)}
        >
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] px-5 pt-5 pb-8">
              <View className="flex-row-reverse items-center justify-between mb-4">
                <Pressable
                  onPress={() => setCalendarTarget(null)}
                  className="w-10 h-10 rounded-xl bg-surface items-center justify-center"
                >
                  <MaterialIcons name="close" size={22} color="#102A43" />
                </Pressable>
                <Text className="text-xl font-bold text-foreground">
                  اختر{" "}
                  {calendarTarget === "day"
                    ? "يوم التقرير"
                    : calendarTarget === "from"
                      ? "تاريخ البداية"
                      : "تاريخ النهاية"}
                </Text>
              </View>
              <NativeDateTimePicker
                mode="date"
                minimumDate={
                  calendarTarget === "day" ? new Date(1970, 0, 1) : undefined
                }
                maximumDate={calendarTarget === "day" ? new Date() : undefined}
                value={
                  new Date(
                    (
                      calendarTarget === "day"
                        ? dailyDate
                        : calendarTarget === "from"
                          ? fromDate
                          : toDate
                    )
                      ? `${calendarTarget === "day" ? dailyDate : calendarTarget === "from" ? fromDate : toDate}T12:00:00`
                      : Date.now(),
                  )
                }
                onChange={(date) => {
                  const key = dateKey(date);
                  if (calendarTarget === "day") setDailyDate(key);
                  else if (calendarTarget === "from") setFromDate(key);
                  else setToDate(key);
                  setCalendarTarget(null);
                }}
              />
            </View>
          </View>
        </Modal>
        {period === "monthly" ? (
          <View className="rounded-2xl bg-surface border border-border p-4 mt-5 flex-row-reverse gap-3">
            <MaterialIcons name="info-outline" size={21} color="#1565C0" />
            <Text className="flex-1 text-right text-sm text-muted leading-5">
              يُنشأ ملف PDF من التقرير داخل الهاتف؛ ويمكن طباعته أو مشاركته أو
              فتح البريد مع التقرير كمرفق.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
