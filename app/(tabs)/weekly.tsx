import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useVisitStore } from "@/lib/visit-store";
import { buildId, visitsForDate } from "@/lib/visit-utils";
import {
  buildWeeklyExcelRows,
  buildWeeklyReportHtml,
  buildWeeklyReportRows,
  matchWeeklyVisits,
} from "@/lib/weekly-report";
import type { VisitShift } from "@/shared/visit-types";

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
  const { data, addPlannedVisit } = useVisitStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [repModal, setRepModal] = useState(false);
  const [entityModal, setEntityModal] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedRep, setSelectedRep] = useState(
    data.representatives[0]?.id ?? "",
  );
  const [selectedEntity, setSelectedEntity] = useState(
    data.entities[0]?.id ?? "",
  );
  const [selectedShift, setSelectedShift] = useState<VisitShift>("morning");
  const [notes, setNotes] = useState("");
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
  const plannedWeek = week.flatMap((day) => day.planned);
  const executedWeek = week.flatMap((day) => day.visits);
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
  const savePlan = () => {
    const entity = data.entities.find((item) => item.id === selectedEntity);
    if (!entity || !selectedRep) {
      Alert.alert("بيانات ناقصة", "اختر المندوب والطبيب والفترة.");
      return;
    }
    if (dayNames[selectedDayIndex] === "الجمعة") {
      Alert.alert("يوم إجازة", "لا يمكن جدولة زيارة يوم الجمعة.");
      return;
    }
    addPlannedVisit({
      id: buildId("planned"),
      representativeId: selectedRep,
      entityId: entity.id,
      entityName: entity.name,
      entityKind: entity.kind,
      scheduledDate: week[selectedDayIndex].key,
      shift: selectedShift,
      notes: notes.trim(),
    });
    setNotes("");
    setModalVisible(false);
  };
  const openPlan = (index: number) => {
    if (!data.entities.length) {
      Alert.alert(
        "أضف طبيباً أولاً",
        "أضف الأطباء من شاشة جهات الزيارة قبل إنشاء الخطة.",
      );
      return;
    }
    setSelectedDayIndex(index);
    setModalVisible(true);
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
          <View key={plan.id} className="rounded-lg bg-primary/10 px-2 py-1">
            <Text className="text-primary font-bold text-xs text-right">
              {plan.entityName}
            </Text>
            <Text className="text-primary/80 text-[10px] text-right">
              مخطط · {repName(plan.representativeId)}
            </Text>
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
          subtitle="جدول جميع المندوبين · السبت أول الأسبوع"
          icon="calendar-month"
        />
        <View className="rounded-2xl bg-primary p-4 mb-4 flex-row-reverse items-center gap-3">
          <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
            <MaterialIcons name="calendar-month" size={23} color="#FFFFFF" />
          </View>
          <View className="flex-1 items-end">
            <Text className="text-white font-bold text-lg">
              الخطة الأسبوعية
            </Text>
            <Text className="text-white/80 text-xs mt-1">
              اسم المندوب: جميع المندوبين · {totalPlanned} مخطط · {totalDone}{" "}
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
            {week.map((day, index) => (
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
        <View className="flex-row-reverse items-center justify-between mt-5 mb-3">
          <Text className="font-bold text-foreground text-lg">
            تقرير المدير الأسبوعي
          </Text>
          <View className="flex-row-reverse gap-2">
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
        ))}{" "}
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
                إضافة زيارة مخططة
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#102A43" />
              </Pressable>
            </View>
            <Text className="text-sm text-muted text-right mb-3">
              اليوم: {dayNames[selectedDayIndex]}
            </Text>
            <Pressable
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
            </Pressable>
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
