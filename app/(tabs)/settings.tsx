import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { scheduleReportReminder } from "@/lib/report-reminder";
import { deleteRepresentativePassword, saveRepresentativePassword } from "@/lib/representative-auth";
import { saveManagerPassword } from "@/lib/manager-auth";
import { validateRepresentativePassword } from "@/lib/representative-auth-validation";
import { useVisitStore } from "@/lib/visit-store";
import type { Representative } from "@/shared/visit-types";

const inputClass = "h-14 rounded-2xl border border-border bg-background px-4 text-foreground font-semibold mb-2";

export default function SettingsScreen() {
  const { data, addRepresentative, updateRepresentative, updateSettings, deleteRepresentative } = useVisitStore();
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
  const [representativePasswords, setRepresentativePasswords] = useState(data.representatives.map(() => ""));
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [newRepModal, setNewRepModal] = useState(false);
  const [newRep, setNewRep] = useState({ name: "", phone: "", email: "", username: "", password: "", photoUri: "" });
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);

  useEffect(() => {
    setRepresentativeNames(data.representatives.map((item) => item.name));
    setRepresentativePhones(data.representatives.map((item) => item.phone ?? ""));
    setRepresentativeEmails(data.representatives.map((item) => item.email ?? ""));
    setRepresentativeUsernames(data.representatives.map((item) => item.username ?? ""));
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
    if (!newRep.password.trim() || !validation.valid) { Alert.alert("كلمة مرور غير صالحة", "أدخل كلمة مرور جديدة لا تقل عن 6 أحرف."); return; }
    const representative: Representative = { id: `rep-${Date.now()}`, name, phone: newRep.phone.trim(), email: newRep.email.trim(), username: newRep.username.trim(), photoUri: newRep.photoUri || undefined, active: true };
    addRepresentative(representative);
    await saveRepresentativePassword(representative.id, newRep.password);
    setNewRep({ name: "", phone: "", email: "", username: "", password: "", photoUri: "" });
    setNewRepModal(false);
    Alert.alert("تمت الإضافة", "تمت إضافة المندوب وحفظ بياناته.");
  };

  const save = async () => {
    if (managerPassword.trim()) {
      try { await saveManagerPassword(managerPassword.trim()); } catch (error) { Alert.alert("كلمة مرور غير صالحة", error instanceof Error ? error.message : "أدخل كلمة مرور لا تقل عن 6 أحرف."); return; }
    }
    const radius = Math.max(50, Math.min(2000, Number(geofenceRadiusMeters) || 200));
    setGeofenceRadiusMeters(String(radius));
    updateSettings({ managerName: managerName.trim() || "مدير النظام", reportEmail: reportEmail.trim(), reminderTime: reminderTime.trim() || "18:00", geofenceRadiusMeters: radius, managerPin: managerPin.trim() });
    for (let index = 0; index < data.representatives.length; index += 1) {
      const item = data.representatives[index];
      const password = representativePasswords[index] ?? "";
      const validation = validateRepresentativePassword(password);
      if (!validation.valid) { Alert.alert("كلمة مرور غير صالحة", `${item.name}: ${validation.message}`); return; }
      updateRepresentative({ ...item, name: representativeNames[index]?.trim() || item.name, phone: representativePhones[index]?.trim(), email: representativeEmails[index]?.trim(), username: representativeUsernames[index]?.trim() });
      if (password.trim()) await saveRepresentativePassword(item.id, password);
    }
    try { await scheduleReportReminder(reminderTime.trim() || "18:00"); Alert.alert("تم حفظ الإعدادات", "تم حفظ بيانات المدير والمندوبين وضبط التذكير اليومي."); } catch { Alert.alert("تم الحفظ", "تم حفظ البيانات، لكن تعذر ضبط التذكير اليومي."); }
  };

  const backup = async () => {
    try { const file = new File(Paths.cache, `medical-visits-backup-${Date.now()}.json`); file.create({ overwrite: true }); file.write(JSON.stringify(data, null, 2)); if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة حفظ النسخة الاحتياطية."); return; } await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "حفظ نسخة احتياطية للزيارات" }); } catch { Alert.alert("تعذر إنشاء النسخة الاحتياطية", "حاول مرة أخرى بعد التأكد من مساحة التخزين."); }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="الإعدادات" subtitle="بيانات الفريق والتقارير والنسخ الاحتياطي" icon="settings" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse gap-3"><MaterialIcons name="security" size={21} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm leading-5">تُحفظ الزيارات والإعدادات على هذا الجهاز. كلمات مرور المندوبين تُحفظ في التخزين الآمن ولا تظهر في النسخة الاحتياطية العامة.</Text></View>
        <Text className="font-bold text-foreground text-right mb-3">إدارة النظام</Text>
        <FormField label="اسم مدير النظام" icon="admin-panel-settings" value={managerName} onChangeText={setManagerName} placeholder="مدير النظام" />
        <FormField label="بريد استلام التقرير" icon="email" value={reportEmail} onChangeText={setReportEmail} placeholder="example@company.com" />
        <FormField label="وقت تذكير تجهيز التقرير اليومي" icon="schedule" value={reminderTime} onChangeText={setReminderTime} placeholder="18:00" />
        <FormField label="نطاق قبول الزيارة بالمتر" icon="radar" value={geofenceRadiusMeters} onChangeText={setGeofenceRadiusMeters} placeholder="200" />
        <FormField label="PIN مدير النظام للتجاوز" icon="lock" value={managerPin} onChangeText={setManagerPin} placeholder="أنشئ PIN من 4 أرقام أو أكثر" />
        <View className="mb-3"><Text className="font-bold text-foreground text-right mb-2">كلمة مرور مدير النظام</Text><View className="flex-row-reverse items-center gap-2"><TextInput value={managerPassword} onChangeText={setManagerPassword} placeholder="اتركها فارغة للإبقاء على الحالية" secureTextEntry={!managerPasswordVisible} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setManagerPasswordVisible((value) => !value)} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={managerPasswordVisible ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View><Text className="text-xs text-muted text-right mt-1">يستخدم المدير هذه الكلمة للدخول أو لفتح حساب مندوب.</Text></View>
        <View className="flex-row-reverse items-center justify-between mb-3 mt-2"><Text className="font-bold text-foreground">المندوبون</Text><Pressable onPress={() => setNewRepModal(true)} className="rounded-xl bg-primary px-3 py-2 flex-row-reverse items-center gap-1"><MaterialIcons name="person-add" size={17} color="#FFFFFF" /><Text className="text-white text-xs font-bold">إضافة مندوب</Text></Pressable></View>
        {data.representatives.map((representative, index) => <View key={representative.id} className="mb-4 rounded-2xl bg-surface border border-border p-3"><View className="flex-row-reverse items-center gap-3 mb-3"><Pressable onPress={() => pickPhoto((uri) => updateRepresentative({ ...representative, photoUri: uri }))} className="w-14 h-14 rounded-full bg-primary/15 items-center justify-center overflow-hidden">{representative.photoUri ? <Image source={{ uri: representative.photoUri }} className="w-14 h-14" /> : <MaterialIcons name="person" size={28} color="#1565C0" />}</Pressable><View className="items-end flex-1"><Text className="font-bold text-foreground">مندوب {index + 1}</Text><Text className="text-xs text-muted mt-1">تعديل البيانات متاح في الحقول أدناه</Text></View><Pressable onPress={() => confirmDeleteRepresentative(representative)} className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center"><MaterialIcons name="delete-outline" size={21} color="#C0392B" /></Pressable></View><TextInput value={representativeNames[index] ?? ""} onChangeText={(value) => setRepresentativeNames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="اسم المندوب" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativePhones[index] ?? ""} onChangeText={(value) => setRepresentativePhones((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="رقم الهاتف" keyboardType="phone-pad" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativeEmails[index] ?? ""} onChangeText={(value) => setRepresentativeEmails((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="البريد الإلكتروني" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={representativeUsernames[index] ?? ""} onChangeText={(value) => setRepresentativeUsernames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="اسم المستخدم" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><View className="flex-row-reverse items-center gap-2"><TextInput value={representativePasswords[index] ?? ""} onChangeText={(value) => setRepresentativePasswords((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder="كلمة مرور جديدة (اختياري)" secureTextEntry={!visiblePasswords[representative.id]} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setVisiblePasswords((current) => ({ ...current, [representative.id]: !current[representative.id] }))} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={visiblePasswords[representative.id] ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View></View>)}
        <Pressable onPress={save} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الإعدادات والتذكير</Text></Pressable>
        <Text className="font-bold text-foreground text-right mb-3 mt-7">حفظ البيانات</Text><Pressable onPress={backup} className="h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="backup" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير نسخة احتياطية</Text></Pressable>
      </ScrollView>
      <Modal visible={newRepModal} transparent animationType="slide" onRequestClose={() => setNewRepModal(false)}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] p-5"><View className="flex-row-reverse justify-between items-center mb-4"><Text className="text-xl font-bold text-foreground">إضافة مندوب جديد</Text><Pressable onPress={() => setNewRepModal(false)}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable></View><Pressable onPress={() => pickPhoto((uri) => setNewRep((current) => ({ ...current, photoUri: uri })))} className="self-center w-20 h-20 rounded-full bg-primary/15 items-center justify-center overflow-hidden mb-3">{newRep.photoUri ? <Image source={{ uri: newRep.photoUri }} className="w-20 h-20" /> : <MaterialIcons name="add-a-photo" size={30} color="#1565C0" />}</Pressable><Text className="text-xs text-muted text-center mb-3">اختيار صورة شخصية (اختياري)</Text><TextInput value={newRep.name} onChangeText={(value) => setNewRep((current) => ({ ...current, name: value }))} placeholder="اسم المندوب *" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.phone} onChangeText={(value) => setNewRep((current) => ({ ...current, phone: value }))} placeholder="رقم الهاتف" keyboardType="phone-pad" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.email} onChangeText={(value) => setNewRep((current) => ({ ...current, email: value }))} placeholder="البريد الإلكتروني" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><TextInput value={newRep.username} onChangeText={(value) => setNewRep((current) => ({ ...current, username: value }))} placeholder="اسم المستخدم" autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={inputClass} /><View className="flex-row-reverse items-center gap-2"><TextInput value={newRep.password} onChangeText={(value) => setNewRep((current) => ({ ...current, password: value }))} placeholder="كلمة المرور *" secureTextEntry={!newPasswordVisible} autoCapitalize="none" placeholderTextColor="#7C8798" textAlign="right" className={`${inputClass} flex-1 mb-0`} /><Pressable onPress={() => setNewPasswordVisible((value) => !value)} className="w-12 h-12 rounded-xl bg-foreground items-center justify-center"><MaterialIcons name={newPasswordVisible ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View><Pressable onPress={saveNewRepresentative} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2 mt-4"><MaterialIcons name="person-add" size={20} color="#FFFFFF" /><Text className="text-white font-bold">حفظ المندوب</Text></Pressable></View></View></Modal>
    </ScreenContainer>
  );
}
