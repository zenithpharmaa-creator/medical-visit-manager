import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormField } from "@/components/form-field";
import { ScreenHeader } from "@/components/screen-header";
import { ScreenContainer } from "@/components/screen-container";
import { scheduleReportReminder } from "@/lib/report-reminder";
import { useVisitStore } from "@/lib/visit-store";

export default function SettingsScreen() {
  const { data, updateRepresentative, updateSettings } = useVisitStore();
  const [managerName, setManagerName] = useState(data.settings.managerName);
  const [reportEmail, setReportEmail] = useState(data.settings.reportEmail);
  const [reminderTime, setReminderTime] = useState(data.settings.reminderTime);
  const [representativeNames, setRepresentativeNames] = useState(data.representatives.map((item) => item.name));
  useEffect(() => { setRepresentativeNames(data.representatives.map((item) => item.name)); }, [data.representatives]);

  const save = async () => {
    updateSettings({ managerName: managerName.trim() || "مدير النظام", reportEmail: reportEmail.trim(), reminderTime: reminderTime.trim() || "18:00" });
    data.representatives.forEach((item, index) => updateRepresentative({ ...item, name: representativeNames[index]?.trim() || item.name }));
    try {
      await scheduleReportReminder(reminderTime.trim() || "18:00");
      Alert.alert("تم حفظ الإعدادات", "تم حفظ البيانات وضبط تذكير يومي لفتح التقرير وإرساله عبر البريد.");
    } catch {
      Alert.alert("تم حفظ الإعدادات", "تم حفظ البيانات. تعذر ضبط التذكير؛ تأكد من صيغة الوقت مثل 18:00 ومن إذن التنبيهات.");
    }
  };

  const backup = async () => {
    try {
      const file = new File(Paths.cache, `medical-visits-backup-${Date.now()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(data, null, 2));
      if (!(await Sharing.isAvailableAsync())) { Alert.alert("المشاركة غير متاحة", "تعذر فتح نافذة حفظ النسخة الاحتياطية على هذا الجهاز."); return; }
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "حفظ نسخة احتياطية للزيارات" });
    } catch { Alert.alert("تعذر إنشاء النسخة الاحتياطية", "حاول مرة أخرى بعد التأكد من مساحة التخزين."); }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="الإعدادات" subtitle="بيانات الفريق والتقارير والنسخ الاحتياطي" icon="settings" />
        <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse gap-3"><MaterialIcons name="security" size={21} color="#1565C0" /><Text className="flex-1 text-right text-primary text-sm leading-5">تُحفظ الزيارات والإعدادات في ذاكرة التطبيق على هذا الجهاز. أنشئ نسخة احتياطية دورياً قبل تغيير الهاتف أو حذْف التطبيق.</Text></View>
        <Text className="font-bold text-foreground text-right mb-3">إدارة النظام</Text>
        <FormField label="اسم مدير النظام" icon="admin-panel-settings" value={managerName} onChangeText={setManagerName} placeholder="مدير النظام" />
        <FormField label="بريد استلام التقرير" icon="email" value={reportEmail} onChangeText={setReportEmail} placeholder="example@company.com" />
        <FormField label="وقت تذكير تجهيز التقرير اليومي" icon="schedule" value={reminderTime} onChangeText={setReminderTime} placeholder="18:00" />
        <Text className="font-bold text-foreground text-right mb-3 mt-1">المندوبون</Text>
        {data.representatives.map((representative, index) => <View key={representative.id} className="mb-4"><View className="flex-row-reverse items-center gap-2 mb-2"><View className="w-7 h-7 rounded-lg bg-primary items-center justify-center"><MaterialIcons name="person" size={15} color="#FFFFFF" /></View><Text className="font-bold text-foreground">مندوب {index + 1}</Text></View><TextInput value={representativeNames[index] ?? ""} onChangeText={(value) => setRepresentativeNames((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder={`اسم المندوب ${index + 1}`} placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-surface px-4 text-foreground font-semibold" /></View>)}
        <Pressable onPress={save} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="save" size={21} color="#FFFFFF" /><Text className="text-white font-bold">حفظ الإعدادات والتذكير</Text></Pressable>
        <Text className="font-bold text-foreground text-right mb-3 mt-7">حفظ البيانات</Text>
        <Pressable onPress={backup} className="h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="backup" size={21} color="#FFFFFF" /><Text className="text-white font-bold">تصدير نسخة احتياطية</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
