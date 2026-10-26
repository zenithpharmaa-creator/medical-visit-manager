import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { createLocalBackup } from "@/lib/local-backup";
import { mergeAppData, parseBackupJson, type MergeSummary, type RestoreSummary } from "@/lib/backup-validation";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { navigateWithLoading } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { SelectionModal } from "@/components/selection-modal";
import { scheduleReportReminder } from "@/lib/report-reminder";
import { deleteRepresentativePassword, saveRepresentativePassword } from "@/lib/representative-auth";
import { DEFAULT_ACCOUNT_PASSWORD, saveManagerPassword } from "@/lib/manager-auth";
import { validateRepresentativePassword } from "@/lib/representative-auth-validation";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import type { AppData, Representative } from "@/shared/visit-types";

const inputClass = "h-14 rounded-2xl border border-border bg-background px-4 text-foreground font-semibold mb-2";
const regionOptions = [{ label: "المنطقة الشمالية", value: "north" }, { label: "المنطقة الجنوبية", value: "south" }, { label: "المنطقة الوسطى", value: "central" }] as const;
const regionLabel = (value?: string) => regionOptions.find((item) => item.value === value)?.label ?? "المنطقة الوسطى";
const normalizeAssignedItems = (value: string) => Array.from(new Map(value.split("\n").map((item) => item.trim()).filter(Boolean).map((item) => [item.toLocaleLowerCase(), item])).values());

