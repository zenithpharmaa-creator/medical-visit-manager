import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { SelectionModal } from "@/components/selection-modal";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";

export function LocalLoginScreen() {
  const { data } = useVisitStore();
  const { loginManager, loginRepresentative } = useAccountSession();
  const [mode, setMode] = useState<"manager" | "representative">("manager");
  const [password, setPassword] = useState("");
  const [selectedRep, setSelectedRep] = useState(data.representatives[0]?.id ?? "");
  const [managerTarget, setManagerTarget] = useState("manager");
  const [accountModal, setAccountModal] = useState(false);
  const [visible, setVisible] = useState(false);
  const submit = async () => {
    const ok = mode === "manager" ? await loginManager(password, managerTarget === "manager" ? undefined : managerTarget) : await loginRepresentative(selectedRep, password);
    if (!ok) Alert.alert("تعذر الدخول", "كلمة المرور غير صحيحة أو الحساب غير موجود.");
  };
  const options = mode === "manager" ? [{ label: "مدير النظام", value: "manager" }, ...data.representatives.filter((item) => item.active).map((item) => ({ label: `الدخول كـ ${item.name}`, value: item.id }))] : data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }));
  const selectedLabel = options.find((item) => item.value === (mode === "manager" ? managerTarget : selectedRep))?.label ?? "اختر الحساب";
  return <View className="flex-1 bg-background justify-center px-6"><View className="rounded-[28px] bg-surface border border-border p-6"><View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center self-center mb-4"><MaterialIcons name="medical-services" size={34} color="#FFFFFF" /></View><Text className="text-2xl font-bold text-foreground text-center">مدير الزيارات الطبية</Text><Text className="text-sm text-muted text-center mt-2 mb-6">اختر نوع الحساب وسجّل الدخول للمتابعة</Text><View className="flex-row-reverse gap-2 mb-4"><Pressable onPress={() => setMode("manager")} className={`flex-1 h-12 rounded-xl items-center justify-center ${mode === "manager" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "manager" ? "text-white font-bold" : "text-foreground font-bold"}>مدير النظام</Text></Pressable><Pressable onPress={() => setMode("representative")} className={`flex-1 h-12 rounded-xl items-center justify-center ${mode === "representative" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "representative" ? "text-white font-bold" : "text-foreground font-bold"}>مندوب</Text></Pressable></View><Text className="font-bold text-foreground text-right mb-2">الحساب</Text><Pressable onPress={() => setAccountModal(true)} className="h-14 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between mb-4"><Text className="font-bold text-foreground">{selectedLabel}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><Text className="font-bold text-foreground text-right mb-2">كلمة المرور</Text><View className="flex-row-reverse items-center gap-2 mb-5"><TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" placeholder="أدخل كلمة المرور" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-background px-4 text-foreground flex-1" /><Pressable onPress={() => setVisible((value) => !value)} className="w-14 h-14 rounded-2xl bg-foreground items-center justify-center"><MaterialIcons name={visible ? "visibility-off" : "visibility"} size={21} color="#FFFFFF" /></Pressable></View><Pressable onPress={submit} className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2"><MaterialIcons name="login" size={21} color="#FFFFFF" /><Text className="text-white font-bold text-base">دخول</Text></Pressable>{mode === "manager" && managerTarget !== "manager" ? <Text className="text-xs text-primary text-right mt-3">سيتم فتح التطبيق بصلاحيات المندوب المحدد من قبل المدير.</Text> : null}</View><SelectionModal visible={accountModal} title="اختر الحساب" options={options} selected={mode === "manager" ? managerTarget : selectedRep} onClose={() => setAccountModal(false)} onSelect={(option) => { if (mode === "manager") setManagerTarget(option.value); else setSelectedRep(option.value); setAccountModal(false); }} /></View>;
}
