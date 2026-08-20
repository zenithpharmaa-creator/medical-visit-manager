import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { SelectionModal } from "@/components/selection-modal";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";

export function LocalLoginScreen() {
  const { data } = useVisitStore();
  const { loginManager, loginRepresentative, loginWithBiometric, biometricEnabled } = useAccountSession();
  const [mode, setMode] = useState<"manager" | "representative">("manager");
  const [password, setPassword] = useState("");
  const [selectedRep, setSelectedRep] = useState(data.representatives[0]?.id ?? "");
  const [managerTarget, setManagerTarget] = useState("manager");
  const [accountModal, setAccountModal] = useState(false);
  const [visible, setVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = mode === "manager"
      ? await loginManager(password, managerTarget === "manager" ? undefined : managerTarget, rememberMe)
      : await loginRepresentative(selectedRep, password, rememberMe);
    setBusy(false);
    if (!ok) Alert.alert("رمز مرور غير صحيح", "تعذر الدخول. تحقق من الحساب ورمز المرور ثم حاول مرة أخرى.");
  };

  const biometricSubmit = async () => {
    setBusy(true);
    const ok = await loginWithBiometric();
    setBusy(false);
    if (!ok) Alert.alert("تعذر التحقق الحيوي", "لم يتم التعرف على البصمة أو الوجه. يمكنك استخدام رمز المرور بدلاً من ذلك.");
  };

  const options = mode === "manager"
    ? [{ label: "مدير النظام", value: "manager" }, ...data.representatives.filter((item) => item.active).map((item) => ({ label: `الدخول كـ ${item.name}`, value: item.id }))]
    : data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }));
  const selectedLabel = options.find((item) => item.value === (mode === "manager" ? managerTarget : selectedRep))?.label ?? "اختر الحساب";

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-xl self-center rounded-[28px] bg-surface border border-border p-5">
          <View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center self-center mb-4"><MaterialIcons name="medical-services" size={34} color="#FFFFFF" /></View>
          <Text className="text-2xl font-bold text-foreground text-center">تسجيل الدخول</Text>
          <Text className="text-sm text-muted text-center mt-2 mb-6">اختر نوع الحساب وسجّل الدخول للمتابعة</Text>
          <View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => setMode("manager")} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-12 rounded-xl items-center justify-center ${mode === "manager" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "manager" ? "text-white font-bold" : "text-foreground font-bold"}>مدير النظام</Text></Pressable><Pressable onPress={() => setMode("representative")} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-12 rounded-xl items-center justify-center ${mode === "representative" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "representative" ? "text-white font-bold" : "text-foreground font-bold"}>مندوب</Text></Pressable></View>
          <Text className="font-bold text-foreground text-right mb-2">الحساب</Text>
          <Pressable onPress={() => setAccountModal(true)} className="h-14 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between mb-4"><Text className="font-bold text-foreground flex-1 text-right" numberOfLines={1}>{selectedLabel}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable>
          <Pressable onPress={() => setRememberMe((value) => !value)} className="flex-row-reverse items-center justify-between mb-4" accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }}><Text className="text-sm font-bold text-foreground">تذكرني على هذا الجهاز</Text><View className={`w-6 h-6 rounded-md border items-center justify-center ${rememberMe ? "bg-primary border-primary" : "bg-background border-border"}`}>{rememberMe ? <MaterialIcons name="check" size={16} color="#FFFFFF" /> : null}</View></Pressable>
          <Text className="font-bold text-foreground text-right mb-2">كلمة المرور</Text>
          <View className="flex-row-reverse items-center gap-2 mb-5"><TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" placeholder="أدخل كلمة المرور" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-background px-4 text-foreground flex-1" /><Pressable onPress={() => setVisible((value) => !value)} className="w-14 h-14 rounded-2xl bg-foreground items-center justify-center"><MaterialIcons name={visible ? "visibility-off" : "visibility"} size={21} color="#FFFFFF" /></Pressable></View>
          <Pressable disabled={busy} onPress={submit} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: busy ? 0.55 : pressed ? 0.8 : 1 }]}><MaterialIcons name="login" size={21} color="#FFFFFF" /><Text className="text-white font-bold text-base">{busy ? "جارٍ التحقق..." : "دخول برمز المرور"}</Text></Pressable>
          {biometricEnabled ? <Pressable disabled={busy} onPress={biometricSubmit} className="h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mt-3" style={({ pressed }) => [{ opacity: busy ? 0.55 : pressed ? 0.8 : 1 }]}><MaterialIcons name="fingerprint" size={24} color="#FFFFFF" /><Text className="text-white font-bold text-base">دخول بالبصمة أو الوجه</Text></Pressable> : null}
          {biometricEnabled ? <Text className="text-xs text-muted text-right mt-2">يمكنك إلغاء المصادقة الحيوية من إعدادات الحساب، ويظل رمز المرور متاحاً دائماً.</Text> : null}
          {mode === "manager" && managerTarget !== "manager" ? <Text className="text-xs text-primary text-right mt-3">سيتم فتح التطبيق بصلاحيات المندوب المحدد من قبل المدير.</Text> : null}
        </View>
      </ScrollView>
      <SelectionModal visible={accountModal} title="اختر الحساب" options={options} selected={mode === "manager" ? managerTarget : selectedRep} onClose={() => setAccountModal(false)} onSelect={(option) => { if (mode === "manager") setManagerTarget(option.value); else setSelectedRep(option.value); setAccountModal(false); }} />
    </View>
  );
}