export default function SettingsScreen() {
  const { data, addRepresentative, updateRepresentative, updateSettings, deleteRepresentative, restoreData, resolvePasswordResetRequest } = useVisitStore();
  const { session, biometricEnabled, enableBiometric, disableBiometric } = useAccountSession();
  const insets = useSafeAreaInsets();
  const contentBottomPadding = Math.max(insets.bottom + 96, 120);
  const [managerName, setManagerName] = useState(data.settings.managerName);
  const [reportEmail, setReportEmail] = useState(data.settings.reportEmail);
  const [reminderTime, setReminderTime] = useState(data.settings.reminderTime);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(String(data.settings.geofenceRadiusMeters));
  const [managerPin, setManagerPin] = useState(data.settings.managerPin);
  const [managerPassword, setManagerPassword] = useState("");
  const [managerPasswordVisible, setManagerPasswordVisible] = useState(false);
  const [representativeNames, setRepresentativeNames] = useState(data.representatives.map((item) => item.name));
  const [representativePhones, setRepresentativePhones] = useState(data.representatives.map((item) => item.phone ?? ""));
  const [representativeEmails, setRepresentativeEmails] = useState(data.representatives.map((item) => item.email ?? ""));
  const [representativeUsernames, setRepresentativeUsernames] = useState(data.representatives.map((item) => item.username ?? ""));
  const [representativeRegions, setRepresentativeRegions] = useState(data.representatives.map((item) => item.region ?? "central"));
  const [representativeItems, setRepresentativeItems] = useState(data.representatives.map((item) => (item.assignedItems ?? []).join("\n")));
  const [regionModalIndex, setRegionModalIndex] = useState<number | null>(null);
  const [newRegionModal, setNewRegionModal] = useState(false);
  const [representativePasswords, setRepresentativePasswords] = useState(data.representatives.map(() => ""));
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [newRepModal, setNewRepModal] = useState(false);
  const [newRep, setNewRep] = useState({ name: "", phone: "", email: "", username: "", password: "", photoUri: "", region: "central" as "north" | "south" | "central" });
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [visitedItems, setVisitedItems] = useState<string[]>(data.settings.visitedItems ?? []);
  const [newVisitedItem, setNewVisitedItem] = useState("");
  const [restorePreview, setRestorePreview] = useState<{ data: AppData; summary: RestoreSummary } | null>(null);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setRepresentativeNames(data.representatives.map((item) => item.name));
    setRepresentativePhones(data.representatives.map((item) => item.phone ?? ""));
    setRepresentativeEmails(data.representatives.map((item) => item.email ?? ""));
    setRepresentativeUsernames(data.representatives.map((item) => item.username ?? ""));
    setRepresentativeRegions(data.representatives.map((item) => item.region ?? "central"));
    setRepresentativeItems(data.representatives.map((item) => (item.assignedItems ?? []).join("\n")));
  }, [data.representatives]);

  const pickPhoto = async (onSelected: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) onSelected(result.assets[0].uri);
  };

  const confirmDeleteRepresentative = (representative: Representative) => {
    Alert.alert("تأكيد حذف المندوب", `هل تريد حذف «${representative.name}»؟ سيتم حذف خططه وموقعه الحالي، بينما تبقى الزيارات التاريخية في التقارير.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف المندوب", style: "destructive", onPress: async () => { deleteRepresentative(representative.id); await deleteRepresentativePassword(representative.id); Alert.alert("تم الحذف", "تم حذف المندوب من القائمة."); } },
    ]);
  };

  const saveNewRepresentative = async () => {
    const name = newRep.name.trim();
    if (!name) { Alert.alert("بيانات ناقصة", "أدخل اسم المندوب أولاً."); return; }
    const validation = validateRepresentativePassword(newRep.password);
    if (!validation.valid) { Alert.alert("كلمة مرور غير صالحة", "أدخل كلمة مرور من 3 أحرف أو أرقام على الأقل."); return; }
    const representative: Representative = { id: `rep-${Date.now()}`, name, phone: newRep.phone.trim(), email: newRep.email.trim(), username: newRep.username.trim(), photoUri: newRep.photoUri || undefined, region: newRep.region, assignedItems: [], active: true };
    addRepresentative(representative);
    await saveRepresentativePassword(representative.id, newRep.password);
    setNewRep({ name: "", phone: "", email: "", username: "", password: "", photoUri: "", region: "central" });
    setNewRepModal(false);
    Alert.alert("تمت الإضافة", "تمت إضافة المندوب وحفظ بياناته.");
  };

  const addVisitedItem = () => {
    const item = newVisitedItem.trim();
    if (!item) return;
    if (visitedItems.some((existing) => existing.toLowerCase() === item.toLowerCase())) { Alert.alert("الصنف موجود", "هذا الصنف مضاف بالفعل إلى القائمة."); return; }
    setVisitedItems((current) => [...current, item]);
    setNewVisitedItem("");
  };

  const removeVisitedItem = (item: string) => setVisitedItems((current) => current.filter((existing) => existing !== item));

  const resetPasswordRequest = async (request: NonNullable<AppData["passwordResetRequests"]>[number]) => {
    try {
      if (request.accountType === "manager") await saveManagerPassword(DEFAULT_ACCOUNT_PASSWORD);
      else if (request.representativeId) await saveRepresentativePassword(request.representativeId, DEFAULT_ACCOUNT_PASSWORD);
      else { Alert.alert("تعذر إعادة الضبط", "لا يوجد معرف صالح للمندوب في هذا الطلب."); return; }
      resolvePasswordResetRequest(request.id, "approved", "اعتمد مدير النظام الطلب وأعاد كلمة المرور إلى 123.");
      Alert.alert("تمت إعادة الضبط", `تمت إعادة كلمة مرور ${request.accountLabel} إلى 123. يجب تغييرها من الإعدادات بعد الدخول.`);
    } catch (error) {
      Alert.alert("تعذر إعادة الضبط", error instanceof Error ? error.message : "حدث خطأ أثناء إعادة ضبط كلمة المرور.");
    }
  };

  const dismissPasswordResetRequest = (request: NonNullable<AppData["passwordResetRequests"]>[number]) => {
    Alert.alert("تجاهل طلب الاستعادة", `هل تريد تجاهل طلب ${request.accountLabel}؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "تجاهل الطلب", style: "destructive", onPress: () => { resolvePasswordResetRequest(request.id, "dismissed", "تم تجاهل الطلب من مدير النظام."); Alert.alert("تم التجاهل", "تم تحديث حالة طلب الاستعادة."); } },
    ]);
  };

  const save = async () => {
    if (managerPassword.trim()) {
      try { await saveManagerPassword(managerPassword.trim()); } catch (error) { Alert.alert("كلمة مرور غير صالحة", error instanceof Error ? error.message : "أدخل كلمة مرور من 3 أحرف أو أرقام على الأقل."); return; }
    }
    const radius = Math.max(50, Math.min(2000, Number(geofenceRadiusMeters) || 200));
    setGeofenceRadiusMeters(String(radius));
    updateSettings({ managerName: managerName.trim() || "مدير النظام", reportEmail: reportEmail.trim(), reminderTime: reminderTime.trim() || "18:00", geofenceRadiusMeters: radius, managerPin: managerPin.trim(), visitedItems });
    for (let index = 0; index < data.representatives.length; index += 1) {
      const item = data.representatives[index];
      const password = representativePasswords[index] ?? "";
      const validation = validateRepresentativePassword(password);
      if (!validation.valid) { Alert.alert("كلمة مرور غير صالحة", `${item.name}: ${validation.message}`); return; }
      updateRepresentative({ ...item, name: representativeNames[index]?.trim() || item.name, phone: representativePhones[index]?.trim(), email: representativeEmails[index]?.trim(), username: representativeUsernames[index]?.trim(), region: representativeRegions[index] ?? "central", assignedItems: normalizeAssignedItems(representativeItems[index] ?? "") });
      if (password.trim()) await saveRepresentativePassword(item.id, password);
    }
    try { await scheduleReportReminder(reminderTime.trim() || "18:00"); Alert.alert("تم حفظ الإعدادات", "تم حفظ بيانات المدير والمندوبين وضبط التذكير اليومي."); } catch { Alert.alert("تم الحفظ", "تم حفظ البيانات، لكن تعذر ضبط التذكير اليومي."); }
  };

  const restoreBackup = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    setRestoreProgress(5);
    setRestoreStatus("اختيار ملف النسخة الاحتياطية...");
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled) return;
      setRestoreProgress(20);
      setRestoreStatus("قراءة الملف دون تعديل البيانات الحالية...");
      await new Promise((resolve) => setTimeout(resolve, 0));
      const text = await new File(result.assets[0].uri).text();
      setRestoreProgress(55);
      setRestoreStatus("فحص بنية النسخة وحساب السجلات...");
      await new Promise((resolve) => setTimeout(resolve, 0));
      const parsed = parseBackupJson(text);
      setRestoreProgress(100);
      setRestoreStatus("تمت القراءة. اختر طريقة المتابعة.");
      setRestorePreview(parsed);
    } catch (error) {
      Alert.alert("تعذر قراءة النسخة", error instanceof Error ? error.message : "تأكد من اختيار ملف JSON صادر من التطبيق.");
    } finally {
      setIsRestoring(false);
    }
  };

  const applyRestore = async (mode: "merge" | "replace") => {
    if (!restorePreview || isRestoring) return;
    setIsRestoring(true);
    setRestoreProgress(15);
    setRestoreStatus(mode === "merge" ? "مطابقة السجلات ومنع التكرار..." : "تجهيز الاستبدال الكامل...");
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      let mergeSummary: MergeSummary | null = null;
      if (mode === "merge") {
        const merged = mergeAppData(data, restorePreview.data);
        mergeSummary = merged.summary;
        setRestoreProgress(75);
        setRestoreStatus("حفظ البيانات المدمجة...");
        restoreData(merged.data);
      } else {
        restoreData(restorePreview.data);
        setRestoreProgress(75);
        setRestoreStatus("حفظ النسخة المستعادة...");
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      setRestoreProgress(100);
      setRestoreStatus("اكتملت الاستعادة بنجاح.");
      setRestorePreview(null);
      Alert.alert("اكتملت الاستعادة", mode === "merge" && mergeSummary ? `تمت الاستعادة مع دمج السجلات. المكرر المتجاوز: ${mergeSummary.skippedEntities} جهة و${mergeSummary.skippedVisits} زيارة.` : "تمت استعادة بيانات النسخة الاحتياطية.");
    } catch (error) {
      Alert.alert("تعذر إكمال الاستعادة", error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات.");
    } finally {
      setIsRestoring(false);
    }
  };

  const backup = async () => {
    try { const meta = await createLocalBackup(data); if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة حفظ النسخة الاحتياطية."); return; } await Sharing.shareAsync(meta.uri, { mimeType: "application/json", dialogTitle: "حفظ نسخة احتياطية للبيانات والمواقع المشتركة" }); Alert.alert("تم إنشاء النسخة", `تتضمن النسخة ${data.savedLocations?.length ?? 0} موقعاً مشتركاً مستقلاً مع بقية البيانات.`); } catch { Alert.alert("تعذر إنشاء النسخة الاحتياطية", "حاول مرة أخرى بعد التأكد من مساحة التخزين."); }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: contentBottomPadding }} showsVerticalScrollIndicator={false} scrollIndicatorInsets={{ bottom: contentBottomPadding }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="الإعدادات" subtitle="بيانات الفريق والتقارير والنسخ الاحتياطي" icon="settings" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse gap-3"><MaterialIcons name="security" size={21} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm leading-5">تُحفظ الزيارات والإعدادات على هذا الجهاز. كلمات مرور المندوبين تُحفظ في التخزين الآمن ولا تظهر في النسخة الاحتياطية العامة.</Text></View>
        <View className="rounded-2xl bg-surface border border-border p-4 mb-5 flex-row-reverse items-center gap-3"><MaterialIcons name="fingerprint" size={25} color="#1565C0" /><View className="flex-1"><Text className="font-bold text-foreground text-right">الدخول بالبصمة أو الوجه</Text><Text className="text-xs text-muted text-right mt-1">يتطلب تفعيل البصمة أو التعرف على الوجه في إعدادات الهاتف. يبقى رمز المرور متاحاً كخيار بديل.</Text></View><Switch value={biometricEnabled} onValueChange={async (enabled) => { if (enabled) { const ok = await enableBiometric(); if (!ok) Alert.alert("تعذر التفعيل", "أكمل تسجيل بصمة أو وجه على الجهاز ثم حاول مرة أخرى."); } else await disableBiometric(); }} trackColor={{ false: "#CBD5E1", true: "#90CAF9" }} thumbColor={biometricEnabled ? "#1565C0" : "#F8FAFC"} accessibilityLabel="تفعيل الدخول بالبصمة أو الوجه" /></View>
        <Pressable onPress={() => navigateWithLoading("/device-activation")} className="rounded-2xl bg-primary/10 border border-primary/25 p-4 mb-3 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><View className="w-11 h-11 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="phonelink-lock" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-primary text-right">{session?.role === "manager" ? "تفعيل أجهزة المندوبين" : "تفعيل جهاز المزامنة"}</Text><Text className="text-xs text-muted text-right mt-1">{session?.role === "manager" ? "إنشاء رمز أو QR ومراجعة الأجهزة المتصلة" : "أدخل رمز المدير لربط هذا الجهاز بالمزامنة"}</Text></View><MaterialIcons name="chevron-left" size={23} color="#1257A6" /></Pressable>
        <Pressable onPress={() => navigateWithLoading("/sync-history")} className="rounded-2xl bg-surface border border-border p-4 mb-5 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}><View className="w-11 h-11 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name="history" size={22} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right">سجل المزامنة</Text><Text className="text-xs text-muted text-right mt-1">عرض آخر العمليات والتعارضات السابقة</Text></View><MaterialIcons name="chevron-left" size={23} color="#64748B" /></Pressable>
        <Text className="font-bold text-foreground text-right mb-3">إدارة النظام</Text>
        <View className="rounded-2xl bg-surface border border-border p-4 mb-5">
          <Text className="font-bold text-foreground text-right">الأصناف المزارة</Text>
          <Text className="text-xs text-muted text-right mt-1 mb-3">أضف الأصناف التي سيختارها المدير والمندوب عند تسجيل الزيارة.</Text>
          <View className="flex-row-reverse items-center gap-2 mb-3"><TextInput value={newVisitedItem} onChangeText={setNewVisitedItem} onSubmitEditing={addVisitedItem} returnKeyType="done" placeholder="مثال: صنف دوائي أو منتج" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={addVisitedItem} className="w-12 h-12 rounded-xl bg-primary items-center justify-center"><MaterialIcons name="add" size={22} color="#FFFFFF" /></Pressable></View>
          <View className="flex-row-reverse flex-wrap gap-2">{visitedItems.map((item) => <View key={item} className="rounded-full bg-primary/10 border border-primary/20 px-3 py-2 flex-row-reverse items-center gap-2"><Text className="text-primary font-bold text-xs">{item}</Text><Pressable onPress={() => removeVisitedItem(item)}><MaterialIcons name="close" size={15} color="#C0392B" /></Pressable></View>)}</View>
          {!visitedItems.length ? <Text className="text-xs text-muted text-right">لم تتم إضافة أصناف بعد.</Text> : null}
        </View>
        <FormField label="اسم مدير النظام" icon="admin-panel-settings" value={managerName} onChangeText={setManagerName} placeholder="مدير النظام" />
        <FormField label="بريد استلام التقرير" icon="email" value={reportEmail} onChangeText={setReportEmail} placeholder="example@company.com" />
        <FormField label="وقت تذكير تجهيز التقرير اليومي" icon="schedule" value={reminderTime} onChangeText={setReminderTime} placeholder="18:00" />
        <FormField label="نطاق قبول الزيارة بالمتر" icon="radar" value={geofenceRadiusMeters} onChangeText={setGeofenceRadiusMeters} placeholder="200" />
        <FormField label="PIN مدير النظام للتجاوز" icon="lock" value={managerPin} onChangeText={setManagerPin} placeholder="أنشئ PIN من 4 أرقام أو أكثر" />
        <View className="mb-3"><Text className="font-bold text-foreground text-right mb-2">كلمة مرور مدير النظام</Text><View className="flex-row-reverse items-center gap-2"><TextInput value={managerPassword} onChangeText={setManagerPassword} placeholder="123 افتراضياً — اكتب قيمة جديدة للتغيير" secureTextEntry={!managerPasswordVisible} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setManagerPasswordVisible((value) => !value)} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={managerPasswordVisible ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View><Text className="text-xs text-muted text-right mt-1">يستخدم المدير هذه الكلمة للدخول أو لفتح حساب مندوب.</Text></View>
        <View className="flex-row-reverse items-center justify-between mb-3 mt-2"><Text className="font-bold text-foreground">المندوبون</Text><Pressable onPress={() => setNewRepModal(true)} className="rounded-xl bg-primary px-3 py-2 flex-row-reverse items-center gap-1"><MaterialIcons name="person-add" size={17} color="#FFFFFF" /><Text className="text-white text-xs font-bold">إضافة مندوب</Text></Pressable></View>
        {data.representatives.map((representative, index) => <View key={representative.id} className="mb-4 rounded-2xl bg-surface border border-border p-3"><View className="flex-row-reverse items-center gap-3 mb-3"><Pressable onPress={() => pickPhoto((uri) => updateRepresentative({ ...representative, photoUri: uri }))} className="w-14 h-14 rounded-full bg-primary/15 items-center justify-center overflow-hidden">{representative.photoUri ? <Image source={{ uri: representative.photoUri }} className="w-14 h-14" /> : <MaterialIcons name="person" size={28} color="#1565C0" />}</Pressable><View className="items-end flex-1"><Text className="font-bold text-foreground">مندوب {index + 1}</Text><Text className="text-xs text-primary mt-1 font-bold">{normalizeAssignedItems(representativeItems[index] ?? "").length} صنف مخصص</Text><Text className="text-xs text-muted mt-1">تعديل البيانات متاح في الحقول أدناه</Text></View><Pressable onPress={() => confirmDeleteRepresentative(representative)} className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center"><MaterialIcons name="delete-outline" size={21} color="#C0392B" /></Pressable></View><TextInput value={representativeNames[index] ?? ""} onChangeText={(value) => setRepresentativeNames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="اسم المندوب" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativePhones[index] ?? ""} onChangeText={(value) => setRepresentativePhones((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="رقم الهاتف" keyboardType="phone-pad" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativeEmails[index] ?? ""} onChangeText={(value) => setRepresentativeEmails((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="البريد الإلكتروني" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativeUsernames[index] ?? ""} onChangeText={(value) => setRepresentativeUsernames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="اسم المستخدم" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><Text className="font-bold text-foreground text-right mb-2">الأصناف الخاصة بهذا المندوب</Text><TextInput value={representativeItems[index] ?? ""} onChangeText={(value) => setRepresentativeItems((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="اكتب صنفاً في كل سطر" placeholderTextColor="#7C8798" textAlign="right" multiline numberOfLines={4} className={`${inputClass} h-28`} /><Pressable onPress={() => setRegionModalIndex(index)} className="h-14 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between mb-2"><Text className="font-semibold text-foreground">{regionLabel(representativeRegions[index])}</Text><Text className="text-xs text-muted">منطقة العمل</Text></Pressable><View className="flex-row-reverse items-center gap-2"><TextInput value={representativePasswords[index] ?? ""} onChangeText={(value) => setRepresentativePasswords((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="123 افتراضياً — اكتب قيمة جديدة للتغيير" secureTextEntry={!visiblePasswords[representative.id]} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setVisiblePasswords((current) => ({ ...current, [representative.id]: !current[representative.id] }))} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={visiblePasswords[representative.id] ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View></View>)}
        {session?.role === "manager" ? <View className="rounded-2xl bg-warning/10 border border-warning/25 p-4 mb-5"><View className="flex-row-reverse items-center gap-2 mb-3"><MaterialIcons name="lock-reset" size={22} color="#B45309" /><View className="flex-1"><Text className="font-bold text-foreground text-right">طلبات استعادة كلمات المرور</Text><Text className="text-xs text-muted text-right mt-1">يستطيع المدير اعتماد إعادة الضبط إلى 123 أو تجاهل الطلب.</Text></View><View className="rounded-full bg-warning px-3 py-1"><Text className="text-white font-bold">{(data.passwordResetRequests ?? []).filter((request) => request.status === "pending").length}</Text></View></View>{(data.passwordResetRequests ?? []).filter((request) => request.status === "pending").length ? (data.passwordResetRequests ?? []).filter((request) => request.status === "pending").map((request) => <View key={request.id} className="rounded-xl bg-background border border-warning/25 p-3 mb-2"><Text className="font-bold text-foreground text-right">{request.accountLabel}</Text><Text className="text-xs text-muted text-right mt-1">طلب في {new Date(request.requestedAt).toLocaleString("ar-YE")}</Text><View className="flex-row-reverse gap-2 mt-3"><Pressable onPress={() => void resetPasswordRequest(request)} className="flex-1 h-10 rounded-xl bg-success items-center justify-center flex-row-reverse gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}><MaterialIcons name="lock-reset" size={17} color="#FFFFFF" /><Text className="text-white text-xs font-bold">إعادة إلى 123</Text></Pressable><Pressable onPress={() => dismissPasswordResetRequest(request)} className="flex-1 h-10 rounded-xl bg-surface border border-border items-center justify-center" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}><Text className="text-foreground text-xs font-bold">تجاهل</Text></Pressable></View></View>) : <Text className="text-xs text-muted text-right">لا توجد طلبات معلقة حالياً.</Text>}</View> : null}
        <Pressable onPress={save} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الإعدادات والتذكير</Text></Pressable>
        <Text className="font-bold text-foreground text-right mb-3 mt-7">حفظ واستعادة البيانات</Text><Pressable onPress={backup} className="h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="backup" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير نسخة احتياطية</Text></Pressable><Pressable onPress={restoreBackup} disabled={isRestoring} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mt-2" style={({ pressed }) => [{ opacity: pressed || isRestoring ? 0.7 : 1 }]}><MaterialIcons name={isRestoring ? "hourglass-top" : "restore"} size={21} color="#FFFFFF" /><Text className="text-white font-bold">{isRestoring ? "جاري تجهيز النسخة..." : "استيراد واستعادة نسخة JSON"}</Text></Pressable>
      </ScrollView>
      <Modal visible={newRepModal} transparent animationType="slide" onRequestClose={() => setNewRepModal(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse justify-between items-center mb-4"><Text className="text-xl font-bold text-foreground">إضافة مندوب جديد</Text><Pressable onPress={() => setNewRepModal(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><Pressable onPress={() => pickPhoto((uri) => setNewRep((current) => ({ ...current, photoUri: uri })))} className="self-center w-20 h-20 rounded-full bg-primary/15 items-center justify-center overflow-hidden mb-3">{newRep.photoUri ? <Image source={{ uri: newRep.photoUri }} className="w-20 h-20" /> : <MaterialIcons name="add-a-photo" size={30} color="#1565C0" />}</Pressable><Text className="text-xs text-muted text-center mb-3">اختيار صورة شخصية (اختياري)</Text><TextInput value={newRep.name} onChangeText={(value) => setNewRep((current) => ({ ...current, name: value }))} placeholder="اسم المندوب *" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.phone} onChangeText={(value) => setNewRep((current) => ({ ...current, phone: value }))} placeholder="رقم الهاتف" keyboardType="phone-pad" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.email} onChangeText={(value) => setNewRep((current) => ({ ...current, email: value }))} placeholder="البريد الإلكتروني" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.username} onChangeText={(value) => setNewRep((current) => ({ ...current, username: value }))} placeholder="اسم المستخدم" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><Pressable onPress={() => setNewRegionModal(true)} className="h-14 rounded-2xl border border-border bg-surface px-4 flex-row-reverse items-center justify-between mb-2"><Text className="font-semibold text-foreground">{regionLabel(newRep.region)}</Text><Text className="text-xs text-muted">منطقة العمل</Text></Pressable><View className="flex-row-reverse items-center gap-2"><TextInput value={newRep.password} onChangeText={(value) => setNewRep((current) => ({ ...current, password: value }))} placeholder="123 افتراضياً — اختياري للتغيير" secureTextEntry={!newPasswordVisible} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setNewPasswordVisible((value) => !value)} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={newPasswordVisible ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View><Pressable onPress={saveNewRepresentative} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2 mt-4"><MaterialIcons name="person-add" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ المندوب</Text></Pressable></View></View></Modal><Modal visible={restorePreview !== null} animationType="slide" onRequestClose={() => { if (!isRestoring) setRestorePreview(null); }}><View className="flex-1 bg-background"><View className="px-5 pt-5 pb-3 flex-row-reverse items-center justify-between border-b border-border"><Pressable disabled={isRestoring} onPress={() => setRestorePreview(null)} className="w-10 h-10 rounded-xl bg-surface items-center justify-center" style={({ pressed }) => [{ opacity: pressed || isRestoring ? 0.5 : 1 }]}><MaterialIcons name="close" size={23} color="#102A43" /></Pressable><View className="flex-1 items-end mr-3"><Text className="text-xl font-bold text-foreground text-right">معاينة النسخة الاحتياطية</Text><Text className="text-xs text-muted text-right mt-1">لا يتم تعديل البيانات قبل اختيار الدمج أو الاستبدال</Text></View></View>{restorePreview ? <><View className="mx-5 mt-4 rounded-2xl bg-primary/10 border border-primary/20 p-4"><Text className="font-bold text-primary text-right">البيانات الموجودة في الملف</Text><Text className="text-xs text-muted text-right mt-2">المندوبون: {restorePreview.summary.representatives} · الجهات: {restorePreview.summary.entities}</Text><Text className="text-xs text-muted text-right mt-1">الزيارات: {restorePreview.summary.visits} · الخطط: {restorePreview.summary.plannedVisits}</Text></View><FlatList data={restorePreview.data.entities.slice(0, 50)} keyExtractor={(item: AppData["entities"][number], index: number) => `restore-preview-${item.id}-${index}`} contentContainerStyle={{ padding: 18, gap: 10 }} ListHeaderComponent={<Text className="font-bold text-foreground text-right">معاينة أول {Math.min(50, restorePreview.data.entities.length)} جهة من أصل {restorePreview.data.entities.length}</Text>} renderItem={({ item, index }: { item: AppData["entities"][number]; index: number }) => <View className="rounded-2xl bg-surface border border-border p-4"><View className="flex-row-reverse items-start gap-3"><View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center"><Text className="text-primary font-bold text-xs">{index + 1}</Text></View><View className="flex-1 items-end"><Text className="font-bold text-foreground text-right" numberOfLines={2}>{item.name}</Text><Text className="text-xs text-primary text-right mt-1">{item.kind}</Text></View></View><Text className="text-xs text-muted text-right mt-2">العنوان: {item.address || "غير موجود"}</Text><Text className="text-xs text-muted text-right mt-1">الإحداثيات: {item.geographicCoordinates ? `${item.geographicCoordinates.latitude}, ${item.geographicCoordinates.longitude}` : "غير موجودة"}</Text></View>} /></> : null}<View className="px-5 pt-3 pb-5 border-t border-border bg-background"><View className="flex-row-reverse gap-2"><Pressable disabled={isRestoring} onPress={() => setRestorePreview(null)} className="flex-1 h-12 rounded-xl bg-surface border border-border items-center justify-center"><Text className="text-foreground font-bold text-xs">إلغاء</Text></Pressable><Pressable disabled={isRestoring} onPress={() => void applyRestore("merge")} className="flex-1 h-12 rounded-xl bg-primary items-center justify-center" style={({ pressed }) => [{ opacity: pressed || isRestoring ? 0.65 : 1 }]}><Text className="text-white font-bold text-xs">دمج ذكي</Text></Pressable><Pressable disabled={isRestoring} onPress={() => void applyRestore("replace")} className="flex-1 h-12 rounded-xl bg-error items-center justify-center" style={({ pressed }) => [{ opacity: pressed || isRestoring ? 0.65 : 1 }]}><Text className="text-white font-bold text-xs">استبدال</Text></Pressable></View></View></View></Modal><Modal visible={isRestoring} transparent animationType="fade"><View className="flex-1 bg-black/35 items-center justify-center px-6"><View className="w-full rounded-3xl bg-background p-6 items-center"><ActivityIndicator size="large" color="#1565C0" /><Text className="font-bold text-foreground text-center mt-4">{restoreStatus || "جاري معالجة النسخة..."}</Text><Text className="text-xs text-muted text-center mt-2">التقدم: {restoreProgress}%</Text><View className="w-full h-3 rounded-full bg-surface overflow-hidden mt-4"><View className="h-3 rounded-full bg-primary" style={{ width: `${restoreProgress}%` }} /></View><Text className="text-xs text-muted text-center mt-3">لا تغلق البرنامج حتى تكتمل العملية.</Text></View></View></Modal><SelectionModal visible={regionModalIndex !== null} title="منطقة عمل المندوب" options={regionOptions.map((item) => ({ label: item.label, value: item.value }))} selected={regionModalIndex === null ? undefined : representativeRegions[regionModalIndex]} onClose={() => setRegionModalIndex(null)} onSelect={(option) => { if (regionModalIndex !== null) setRepresentativeRegions((current) => current.map((item, itemIndex) => itemIndex === regionModalIndex ? option.value as "north" | "south" | "central" : item)); setRegionModalIndex(null); }} /><SelectionModal visible={newRegionModal} title="منطقة عمل المندوب الجديد" options={regionOptions.map((item) => ({ label: item.label, value: item.value }))} selected={newRep.region} onClose={() => setNewRegionModal(false)} onSelect={(option) => { setNewRep((current) => ({ ...current, region: option.value as "north" | "south" | "central" })); setNewRegionModal(false); }} />
    </ScreenContainer>
  );
}
