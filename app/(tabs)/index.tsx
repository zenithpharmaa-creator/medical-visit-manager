import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useState } from "react";

import { MetricCard } from "@/components/metric-card";
import { AssignedVisitsWindow } from "@/components/assigned-visits-window";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { formatArabicDate, visitsForDate } from "@/lib/visit-utils";
import { monthlyOverrideCounts } from "@/lib/override-report";
import { Visit } from "@/shared/visit-types";
import { saveManagerPassword } from "@/lib/manager-auth";
import { saveRepresentativePassword } from "@/lib/representative-auth";
import { validateRepresentativePassword } from "@/lib/representative-auth-validation";
import { BACKUP_RECIPIENT, composeBackupEmail, createLocalBackup, ensureDailyLocalBackup, parseBackupJson, type BackupMeta } from "@/lib/local-backup";
import { mergeAppData } from "@/lib/backup-validation";

export default function HomeScreen() {
  const { data, loading, restoreData, updateVisit } = useVisitStore();
  const { session, logout } = useAccountSession();
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreStage, setRestoreStage] = useState<"idle" | "reading" | "waiting" | "merging" | "replacing" | "done">("idle");
  const restoreStageLabel = restoreStage === "reading" ? "جاري قراءة ملف النسخة الاحتياطية..." : restoreStage === "waiting" ? "تمت قراءة الملف، اختر طريقة الاستعادة..." : restoreStage === "merging" ? "جاري دمج السجلات ومنع التكرار..." : restoreStage === "replacing" ? "جاري استبدال البيانات بالنسخة المختارة..." : restoreStage === "done" ? "اكتملت عملية الاسترداد بنجاح" : "";
  const [selectedRecentVisit, setSelectedRecentVisit] = useState<Visit | null>(null);
  const [visitDetailsVisible, setVisitDetailsVisible] = useState(false);
  const [visitEditVisible, setVisitEditVisible] = useState(false);
  const [editVisitNotes, setEditVisitNotes] = useState("");
  const openVisitDetails = (visit: Visit) => { setSelectedRecentVisit(visit); setVisitDetailsVisible(true); };
  const openVisitEdit = (visit: Visit) => { setSelectedRecentVisit(visit); setEditVisitNotes(visit.notes ?? ""); setVisitEditVisible(true); };
  const saveVisitEdit = () => {
    if (!selectedRecentVisit) return;
    const updated = { ...selectedRecentVisit, notes: editVisitNotes.trim() };
    updateVisit(updated);
    setSelectedRecentVisit(updated);
    setVisitEditVisible(false);
    Alert.alert("تم تحديث الزيارة", "تم حفظ ملاحظات الزيارة بنجاح.");
  };
  const createDailyBackup = async (force = false) => {
    if (session?.role !== "manager") return;
    setBackupBusy(true);
    try {
      const next = force ? await createLocalBackup(data) : await ensureDailyLocalBackup(data);
      setBackupMeta(next);
    } catch { Alert.alert("تعذر إنشاء النسخة", "تحقق من مساحة التخزين المتاحة على الهاتف ثم حاول مرة أخرى."); }
    finally { setBackupBusy(false); }
  };
  const importBackup = async () => {
    if (restoreBusy) return;
    setRestoreBusy(true);
    setRestoreStage("reading");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/json", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) { setRestoreStage("idle"); return; }
      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parseBackupJson(text);
      setRestoreStage("waiting");
      Alert.alert("اختيار طريقة الاستعادة", `النسخة تحتوي على ${parsed.summary.visits} زيارة و${parsed.summary.entities} جهة.\n\nيمكنك دمج السجلات الجديدة مع بياناتك الحالية، أو استبدال البيانات بالكامل.`, [{ text: "إلغاء", style: "cancel" }, { text: "استبدال بالكامل", style: "destructive", onPress: async () => { setRestoreStage("replacing"); await new Promise((resolve) => setTimeout(resolve, 50)); restoreData(parsed.data); setRestoreStage("done"); Alert.alert("تمت الاستعادة", "تم استبدال البيانات الحالية بالنسخة المختارة."); } }, { text: "دمج مع الحالي", onPress: async () => { setRestoreStage("merging"); await new Promise((resolve) => setTimeout(resolve, 50)); const merged = mergeAppData(data, parsed.data); restoreData(merged.data); setRestoreStage("done"); Alert.alert("تم الدمج", `تم الحفاظ على بيانات الجهاز وإضافة السجلات غير المكررة.\n\nالسجلات المتجاوزة لتكرار المعرّف: ${merged.summary.skippedVisits} زيارة، ${merged.summary.skippedEntities} جهة، ${merged.summary.skippedPlannedVisits} خطة.`); } }]);
    } catch (error) { Alert.alert("تعذر استيراد النسخة", error instanceof Error ? error.message : "اختر ملف JSON صادر من التطبيق."); }
    finally { setRestoreBusy(false); setTimeout(() => setRestoreStage("idle"), 900); }
  };
  const shareBackupByEmail = async () => {
    if (session?.role !== "manager") return;
    setBackupBusy(true);
    try {
      const current = backupMeta ?? await ensureDailyLocalBackup(data);
      setBackupMeta(current);
      await composeBackupEmail(current.uri, current.createdAt);
      Alert.alert("تم تجهيز البريد", `تم فتح رسالة بريد إلى ${BACKUP_RECIPIENT} وبداخلها النسخة الاحتياطية. اضغط إرسال من تطبيق البريد.`);
    } catch { Alert.alert("تعذر فتح البريد", "تأكد من وجود تطبيق بريد مهيأ على الهاتف ثم حاول مرة أخرى."); }
    finally { setBackupBusy(false); }
  };
  useEffect(() => {
    if (session?.role !== "manager" || loading) return;
    void createDailyBackup();
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(now.getDate() + 1);
    nextMidnight.setHours(0, 0, 5, 0);
    const timer = setTimeout(() => void createDailyBackup(), Math.max(1000, nextMidnight.getTime() - now.getTime()));
    return () => clearTimeout(timer);
  }, [session?.role, loading]);
  const activeRepresentative = session?.representativeId
    ? data.representatives.find((rep) => rep.id === session.representativeId)
    : undefined;
  const activeAccountName =
    session?.role === "manager"
      ? "مدير النظام"
      : (activeRepresentative?.name ?? "الحساب النشط");
  const activeAccountRole =
    session?.role === "manager"
      ? "صلاحية مدير النظام"
      : session?.impersonatedByManager
        ? "مندوب — دخول المدير"
        : "صلاحية مندوب";
  const confirmLogout = () =>
    Alert.alert(
      "تأكيد تسجيل الخروج",
      `هل تريد تسجيل الخروج من حساب «${activeAccountName}»؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: () => {
            void logout();
          },
        },
      ],
    );
  const changePassword = async () => {
    const validation = validateRepresentativePassword(newPassword);
    if (!validation.valid || !newPassword.trim()) {
      Alert.alert(
        "رمز مرور غير صالح",
        "أدخل رمزاً من 3 أحرف أو أرقام على الأقل.",
      );
      return;
    }
    if (session?.role === "manager")
      await saveManagerPassword(newPassword.trim());
    else if (session?.representativeId)
      await saveRepresentativePassword(
        session.representativeId,
        newPassword.trim(),
      );
    setNewPassword("");
    setPasswordModalVisible(false);
    setAccountMenuVisible(false);
    Alert.alert("تم التحديث", "تم تغيير رمز مرور الحساب النشط بنجاح.");
  };
  const todayVisits = visitsForDate(data.visits, new Date());
  const recentVisits = session?.role === "manager"
    ? todayVisits
    : todayVisits.filter((visit) => visit.representativeId === session?.representativeId);
  const activeReps = data.representatives.filter((rep) => rep.active);
  const monthlyOverrides = monthlyOverrideCounts(
    data.visits,
    data.representatives,
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayPlanned = data.plannedVisits.filter(
    (item) => item.scheduledDate === todayKey,
  );
  const todayOverrides = todayVisits.filter(
    (visit) => visit.managerOverride,
  ).length;
  const plannedCompleted = todayPlanned.filter((plan) =>
    todayVisits.some(
      (visit) =>
        visit.representativeId === plan.representativeId &&
        visit.entityId === plan.entityId,
    ),
  ).length;
  const remainingVisits = Math.max(0, todayPlanned.length - plannedCompleted);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="لوحة التحكم"
          subtitle="متابعة يومية سريعة لحالة الزيارات ونشاط الفريق"
          icon="dashboard"
          showBack={false}
          actionLabel="الحساب"
          actionIcon="account-circle"
          onAction={() => setAccountMenuVisible(true)}
        />
        <Pressable
          onPress={() => setAccountMenuVisible(true)}
          className="rounded-2xl bg-surface border border-border px-4 py-3 mb-5 flex-row-reverse items-center gap-3"
        >
          <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center overflow-hidden">
            {activeRepresentative?.photoUri ? (
              <Image
                source={{ uri: activeRepresentative.photoUri }}
                className="w-10 h-10"
              />
            ) : (
              <MaterialIcons name="account-circle" size={25} color="#1565C0" />
            )}
          </View>
          <View className="flex-1 items-end">
            <Text className="font-bold text-foreground">
              {activeAccountName}
            </Text>
            <Text className="text-xs text-primary mt-1">
              {activeAccountRole}
            </Text>
          </View>
          <MaterialIcons name="keyboard-arrow-down" size={22} color="#64748B" />
        </Pressable>
        <AssignedVisitsWindow />
        {session?.role === "manager" ? <View className="rounded-2xl bg-success/10 border border-success/25 p-4 mb-5"><View className="flex-row-reverse items-center gap-2"><MaterialIcons name="backup" size={22} color="#16835B" /><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">النسخة الاحتياطية اليومية</Text><Text className="text-xs text-muted text-right mt-1">تُحفظ محلياً عند فتح التطبيق، وتُجهّز عند منتصف الليل إذا كان التطبيق مفتوحاً.</Text></View></View><Text className="text-xs text-success font-semibold text-right mt-2">{backupMeta ? `آخر نسخة: ${formatArabicDate(backupMeta.createdAt)}` : backupBusy ? "جاري إنشاء النسخة..." : "لم تُنشأ نسخة اليوم بعد"}</Text><View className="flex-row-reverse gap-2 mt-3"><Pressable disabled={backupBusy || restoreBusy} onPress={() => void createDailyBackup(true)} className="flex-1 h-11 rounded-xl bg-foreground items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="save" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-[11px]">إنشاء الآن</Text></Pressable><Pressable disabled={backupBusy || restoreBusy} onPress={() => void shareBackupByEmail()} className="flex-1 h-11 rounded-xl bg-success items-center justify-center flex-row-reverse gap-1"><MaterialIcons name="email" size={17} color="#FFFFFF" /><Text className="text-white font-bold text-[11px]">فتح البريد</Text></Pressable></View><Pressable disabled={backupBusy || restoreBusy} onPress={() => void importBackup()} className="h-11 rounded-xl border border-primary bg-background items-center justify-center flex-row-reverse gap-2 mt-2"><MaterialIcons name="upload-file" size={18} color="#1565C0" /><Text className="text-primary font-bold text-xs">{restoreBusy ? "جاري قراءة النسخة..." : "استيراد نسخة JSON واستعادة البيانات"}</Text></Pressable></View> : null}
        <Modal visible={restoreStage !== "idle"} transparent animationType="fade" onRequestClose={() => undefined}><View className="flex-1 items-center justify-center bg-black/40 px-6"><View className="w-full rounded-3xl bg-background border border-border p-6 items-center"><ActivityIndicator size="large" color="#1565C0" /><Text className="text-lg font-bold text-foreground text-center mt-4">استرداد النسخة الاحتياطية</Text><Text className="text-sm text-muted text-center mt-2 leading-5">{restoreStageLabel}</Text><View className="w-full h-3 rounded-full bg-surface overflow-hidden mt-5"><View className={`h-full rounded-full ${restoreStage === "done" ? "bg-success" : "bg-primary"}`} style={{ width: restoreStage === "reading" ? "25%" : restoreStage === "waiting" ? "50%" : restoreStage === "merging" || restoreStage === "replacing" ? "75%" : "100%" }} /></View><Text className="text-xs text-muted text-center mt-3">لا تغلق التطبيق ولا تضغط زر الاسترداد مرة أخرى.</Text></View></View></Modal>
        <Modal
          visible={accountMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAccountMenuVisible(false)}
        >
          <Pressable
            onPress={() => setAccountMenuVisible(false)}
            className="flex-1 justify-end bg-black/35"
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              className="bg-background rounded-t-[28px] p-5"
            >
              <View className="flex-row-reverse items-center gap-3 mb-4">
                <View className="w-12 h-12 rounded-full bg-primary/15 items-center justify-center overflow-hidden">
                  {activeRepresentative?.photoUri ? (
                    <Image
                      source={{ uri: activeRepresentative.photoUri }}
                      className="w-12 h-12"
                    />
                  ) : (
                    <MaterialIcons
                      name="account-circle"
                      size={28}
                      color="#1565C0"
                    />
                  )}
                </View>
                <View className="flex-1 items-end">
                  <Text className="text-lg font-bold text-foreground text-right">
                    {activeAccountName}
                  </Text>
                  <Text className="text-sm text-primary text-right mt-1">
                    {activeAccountRole}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setAccountMenuVisible(false);
                  setPasswordModalVisible(true);
                }}
                className="h-13 rounded-xl bg-primary/10 items-center justify-center flex-row-reverse gap-2 mb-3"
              >
                <MaterialIcons name="lock-reset" size={20} color="#1565C0" />
                <Text className="text-primary font-bold">
                  تغيير كلمة المرور
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAccountMenuVisible(false);
                  confirmLogout();
                }}
                className="h-13 rounded-xl bg-error/10 items-center justify-center flex-row-reverse gap-2"
              >
                <MaterialIcons name="logout" size={20} color="#C0392B" />
                <Text className="text-error font-bold">تسجيل الخروج</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal visible={visitDetailsVisible} transparent animationType="slide" onRequestClose={() => setVisitDetailsVisible(false)}>
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] p-5 max-h-[85%]">
              <View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setVisitDetailsVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">تفاصيل الزيارة</Text><MaterialIcons name="location-on" size={24} color="#1565C0" /></View>
              {selectedRecentVisit ? <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 12 }}><View className="rounded-2xl bg-primary/10 border border-primary/20 p-4"><Text className="text-lg font-bold text-foreground text-right">{selectedRecentVisit.entityName}</Text><Text className="text-sm text-primary text-right mt-1">{selectedRecentVisit.entityKind}</Text></View><View className="rounded-2xl bg-surface border border-border p-4 gap-2"><Text className="text-sm text-foreground text-right">التاريخ والوقت: {formatArabicDate(selectedRecentVisit.recordedAt)}</Text><Text className="text-sm text-foreground text-right">الحالة: {selectedRecentVisit.verificationStatus === "verified" ? "مقبولة" : selectedRecentVisit.verificationStatus === "rejected" ? "مرفوضة" : "بانتظار التحقق"}</Text><Text className="text-sm text-foreground text-right">المزامنة: {selectedRecentVisit.offlineRecorded ? "محفوظة دون اتصال" : "محفوظة مع الاتصال"}</Text><Text className="text-sm text-foreground text-right">الأصناف: {selectedRecentVisit.visitedItems?.length ? selectedRecentVisit.visitedItems.join("، ") : "لا توجد أصناف مسجلة"}</Text><Text className="text-sm text-foreground text-right">الملاحظات: {selectedRecentVisit.notes || "لا توجد ملاحظات"}</Text></View></ScrollView> : null}
            </View>
          </View>
        </Modal>
        <Modal visible={visitEditVisible} transparent animationType="slide" onRequestClose={() => setVisitEditVisible(false)}>
          <View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setVisitEditVisible(false)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="text-xl font-bold text-foreground">تعديل ملاحظات الزيارة</Text><MaterialIcons name="edit" size={23} color="#1565C0" /></View><Text className="text-sm text-muted text-right mb-2">{selectedRecentVisit?.entityName ?? "الزيارة"}</Text><TextInput value={editVisitNotes} onChangeText={setEditVisitNotes} placeholder="أدخل ملاحظات الزيارة" placeholderTextColor="#7C8798" textAlign="right" multiline className="min-h-28 rounded-2xl border border-border bg-surface p-4 text-foreground" /><Pressable onPress={saveVisitEdit} className="h-14 rounded-2xl bg-success items-center justify-center mt-4"><Text className="text-white font-bold">حفظ التعديل</Text></Pressable></View></View>
        </Modal>
        <Modal
          visible={passwordModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPasswordModalVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/35">
            <View className="bg-background rounded-t-[28px] p-5">
              <Text className="text-lg font-bold text-foreground text-right mb-2">
                تغيير كلمة المرور
              </Text>
              <Text className="text-sm text-muted text-right mb-4">
                الحساب: {activeAccountName}
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="رمز المرور الجديد"
                secureTextEntry
                autoCapitalize="none"
                placeholderTextColor="#7C8798"
                textAlign="right"
                className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground mb-3"
              />
              <View className="flex-row-reverse gap-3">
                <Pressable
                  onPress={() => setPasswordModalVisible(false)}
                  className="flex-1 h-13 rounded-xl bg-surface border border-border items-center justify-center"
                >
                  <Text className="font-bold text-foreground">إلغاء</Text>
                </Pressable>
                <Pressable
                  onPress={() => void changePassword()}
                  className="flex-1 h-13 rounded-xl bg-success items-center justify-center"
                >
                  <Text className="text-white font-bold">حفظ</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View className="rounded-3xl bg-primary p-5 mb-5 overflow-hidden">
          <View className="flex-row-reverse items-start justify-between">
            <View className="items-end flex-1">
              <Text className="text-white/75 font-semibold text-right">
                مرحباً، {data.settings.managerName}
              </Text>
              <Text className="text-white text-2xl font-bold mt-1 text-right">
                ملخص اليوم
              </Text>
              <Text className="text-white/80 mt-2 text-sm text-right">
                {new Intl.DateTimeFormat("ar-EG", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date())}
              </Text>
            </View>
            <View className="w-12 h-12 rounded-2xl bg-white/15 items-center justify-center">
              <MaterialIcons name="insights" size={26} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View className="flex-row-reverse gap-3 mb-3">
          <MetricCard
            label="منفذة اليوم"
            value={loading ? "—" : todayVisits.length}
            icon="event-available"
          />
          <MetricCard
            label="مخططة اليوم"
            value={loading ? "—" : todayPlanned.length}
            icon="event-note"
            tone="success"
          />
          <MetricCard
            label="المتبقي"
            value={loading ? "—" : remainingVisits}
            icon="pending-actions"
            tone="warning"
          />
        </View>
        {session?.role === "manager" ? <View className="flex-row-reverse gap-3 mb-6">
          <MetricCard
            label="تجاوزات اليوم"
            value={loading ? "—" : todayOverrides}
            icon="gpp-maybe"
            tone="warning"
          />
          <MetricCard
            label="الجهات المسجلة"
            value={loading ? "—" : data.entities.length}
            icon="local-hospital"
            tone="success"
          />
          <MetricCard
            label="المندوبون النشطون"
            value={activeReps.length}
            icon="groups"
            tone="primary"
          />
        </View> : null}

        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-6">
          <View className="flex-row-reverse items-center justify-between mb-3">
            <Text className="text-lg font-bold text-primary">
              تقدم خطة اليوم
            </Text>
            <MaterialIcons name="trending-up" size={22} color="#1565C0" />
          </View>
          <Text className="text-sm text-muted text-right mb-3">
            تم تنفيذ {plannedCompleted} من أصل {todayPlanned.length} زيارة مخططة
            لهذا اليوم.
          </Text>
          <View className="h-3 rounded-full bg-white/70 overflow-hidden">
            <View
              className="h-3 rounded-full bg-primary"
              style={{
                width: `${todayPlanned.length ? Math.min(100, (plannedCompleted / todayPlanned.length) * 100) : 0}%`,
              }}
            />
          </View>
        </View>

        {session?.role === "manager" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-6">
          <View className="flex-row-reverse items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">
              نشاط المندوبين اليوم
            </Text>
            <MaterialIcons name="groups" size={22} color="#1565C0" />
          </View>
          <Text className="text-xs text-muted text-right mb-4">
            الزيارات المنفذة والمهام المسندة لكل مندوب
          </Text>
          <View className="gap-3">
            {activeReps.map((rep) => {
              const visits = todayVisits.filter(
                (visit) => visit.representativeId === rep.id,
              ).length;
              const assigned = data.plannedVisits.filter(
                (task) =>
                  task.scheduledDate === todayKey &&
                  task.representativeId === rep.id &&
                  task.assignmentType === "assigned",
              ).length;
              return (
                <View
                  key={rep.id}
                  className="rounded-xl bg-background border border-border p-3"
                >
                  <View className="flex-row-reverse items-center justify-between">
                    <Text className="font-bold text-foreground">
                      {rep.name}
                    </Text>
                    <View className="flex-row-reverse gap-2">
                      <Text className="text-xs text-success font-bold">
                        منفذة: {visits}
                      </Text>
                      <Text className="text-xs text-primary font-bold">
                        مسندة: {assigned}
                      </Text>
                    </View>
                  </View>
                  <View className="h-2 rounded-full bg-border mt-2 overflow-hidden">
                    <View
                      className="h-2 rounded-full bg-success"
                      style={{
                        width: `${todayPlanned.length ? Math.min(100, (visits / Math.max(1, todayPlanned.filter((item) => item.representativeId === rep.id).length)) * 100) : visits ? 100 : 0}%`,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View> : null}

        {session?.role === "manager" ? <View className="rounded-2xl bg-surface border border-border p-4 mb-6">
          <View className="flex-row-reverse items-center justify-between mb-3">
            <Text className="text-lg font-bold text-foreground">
              تجاوزات الموقع هذا الشهر
            </Text>
            <MaterialIcons name="bar-chart" size={22} color="#D97706" />
          </View>
          <Text className="text-xs text-muted text-right mb-4">
            نسبة تكرار التجاوزات بين المندوبين خلال الشهر الحالي
          </Text>
          <View className="gap-3">
            {monthlyOverrides.map((item, index) => (
              <View
                key={item.representative.id}
                className="flex-row-reverse items-center gap-2"
              >
                <Text
                  className="text-xs font-bold text-foreground w-20 text-right"
                  numberOfLines={1}
                >
                  {item.representative.name.replace("المندوب ", "مندوب ")}
                </Text>
                <View className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                  <View
                    className={`h-3 rounded-full ${index === 1 ? "bg-success" : index === 2 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${item.rate || (item.count ? 8 : 2)}%` }}
                  />
                </View>
                <Text className="text-xs font-bold text-muted w-12 text-left">
                  {item.count} ({item.rate}%)
                </Text>
              </View>
            ))}
          </View>
        </View> : null}

        <Pressable
          onPress={() => router.push("/record")}
          className="rounded-2xl bg-primary p-5 mb-6 flex-row-reverse items-center justify-between"
          style={({ pressed }) => [
            {
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <View className="w-11 h-11 rounded-xl bg-white/15 items-center justify-center">
            <MaterialIcons name="add-location-alt" size={24} color="#FFFFFF" />
          </View>
          <View className="items-end flex-1 mr-3">
            <Text className="text-white text-lg font-bold">
              تسجيل زيارة جديدة
            </Text>
            <Text className="text-white/75 text-sm mt-1">
              يُسجّل الوقت والموقع عند التأكيد
            </Text>
          </View>
          <MaterialIcons name="arrow-back-ios" size={17} color="#FFFFFF" />
        </Pressable>

        <View className="flex-row-reverse items-center justify-between mb-3">
          <Text className="text-lg font-bold text-foreground">
            آخر الزيارات
          </Text>
          <Pressable
            onPress={() => router.push("/visits")}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text className="text-primary font-bold">عرض الكل</Text>
          </Pressable>
        </View>

        {recentVisits.length === 0 ? (
          <View className="rounded-2xl bg-surface border border-border p-5 items-center">
            <View className="w-11 h-11 rounded-2xl bg-primary/10 items-center justify-center mb-3">
              <MaterialIcons name="event-note" size={23} color="#1565C0" />
            </View>
            <Text className="font-bold text-foreground">
              {session?.role === "manager" ? "لا توجد زيارات مسجلة اليوم" : "لا توجد زيارات مسجلة لك اليوم"}
            </Text>
            <Text className="text-sm text-muted text-center mt-1">
              ابدأ بإضافة جهة ثم سجّل أول زيارة.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {recentVisits.slice(0, 3).map((visit) => (
              <View key={visit.id} className="rounded-2xl bg-surface border border-border p-4 flex-row-reverse items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="location-on" size={20} color="#FFFFFF" /></View>
                <View className="items-end flex-1 min-w-0"><Text className="font-bold text-foreground text-right" numberOfLines={1}>{visit.entityName}</Text><Text className="text-xs text-muted mt-1 text-right" numberOfLines={1}>{visit.entityKind} · {formatArabicDate(visit.recordedAt)}</Text></View>
                <View className="flex-row-reverse gap-2"><Pressable onPress={() => openVisitDetails(visit)} accessibilityLabel="عرض تفاصيل الزيارة" className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center"><MaterialIcons name="visibility" size={18} color="#1565C0" /></Pressable><Pressable onPress={() => openVisitEdit(visit)} accessibilityLabel="تعديل الزيارة" className="w-9 h-9 rounded-xl bg-success/10 border border-success/20 items-center justify-center"><MaterialIcons name="edit" size={18} color="#16835B" /></Pressable></View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
