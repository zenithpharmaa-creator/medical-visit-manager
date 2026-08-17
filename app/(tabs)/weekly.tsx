import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { NativeDateTimePicker } from "@/components/native-date-time-picker";
import { SelectionModal } from "@/components/selection-modal";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, visitsForDate } from "@/lib/visit-utils";
import {
  buildWeeklyExcelRows,
  buildWeeklyReportHtml,
  buildWeeklyReportRows,
  matchWeeklyVisits,
} from "@/lib/weekly-report";
import type { PlannedVisit, PlannedVisitStatus, VisitShift } from "@/shared/visit-types";

const dayNames = [
  "السبت",
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];
const shifts = [
  {
    value: "morning" as VisitShift,
    label: "الفترة الصباحية",
    short: "صباحية",
    time: "08:00 – 13:00",
  },
  {
    value: "evening" as VisitShift,
    label: "الفترة المسائية",
    short: "مسائية",
    time: "16:00 – 20:00",
  },
];
const column = { date: 112, day: 96, shift: 245 };

export default function WeeklyPlanScreen() {
  const { data, addPlannedVisit, updatePlannedVisit } = useVisitStore();
  const { session } = useAccountSession();
  const isManager = session?.role === "manager";
  const currentRepId = session?.representativeId ?? "";
  const [modalVisible, setModalVisible] = useState(false);
  const [repModal, setRepModal] = useState(false);
  const [entityModal, setEntityModal] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedRep, setSelectedRep] = useState(
    session?.representativeId ?? data.representatives[0]?.id ?? "",
  );
  const [selectedEntity, setSelectedEntity] = useState(
    data.entities[0]?.id ?? "",
  );
  const [selectedShift, setSelectedShift] = useState<VisitShift>("morning");
  const [notes, setNotes] = useState("");
  const [scheduledDateTime, setScheduledDateTime] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlannedVisit | null>(null);
  const [selectedRepFilter, setSelectedRepFilter] = useState(session?.representativeId ?? "all");
  const [filterModal, setFilterModal] = useState(false);
  const [statusPlan, setStatusPlan] = useState<PlannedVisit | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const lastNotifiedPendingCount = useRef(0);
  const week = useMemo(() => {
    const today = new Date();
    const offset = (today.getDay() + 1) % 7;
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
    );
    return dayNames.map((name, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        name,
        date,
        key,
        visits: visitsForDate(data.visits, date),
        planned: data.plannedVisits.filter(
          (visit) => visit.scheduledDate === key,
        ),
        holiday: name === "الجمعة",
      };
    });
  }, [data.visits, data.plannedVisits]);
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("ar-YE", { day: "numeric", month: "short" }).format(
      date,
    );
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("ar-YE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  const repName = (id: string) =>
    data.representatives.find((rep) => rep.id === id)?.name ?? "مندوب غير محدد";
  const entityName = (id: string) =>
    data.entities.find((entity) => entity.id === id)?.name ?? "طبيب غير محدد";
  const activeRepFilter = isManager ? selectedRepFilter : currentRepId;
  const visibleWeek = week.map((day) => ({ ...day, planned: activeRepFilter === "all" ? day.planned : day.planned.filter((item) => item.representativeId === activeRepFilter), visits: activeRepFilter === "all" ? day.visits : day.visits.filter((item) => item.representativeId === activeRepFilter) }));
  const plannedWeek = visibleWeek.flatMap((day) => day.planned);
  const executedWeek = visibleWeek.flatMap((day) => day.visits);
  const report = buildWeeklyReportRows(
    plannedWeek,
    executedWeek,
    data.representatives,
  );
  const matchedCount = matchWeeklyVisits(plannedWeek, executedWeek).filter(
    (item) => item.status === "matched",
  ).length;
  const totalPlanned = plannedWeek.length;
  const totalDone = executedWeek.length;
  const pendingApprovalCount = data.plannedVisits.filter((plan) => plan.approvalStatus === "pending").length;
  useEffect(() => {
    if (isManager && pendingApprovalCount > lastNotifiedPendingCount.current) {
      Alert.alert("خطة بانتظار الاعتماد", `لديك ${pendingApprovalCount} زيارة مخططة بانتظار اعتماد المدير.`);
    }
    lastNotifiedPendingCount.current = pendingApprovalCount;
  }, [isManager, pendingApprovalCount]);
  const savePlan = () => {
    const entity = data.entities.find((item) => item.id === selectedEntity);
    const representativeId = isManager ? selectedRep : currentRepId;
    if (!isManager) setSelectedRep(currentRepId);
    if (!entity || !representativeId) {
      Alert.alert("بيانات ناقصة", "اختر المندوب والطبيب والفترة.");
      return;
    }
    if (new Date(scheduledDateTime).getDay() === 5) {
      Alert.alert("يوم إجازة", "لا يمكن جدولة زيارة يوم الجمعة.");
      return;
    }
    const plan = {
      id: editingPlan?.id ?? buildId("planned"),
      representativeId,
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      scheduledDate: scheduledDateTime.toISOString().slice(0, 10),
      scheduledTime: scheduledDateTime.toISOString(),
      shift: selectedShift,
      notes: notes.trim(),
      approvalStatus: isManager ? "approved" : (editingPlan?.approvalStatus ?? "pending"),
      planStatus: editingPlan?.planStatus ?? "planned",
      cancellationReason: editingPlan?.cancellationReason,
    };
    if (editingPlan) updatePlannedVisit(plan); else addPlannedVisit(plan);
    setNotes(""); setEditingPlan(null);
    setDatePickerVisible(false); setTimePickerVisible(false); setModalVisible(false);
  };
  const openPlan = (index: number) => {
    if (!data.entities.length) {
      Alert.alert(
        "أضف طبيباً أولاً",
        "أضف الأطباء من شاشة جهات الزيارة قبل إنشاء الخطة.",
      );
      return;
    }
    setEditingPlan(null);
    if (!isManager) setSelectedRep(currentRepId);
    setSelectedDayIndex(index);
    const plannedDate = new Date(week[index].date);
    plannedDate.setHours(selectedShift === "morning" ? 8 : 16, 0, 0, 0);
    setScheduledDateTime(plannedDate);
    setModalVisible(true);
  };
  const openEditPlan = (plan: PlannedVisit) => { if (!isManager && plan.representativeId !== currentRepId) { Alert.alert("لا تملك الصلاحية", "يمكنك تعديل خطتك الأسبوعية الخاصة فقط."); return; } if (!isManager && (plan.approvalStatus === "approved" || plan.planStatus === "cancelled")) { Alert.alert("الخطة مقفلة", "لا يمكن تعديل الخطة بعد اعتمادها أو إلغائها."); return; } setEditingPlan(plan); setSelectedRep(plan.representativeId); setSelectedEntity(plan.entityId); setSelectedShift(plan.shift); setNotes(plan.notes ?? ""); setScheduledDateTime(new Date(plan.scheduledTime ?? `${plan.scheduledDate}T${plan.shift === "morning" ? "08:00" : "16:00"}:00`)); setModalVisible(true); };
  const approvePlan = (plan: PlannedVisit) => { updatePlannedVisit({ ...plan, approvalStatus: "approved" }); };
  const openStatusModal = (plan: PlannedVisit) => { setStatusPlan(plan); setCancellationReason(""); setStatusModalVisible(true); };
  const savePlanStatus = (status: PlannedVisitStatus) => { if (!statusPlan) return; if (status === "cancelled" && cancellationReason.trim().length < 3) { Alert.alert("سبب الإلغاء مطلوب", "اكتب سبباً مختصراً لإلغاء الزيارة."); return; } updatePlannedVisit({ ...statusPlan, planStatus: status, cancellationReason: status === "cancelled" ? cancellationReason.trim() : undefined }); setStatusModalVisible(false); setStatusPlan(null); };
  const printTable = async () => { const rows = visibleWeek.map((day) => `<tr><td>${day.key}</td><td>${day.name}${day.holiday ? " (إجازة)" : ""}</td><td>${day.planned.filter((item) => item.shift === "morning").map((item) => `${item.entityName} — ${repName(item.representativeId)}`).join("<br>") || "—"}</td><td>${day.planned.filter((item) => item.shift === "evening").map((item) => `${item.entityName} — ${repName(item.representativeId)}`).join("<br>") || "—"}</td></tr>`).join(""); try { await Print.printAsync({ html: `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;color:#101820}h1,h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #3f4748;padding:10px;text-align:right}th{background:#d4d8d8}td{height:54px} .brand{color:#2f6b50;text-align:center;font-weight:bold}</style></head><body><div class="brand">مدير الزيارات الطبية</div><h1>الخطة الأسبوعية</h1><h2>اسم المندوب: ${selectedRepFilter === "all" ? "جميع المندوبين" : repName(selectedRepFilter)}</h2><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الفترة الصباحية<br>08:00 – 13:00</th><th>الفترة المسائية<br>16:00 – 20:00</th></tr></thead><tbody>${rows}</tbody></table></body></html>` }); } catch { Alert.alert("تعذر الطباعة", "حاول مرة أخرى بعد التأكد من اتصال الطابعة."); } };
  const exportPlan = async (type: "pdf" | "excel") => {
    const selectedName = selectedRepFilter === "all" ? "جميع المندوبين" : repName(selectedRepFilter);
    try {
      if (type === "pdf") {
        const rows = plannedWeek.map((item) => `<tr><td>${item.scheduledDate}</td><td>${item.entityName}</td><td>${item.shift === "morning" ? "صباحية 08:00–13:00" : "مسائية 16:00–20:00"}</td><td>${repName(item.representativeId)}</td><td>${timeOf(item.scheduledTime ?? `${item.scheduledDate}T08:00:00`)}</td></tr>`).join("");
        await Print.printAsync({ html: `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;color:#101820}h1,h2{text-align:center}.brand{text-align:center;color:#2f6b50;font-weight:bold;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #3f4748;padding:9px;text-align:right}th{background:#d4d8d8}</style></head><body><div class="brand">مدير الزيارات الطبية</div><h1>خطة الزيارات الأسبوعية</h1><h2>المندوب: ${selectedName}</h2><table><thead><tr><th>التاريخ</th><th>الطبيب</th><th>الفترة</th><th>المندوب</th><th>الوقت</th></tr></thead><tbody>${rows || `<tr><td colspan="5">لا توجد زيارات مخططة</td></tr>`}</tbody></table></body></html>` });
        return;
      }
      const rows = plannedWeek.map((item) => ({ التاريخ: item.scheduledDate, اليوم: dayNames[new Date(`${item.scheduledDate}T12:00:00`).getDay() === 0 ? 6 : new Date(`${item.scheduledDate}T12:00:00`).getDay() - 1], الطبيب: item.entityName, الفترة: item.shift === "morning" ? "صباحية" : "مسائية", الوقت: timeOf(item.scheduledTime ?? `${item.scheduledDate}T08:00:00`), المندوب: repName(item.representativeId), ملاحظات: item.notes ?? "" }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ ملاحظة: "لا توجد زيارات مخططة" }]);
      XLSX.utils.book_append_sheet(workbook, sheet, "خطة المندوب");
      const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
      const file = new File(Paths.cache, `weekly-plan-${selectedRepFilter === "all" ? "all" : selectedRepFilter}-${Date.now()}.xlsx`);
      file.create({ overwrite: true }); file.write(base64);
      await Sharing.shareAsync(file.uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: `مشاركة خطة ${selectedName}` });
    } catch { Alert.alert("تعذر التصدير", "حاول مرة أخرى بعد التأكد من توفر تطبيق المشاركة أو الطباعة."); }
  };
  const exportWeekly = async (type: "pdf" | "excel") => {
    try {
      if (type === "pdf") {
        const file = await Print.printToFileAsync({
          html: buildWeeklyReportHtml(
            plannedWeek,
            executedWeek,
            data.representatives,
            "التقرير الأسبوعي للمخطط والمنفذ",
          ),
        });
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "مشاركة التقرير الأسبوعي",
        });
        return;
      }
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(
        buildWeeklyExcelRows(plannedWeek, executedWeek, data.representatives),
      );
      XLSX.utils.book_append_sheet(workbook, sheet, "التقرير الأسبوعي");
      const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
      const file = new File(Paths.cache, `weekly-report-${Date.now()}.xlsx`);
      file.create({ overwrite: true });
      file.write(base64);
      await Sharing.shareAsync(file.uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "مشاركة التقرير الأسبوعي",
      });
    } catch {
      Alert.alert(
        "تعذر التصدير",
        "حاول مرة أخرى بعد التأكد من توفر تطبيق المشاركة.",
      );
    }
  };
  const cellText = (day: (typeof week)[number], shift: VisitShift) => {
    const plans = day.planned.filter((item) => item.shift === shift);
    const done = day.visits.filter((visit) => {
      const hour = new Date(visit.recordedAt).getHours();
      return shift === "morning"
        ? hour >= 8 && hour < 13
        : hour >= 16 && hour < 20;
    });
    return (
      <View className="gap-1">
        {plans.map((plan) => (
          <View key={plan.id} className={`rounded-lg px-2 py-1 ${plan.planStatus === "cancelled" ? "bg-error/10" : plan.approvalStatus === "pending" ? "bg-warning/10" : plan.planStatus === "executed" ? "bg-success/10" : "bg-primary/10"}`}>
            <Pressable onPress={() => (isManager || plan.representativeId === currentRepId) && openEditPlan(plan)}>
              <Text className={`font-bold text-xs text-right ${plan.planStatus === "cancelled" ? "text-error" : plan.planStatus === "executed" ? "text-success" : "text-primary"}`}>{plan.entityName}</Text>
              <Text className="text-primary/80 text-[10px] text-right">{plan.planStatus === "cancelled" ? "ملغاة" : plan.planStatus === "executed" ? "منفذة" : plan.approvalStatus === "pending" ? "بانتظار اعتماد المدير" : "معتمدة"} · {repName(plan.representativeId)}</Text>
              {plan.planStatus === "cancelled" && plan.cancellationReason ? <Text className="text-error/80 text-[10px] text-right">سبب الإلغاء: {plan.cancellationReason}</Text> : null}
            </Pressable>
            {isManager && plan.approvalStatus === "pending" ? <Pressable onPress={() => approvePlan(plan)} className="mt-1 self-end rounded-md bg-primary px-2 py-1"><Text className="text-white text-[10px] font-bold">اعتماد</Text></Pressable> : null}
            {isManager && plan.approvalStatus === "approved" && plan.planStatus !== "cancelled" ? <View className="flex-row-reverse gap-1 mt-1"><Pressable onPress={() => openStatusModal(plan)} className="rounded-md bg-success px-2 py-1"><Text className="text-white text-[10px] font-bold">منفذة</Text></Pressable><Pressable onPress={() => { setStatusPlan(plan); setCancellationReason(""); setStatusModalVisible(true); }} className="rounded-md bg-error px-2 py-1"><Text className="text-white text-[10px] font-bold">إلغاء</Text></Pressable></View> : null}
          </View>
        ))}
        {done.map((visit) => (
          <View key={visit.id} className="rounded-lg bg-success/10 px-2 py-1">
            <Text className="text-success font-bold text-xs text-right">
              {visit.entityName}
            </Text>
            <Text className="text-success/80 text-[10px] text-right">
              منفذ · {repName(visit.representativeId)} ·{" "}
              {timeOf(visit.recordedAt)}
            </Text>
          </View>
        ))}
        {!plans.length && !done.length ? (
          <Text className="text-muted text-xs text-center">—</Text>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-4" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
          <ScreenHeader
          title="الخطة الأسبوعية"
          subtitle={isManager ? "جدول جميع المندوبين · السبت أول الأسبوع" : "خطتك الأسبوعية · السبت أول الأسبوع"}
          icon="calendar-month"
        />
        <View className="rounded-2xl bg-white border border-border p-3 mb-4 flex-row-reverse items-center justify-center gap-3"><Image source={require("../../assets/images/icon.png")} className="w-12 h-12 rounded-xl" /><View className="items-end"><Text className="font-bold text-foreground">مدير الزيارات الطبية</Text><Text className="text-xs text-muted mt-1">الخطة الأسبوعية</Text></View></View>
        <View className="rounded-2xl bg-primary p-4 mb-4 flex-row-reverse items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
            <MaterialIcons name="calendar-month" size={23} color="#FFFFFF" />
          </View>
          <View className="flex-1 items-end">
            <Text className="text-white font-bold text-lg">
              الخطة الأسبوعية
            </Text>
                          <Text className="text-white/80 text-xs mt-1">
              اسم المندوب: {isManager ? (activeRepFilter === "all" ? "جميع المندوبين" : repName(activeRepFilter)) : repName(currentRepId)} · {totalPlanned} مخطط · {totalDone}{" "}
              منفذ · {matchedCount} مطابق
            </Text>
          </View>
        </View>
        <View className="flex-row-reverse gap-2 mb-4">
          <View className="flex-1 rounded-xl bg-primary/10 border border-primary/20 p-3 items-end">
            <Text className="text-primary font-bold text-xs">
              الفترة الصباحية
            </Text>
            <Text className="text-primary text-xs mt-1">08:00 – 13:00</Text>
          </View>
          <View className="flex-1 rounded-xl bg-success/10 border border-success/20 p-3 items-end">
            <Text className="text-success font-bold text-xs">
              الفترة المسائية
            </Text>
            <Text className="text-success text-xs mt-1">16:00 – 20:00</Text>
          </View>
        </View>
        {isManager ? <Pressable onPress={() => setFilterModal(true)} className="h-12 rounded-2xl bg-surface border border-border px-4 flex-row-reverse items-center justify-between mb-4"><Text className="font-bold text-foreground">{activeRepFilter === "all" ? "جميع المندوبين" : repName(activeRepFilter)}</Text><View className="flex-row-reverse items-center gap-2"><Text className="text-xs text-muted">عرض جدول مستقل</Text><MaterialIcons name="filter-list" size={21} color="#102A43" /></View></Pressable> : <View className="h-12 rounded-2xl bg-surface border border-border px-4 flex-row-reverse items-center justify-between mb-4"><Text className="font-bold text-foreground">{repName(currentRepId)}</Text><Text className="text-xs text-muted">الخطة الخاصة بك</Text></View>}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{
            minWidth: column.date + column.day + column.shift * 2,
          }}
        >
          <View
            className="rounded-xl overflow-hidden border-2 border-[#2F6B50] bg-[#F2F4F4]"
            style={{ width: column.date + column.day + column.shift * 2 }}
          >
            <View className="bg-[#D9E1E2] border-b border-[#3F4748] py-3">
              <Text className="text-center text-2xl font-bold text-[#101820]">
                الخطة الأسبوعية
              </Text>
            </View>
            <View className="bg-[#E6E8E8] border-b border-[#3F4748] py-2">
              <Text className="text-center text-lg font-bold text-[#101820]">
                اسم المندوب: جميع المندوبين
              </Text>
            </View>
            <View className="flex-row-reverse bg-[#D4D8D8] border-b border-[#3F4748]">
              <View
                style={{ width: column.date }}
                className="border-l border-[#3F4748] p-3 justify-center"
              >
                <Text className="font-bold text-center text-[#101820]">
                  التاريخ
                </Text>
              </View>
              <View
                style={{ width: column.day }}
                className="border-l border-[#3F4748] p-3 justify-center"
              >
                <Text className="font-bold text-center text-[#101820]">
                  اليوم
                </Text>
              </View>
              <View
                style={{ width: column.shift }}
                className="border-l border-[#3F4748] p-3 justify-center"
              >
                <Text className="font-bold text-center text-[#101820]">
                  الفترة الصباحية
                </Text>
                <Text className="text-[10px] text-center text-[#101820]">
                  08:00 – 13:00
                </Text>
              </View>
              <View
                style={{ width: column.shift }}
                className="p-3 justify-center"
              >
                <Text className="font-bold text-center text-[#101820]">
                  الفترة المسائية
                </Text>
                <Text className="text-[10px] text-center text-[#101820]">
                  16:00 – 20:00
                </Text>
              </View>
            </View>
            {visibleWeek.map((day, index) => (
              <View
                key={day.key}
                className={`flex-row-reverse border-b border-[#6B7374] min-h-[92px] ${day.holiday ? "bg-[#E2E2E2]" : "bg-[#F7F8F8]"}`}
              >
                <View
                  style={{ width: column.date }}
                  className="border-l border-[#6B7374] p-2 justify-center"
                >
                  <Text className="text-center font-bold text-[#101820] text-xs">
                    {formatDate(day.date)}
                  </Text>
                </View>
                <View
                  style={{ width: column.day }}
                  className="border-l border-[#6B7374] p-2 justify-center items-center"
                >
                  <Text className="text-center font-bold text-[#101820]">
                    {day.name}
                  </Text>
                  {day.holiday ? (
                    <Text className="text-[10px] text-amber-700 mt-1">
                      إجازة
                    </Text>
                  ) : (
                    <Pressable
                      onPress={() => openPlan(index)}
                      className="mt-2 rounded-lg bg-primary px-2 py-1"
                    >
                      <Text className="text-white text-[10px] font-bold">
                        + خطة
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View
                  style={{ width: column.shift }}
                  className="border-l border-[#6B7374] p-2"
                >
                  {day.holiday ? (
                    <Text className="text-center text-xs text-muted mt-3">
                      إجازة رسمية
                    </Text>
                  ) : (
                    cellText(day, "morning")
                  )}
                </View>
                <View style={{ width: column.shift }} className="p-2">
                  {day.holiday ? (
                    <Text className="text-center text-xs text-muted mt-3">
                      إجازة رسمية
                    </Text>
                  ) : (
                    cellText(day, "evening")
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        {isManager && pendingApprovalCount > 0 ? <View className="rounded-2xl bg-warning/10 border border-warning/30 p-3 mt-5 mb-2 flex-row-reverse items-center gap-2"><MaterialIcons name="notifications-active" size={20} color="#B45309" /><Text className="flex-1 text-right text-warning font-bold text-sm">لديك {pendingApprovalCount} زيارة مخططة بانتظار اعتمادك. اضغط «اعتماد» بجانب الخطة.</Text></View> : null}
        {isManager ? (<><View className="flex-row-reverse items-center justify-between mt-5 mb-3">
          <Text className="font-bold text-foreground text-lg">
            تقرير المدير الأسبوعي
          </Text>
          <View className="flex-row-reverse gap-2 flex-wrap justify-end"><Pressable onPress={() => exportPlan("pdf")} className="rounded-xl bg-primary px-3 py-2 flex-row-reverse items-center gap-1"><MaterialIcons name="picture-as-pdf" size={16} color="#FFFFFF" /><Text className="text-white text-xs font-bold">PDF الخطة</Text></Pressable><Pressable onPress={() => exportPlan("excel")} className="rounded-xl bg-success px-3 py-2 flex-row-reverse items-center gap-1"><MaterialIcons name="table-view" size={16} color="#FFFFFF" /><Text className="text-white text-xs font-bold">Excel الخطة</Text></Pressable><Pressable onPress={printTable} className="rounded-xl bg-primary px-3 py-2 flex-row-reverse items-center gap-1"><MaterialIcons name="print" size={16} color="#FFFFFF" /><Text className="text-white text-xs font-bold">طباعة الجدول</Text></Pressable>
            <Pressable
              onPress={() => exportWeekly("pdf")}
              className="rounded-xl bg-foreground px-3 py-2 flex-row-reverse items-center gap-1"
            >
              <MaterialIcons name="picture-as-pdf" size={16} color="#FFFFFF" />
              <Text className="text-white text-xs font-bold">PDF</Text>
            </Pressable>
            <Pressable
              onPress={() => exportWeekly("excel")}
              className="rounded-xl bg-success px-3 py-2 flex-row-reverse items-center gap-1"
            >
              <MaterialIcons name="grid-on" size={16} color="#FFFFFF" />
              <Text className="text-white text-xs font-bold">Excel</Text>
            </Pressable>
          </View>
        </View>
        {report.map((item) => (
          <View
            key={item.representative.id}
            className="rounded-xl bg-surface border border-border p-3 mb-2 flex-row-reverse justify-between"
          >
            <Text className="font-bold text-foreground">
              {item.representative.name}
            </Text>
            <Text className="text-xs text-muted">
              صباحي: {item.morningMatched}/{item.morningPlanned} · مسائي:{" "}
              {item.eveningMatched}/{item.eveningPlanned}
            </Text>
          </View>
        ))}{" "}</>) : null}
      </ScrollView>
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/35">
          <View className="bg-background rounded-t-[28px] p-5">
            <View className="flex-row-reverse justify-between items-center mb-4">
              <Text className="text-xl font-bold text-foreground">
                {editingPlan ? "تعديل الزيارة المخططة" : "إضافة زيارة مخططة"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#102A43" />
              </Pressable>
            </View>
            <Text className="text-sm text-muted text-right mb-3">
              اليوم: {new Intl.DateTimeFormat("ar-YE", { weekday: "long" }).format(scheduledDateTime)}
            </Text>
            <Pressable onPress={() => setDatePickerVisible((value) => !value)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3">
              <Text className="font-bold text-foreground">التاريخ: {formatDate(scheduledDateTime)}</Text>
              <MaterialIcons name="calendar-today" size={22} color="#102A43" />
            </Pressable>
            {datePickerVisible ? <View className="rounded-2xl bg-surface border border-border p-2 mb-3"><NativeDateTimePicker value={scheduledDateTime} mode="date" onChange={(value: Date) => { setScheduledDateTime(value); setDatePickerVisible(false); }} /></View> : null}
            <Pressable onPress={() => setTimePickerVisible((value) => !value)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3">
              <Text className="font-bold text-foreground">وقت الزيارة: {new Intl.DateTimeFormat("ar-YE", { hour: "2-digit", minute: "2-digit" }).format(scheduledDateTime)}</Text>
              <MaterialIcons name="schedule" size={22} color="#102A43" />
            </Pressable>
            {timePickerVisible ? <View className="rounded-2xl bg-surface border border-border p-2 mb-3"><NativeDateTimePicker value={scheduledDateTime} mode="time" onChange={(value: Date) => { setScheduledDateTime(value); setTimePickerVisible(false); }} /></View> : null}
            {isManager ? <Pressable
              onPress={() => setRepModal(true)}
              className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"
            >
              <Text className="font-bold text-foreground">
                {repName(selectedRep)}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color="#102A43"
              />
            </Pressable> : <View className="h-14 rounded-2xl border border-primary/20 bg-primary/10 px-4 flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-primary">{repName(currentRepId)}</Text><Text className="text-xs text-muted">حسابك</Text></View>}
            <Pressable
              onPress={() => setEntityModal(true)}
              className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"
            >
              <Text className="font-bold text-foreground">
                {entityName(selectedEntity)}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color="#102A43"
              />
            </Pressable>
            <Pressable
              onPress={() => setShiftModal(true)}
              className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-3"
            >
              <Text className="font-bold text-foreground">
                {shifts.find((shift) => shift.value === selectedShift)?.label} ·{" "}
                {shifts.find((shift) => shift.value === selectedShift)?.time}
              </Text>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color="#102A43"
              />
            </Pressable>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="ملاحظات اختيارية"
              placeholderTextColor="#7C8798"
              textAlign="right"
              className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground mb-4"
            />
            <Pressable
              onPress={savePlan}
              className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"
            >
              <MaterialIcons name="save" size={20} color="#FFFFFF" />
              <Text className="text-white font-bold">حفظ الزيارة المخططة</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={statusModalVisible} transparent animationType="fade" onRequestClose={() => setStatusModalVisible(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><Text className="text-lg font-bold text-foreground text-right mb-3">تحديث حالة الخطة</Text><Text className="text-sm text-muted text-right mb-3">{statusPlan?.entityName ?? ""}</Text><TextInput value={cancellationReason} onChangeText={setCancellationReason} placeholder="سبب الإلغاء (مطلوب عند الإلغاء)" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground mb-3" /><View className="flex-row-reverse gap-2"><Pressable onPress={() => savePlanStatus("executed")} className="flex-1 h-12 rounded-xl bg-success items-center justify-center"><Text className="text-white font-bold">منفذة</Text></Pressable><Pressable onPress={() => savePlanStatus("cancelled")} className="flex-1 h-12 rounded-xl bg-error items-center justify-center"><Text className="text-white font-bold">ملغاة</Text></Pressable></View><Pressable onPress={() => setStatusModalVisible(false)} className="h-11 rounded-xl bg-surface border border-border items-center justify-center mt-2"><Text className="text-foreground font-bold">إلغاء</Text></Pressable></View></View></Modal>
      <SelectionModal visible={filterModal} title="اختر المندوب لعرض جدوله" options={[{ label: "جميع المندوبين", value: "all" }, ...data.representatives.map((rep) => ({ label: rep.name, value: rep.id }))]} selected={selectedRepFilter} onClose={() => setFilterModal(false)} onSelect={(option) => { setSelectedRepFilter(option.value); setFilterModal(false); }} />
      <SelectionModal
        visible={repModal}
        title="اختر المندوب"
        options={data.representatives.map((rep) => ({
          label: rep.name,
          value: rep.id,
        }))}
        selected={selectedRep}
        onClose={() => setRepModal(false)}
        onSelect={(option) => {
          setSelectedRep(option.value);
          setRepModal(false);
        }}
      />
      <SelectionModal
        visible={entityModal}
        title="اختر الطبيب أو الجهة"
        options={data.entities.map((entity) => ({
          label: `${entity.name} · ${entity.kind}`,
          value: entity.id,
        }))}
        selected={selectedEntity}
        onClose={() => setEntityModal(false)}
        onSelect={(option) => {
          setSelectedEntity(option.value);
          setEntityModal(false);
        }}
      />
      <SelectionModal
        visible={shiftModal}
        title="اختر فترة الزيارة"
        options={shifts.map((shift) => ({
          label: `${shift.label} · ${shift.time}`,
          value: shift.value,
        }))}
        selected={selectedShift}
        onClose={() => setShiftModal(false)}
        onSelect={(option) => {
          setSelectedShift(option.value as VisitShift);
          setShiftModal(false);
        }}
      />
    </ScreenContainer>
  );
}
