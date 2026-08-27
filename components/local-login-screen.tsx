import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as MailComposer from "expo-mail-composer";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SelectionModal } from "@/components/selection-modal";
import { getBiometricStatus, type BiometricStatus } from "@/lib/biometric-auth";
import { useAccountSession } from "@/lib/account-session";
import { useVisitStore } from "@/lib/visit-store";
import { startGlobalLoading } from "@/lib/navigation";
import { createPasswordResetRequest } from "@/lib/password-reset";

function AccountRecoveryScreen({ onBack, defaultAccountType, defaultRepresentativeId }: { onBack: () => void; defaultAccountType: "manager" | "representative"; defaultRepresentativeId?: string }) {
  const { data, addPasswordResetRequest } = useVisitStore();
  const [accountType, setAccountType] = useState<"manager" | "representative">(defaultAccountType);
  const [representativeId, setRepresentativeId] = useState(defaultRepresentativeId ?? data.representatives.find((item) => item.active)?.id ?? "");
  const [requestBusy, setRequestBusy] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-xl self-center rounded-[28px] bg-surface border border-border p-5">
          <View className="w-14 h-14 rounded-2xl bg-primary items-center justify-center self-center mb-3"><MaterialIcons name="lock-reset" size={30} color="#FFFFFF" /></View>
          <Text className="text-xl font-bold text-foreground text-center">استعادة الحساب</Text>
          <Text className="text-xs text-muted text-center mt-2 mb-5 leading-5">اختر نوع الحساب لعرض خطوات الاستعادة المناسبة. كلمات المرور محلية ومشفرة ولا يتم عرضها أو إرسالها تلقائياً.</Text>
          <View className="flex-row-reverse gap-2 mb-5">
            <Pressable onPress={() => setAccountType("manager")} accessibilityRole="radio" accessibilityState={{ selected: accountType === "manager" }} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-11 rounded-xl items-center justify-center ${accountType === "manager" ? "bg-primary" : "bg-background border border-border"}`}><Text className={accountType === "manager" ? "text-white font-bold" : "text-foreground font-bold"}>مدير النظام</Text></Pressable>
            <Pressable onPress={() => setAccountType("representative")} accessibilityRole="radio" accessibilityState={{ selected: accountType === "representative" }} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-11 rounded-xl items-center justify-center ${accountType === "representative" ? "bg-primary" : "bg-background border border-border"}`}><Text className={accountType === "representative" ? "text-white font-bold" : "text-foreground font-bold"}>مندوب</Text></Pressable>
          </View>
          {accountType === "representative" ? <View className="mb-3"><Text className="font-bold text-foreground text-right mb-2">حساب المندوب</Text><Pressable onPress={() => { const active = data.representatives.filter((item) => item.active); const currentIndex = Math.max(0, active.findIndex((item) => item.id === representativeId)); const next = active[(currentIndex + 1) % Math.max(active.length, 1)]; if (next) setRepresentativeId(next.id); }} className="h-13 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between" accessibilityRole="button" accessibilityLabel="اختيار المندوب"><Text className="font-bold text-foreground flex-1 text-right">{data.representatives.find((item) => item.id === representativeId)?.name ?? "اختر المندوب"}</Text><MaterialIcons name="keyboard-arrow-down" size={22} color="#102A43" /></Pressable><Text className="text-[11px] text-muted text-right mt-1">اضغط لاختيار الحساب التالي من المندوبين النشطين.</Text></View> : null}
          <View className="rounded-2xl bg-primary/10 border border-primary/25 p-4">
            <Text className="font-bold text-primary text-right">{accountType === "manager" ? "استعادة حساب مدير النظام" : `استعادة حساب ${data.representatives.find((item) => item.id === representativeId)?.name ?? "المندوب"}`}</Text>
            <Text className="text-sm text-foreground text-right mt-3 leading-6">سيُحفظ طلب استعادة باسم الحساب ليظهر في إعدادات مدير النظام. عند اعتماد الطلب، تُعاد كلمة المرور إلى الرمز الأولي 123، ثم يمكن تسجيل الدخول وتعيين كلمة مرور جديدة من الإعدادات.</Text>
          </View>
          <View className="rounded-2xl bg-warning/10 border border-warning/25 p-4 mt-3">
            <View className="flex-row-reverse items-start gap-2"><MaterialIcons name="info-outline" size={20} color="#B45309" /><Text className="flex-1 text-xs text-warning text-right leading-5">لا تحذف التطبيق أو تمسح بياناته قبل التأكد من وجود نسخة احتياطية، لأن بيانات الحسابات المحلية قد تكون محفوظة على الجهاز.</Text></View>
          </View>
          <Pressable disabled={requestBusy} onPress={async () => { if (accountType === "representative" && !representativeId) { Alert.alert("اختر المندوب", "اختر حساب المندوب المطلوب استعادته أولاً."); return; } setRequestBusy(true); const stopLoading = startGlobalLoading("جاري إرسال طلب الاستعادة..."); try { const representative = data.representatives.find((item) => item.id === representativeId); const request = createPasswordResetRequest({ accountType, representativeId: accountType === "representative" ? representativeId : undefined, accountLabel: accountType === "manager" ? "مدير النظام" : representative?.name ?? "مندوب" }); addPasswordResetRequest(request); const managerEmail = data.settings.reportEmail.trim(); let emailMessage = "حُفظ الطلب على الجهاز وسيظهر في إعدادات مدير النظام."; if (managerEmail && await MailComposer.isAvailableAsync()) { await MailComposer.composeAsync({ recipients: [managerEmail], subject: `طلب استعادة حساب: ${request.accountLabel}`, body: `طلب استعادة كلمة مرور الحساب: ${request.accountLabel}\nوقت الطلب: ${new Date(request.requestedAt).toLocaleString("ar-YE")}\nالإجراء المطلوب: إعادة ضبط كلمة المرور إلى 123 من إعدادات مدير النظام.` }); emailMessage = `حُفظ الطلب وفتح نموذج بريد المدير على العنوان ${managerEmail}. أكمل إرسال الرسالة من تطبيق البريد.`; } Alert.alert("تم إرسال طلب الاستعادة", emailMessage); } catch { Alert.alert("تم حفظ الطلب", "تعذر فتح البريد حالياً، لكن الطلب محفوظ وسيظهر لمدير النظام داخل الإعدادات."); } finally { stopLoading(); setRequestBusy(false); } }} accessibilityRole="button" accessibilityLabel="إرسال طلب استعادة كلمة المرور" className="h-14 rounded-2xl bg-success items-center justify-center flex-row-reverse gap-2 mt-5" style={({ pressed }) => [{ opacity: requestBusy ? 0.6 : pressed ? 0.78 : 1 }]}><MaterialIcons name={requestBusy ? "hourglass-top" : "send"} size={21} color="#FFFFFF" /><Text className="text-white font-bold">{requestBusy ? "جارٍ إرسال الطلب..." : "إرسال طلب لمدير النظام"}</Text></Pressable>
          <Pressable onPress={onBack} disabled={requestBusy} accessibilityRole="button" accessibilityLabel="العودة إلى تسجيل الدخول" className="h-14 rounded-2xl bg-foreground items-center justify-center flex-row-reverse gap-2 mt-3" style={({ pressed }) => [{ opacity: requestBusy ? 0.55 : pressed ? 0.78 : 1 }]}><MaterialIcons name="arrow-forward" size={21} color="#FFFFFF" /><Text className="text-white font-bold">عودة إلى تسجيل الدخول</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getBiometricStatus().then(setBiometricStatus).catch(() => setBiometricStatus({ kind: "none", hasHardware: false, isEnrolled: false, available: false }));
  }, []);

  const submit = async () => {
    if (busy) return;
    setFeedback(null);
    setBusy(true);
    try {
      const ok = mode === "manager"
        ? await loginManager(password, managerTarget === "manager" ? undefined : managerTarget, rememberMe)
        : await loginRepresentative(selectedRep, password, rememberMe);
      if (!ok) {
        const message = "رمز المرور غير صحيح. تحقق من الحساب ثم حاول مرة أخرى.";
        setFeedback(message);
        Alert.alert("رمز مرور غير صحيح", message);
      }
    } catch {
      const message = "حدث خطأ مؤقت أثناء تسجيل الدخول. حاول مرة أخرى.";
      setFeedback(message);
      Alert.alert("تعذر فتح الحساب", message);
    } finally {
      setBusy(false);
    }
  };

  const biometricLabel = biometricStatus?.kind === "face" ? "التعرف على الوجه" : biometricStatus?.kind === "fingerprint" ? "بصمة الإصبع" : "المصادقة الحيوية";
  const biometricIcon = biometricStatus?.kind === "face" ? "face" : "fingerprint";
  const biometricHint = biometricStatus?.kind === "face" ? "استخدم التعرف على الوجه المسجل في جهازك" : biometricStatus?.kind === "fingerprint" ? "استخدم بصمة الإصبع المسجلة في جهازك" : "استخدم المصادقة الحيوية المسجلة في جهازك";

  if (recoveryVisible) return <AccountRecoveryScreen onBack={() => setRecoveryVisible(false)} defaultAccountType={mode} defaultRepresentativeId={mode === "representative" ? selectedRep : undefined} />;

  const biometricSubmit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await loginWithBiometric();
      if (!ok) Alert.alert("تعذر التحقق الحيوي", "لم يتم التعرف على البصمة أو الوجه. يمكنك استخدام رمز المرور بدلاً من ذلك.");
    } catch {
      Alert.alert("تعذر التحقق الحيوي", "حدث خطأ مؤقت. استخدم رمز المرور للدخول ثم حاول تفعيل المصادقة لاحقاً.");
    } finally {
      setBusy(false);
    }
  };

  const options = mode === "manager"
    ? [{ label: "مدير النظام", value: "manager" }, ...data.representatives.filter((item) => item.active).map((item) => ({ label: `الدخول كـ ${item.name}`, value: item.id }))]
    : data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }));
  const selectedLabel = options.find((item) => item.value === (mode === "manager" ? managerTarget : selectedRep))?.label ?? "اختر الحساب";

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 40, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
        <View className="w-full max-w-xl self-center rounded-[28px] bg-surface border border-border p-5">
          <View className="w-14 h-14 rounded-2xl bg-primary items-center justify-center self-center mb-3"><MaterialIcons name="medical-services" size={30} color="#FFFFFF" /></View>
          <Text className="text-xl font-bold text-foreground text-center">تسجيل الدخول</Text>
          <Text className="text-xs text-muted text-center mt-1 mb-5">اختر نوع الحساب وسجّل الدخول للمتابعة</Text>
          <View className="flex-row-reverse gap-2 mb-3"><Pressable onPress={() => setMode("manager")} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-11 rounded-xl items-center justify-center ${mode === "manager" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "manager" ? "text-white font-bold" : "text-foreground font-bold"}>مدير النظام</Text></Pressable><Pressable onPress={() => setMode("representative")} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]} className={`flex-1 h-11 rounded-xl items-center justify-center ${mode === "representative" ? "bg-primary" : "bg-background border border-border"}`}><Text className={mode === "representative" ? "text-white font-bold" : "text-foreground font-bold"}>مندوب</Text></Pressable></View>
          <Text className="font-bold text-foreground text-right mb-2">الحساب</Text>
          <Pressable onPress={() => setAccountModal(true)} style={({ pressed }) => [{ minHeight: 56, opacity: pressed ? 0.82 : 1 }]} className="h-13 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between mb-3" accessibilityRole="button" accessibilityLabel="اختيار حساب الدخول"><Text className="font-bold text-foreground flex-1 text-right" numberOfLines={1}>{selectedLabel}</Text><MaterialIcons name="keyboard-arrow-down" size={22} color="#102A43" /></Pressable>
          <Pressable onPress={() => setRememberMe((value) => !value)} className="flex-row-reverse items-center justify-between mb-3" accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }}><Text className="text-xs font-bold text-foreground">تذكرني على هذا الجهاز</Text><View className={`w-5 h-5 rounded-md border items-center justify-center ${rememberMe ? "bg-primary border-primary" : "bg-background border-border"}`}>{rememberMe ? <MaterialIcons name="check" size={14} color="#FFFFFF" /> : null}</View></Pressable>
          <Text className="font-bold text-foreground text-right mb-2">كلمة المرور</Text>
          <View className="flex-row-reverse items-center gap-2 mb-4"><TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" placeholder="أدخل كلمة المرور" placeholderTextColor="#7C8798" textAlign="right" className="h-13 rounded-2xl border border-border bg-background px-4 text-foreground flex-1" /><Pressable onPress={() => setVisible((value) => !value)} className="w-13 h-13 rounded-2xl bg-foreground items-center justify-center"><MaterialIcons name={visible ? "visibility-off" : "visibility"} size={20} color="#FFFFFF" /></Pressable></View>
          {feedback ? <View className="rounded-xl bg-error/10 border border-error/30 px-3 py-2 mb-3"><Text className="text-error text-sm font-bold text-right">{feedback}</Text></View> : null}
          {biometricEnabled ? <Pressable disabled={busy} onPress={biometricSubmit} accessibilityRole="button" accessibilityLabel={`الدخول باستخدام ${biometricLabel}`} className="mt-3 min-h-[72px] rounded-2xl bg-primary border-2 border-[#0D4F8B] px-4 py-3 flex-row-reverse items-center gap-3" style={({ pressed }) => [{ opacity: busy ? 0.65 : pressed ? 0.82 : 1, transform: [{ scale: pressed && !busy ? 0.98 : 1 }] }]}><View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center"><MaterialIcons name={biometricIcon} size={28} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="text-white font-bold text-base">{busy ? "جارٍ التحقق..." : `دخول باستخدام ${biometricLabel}`}</Text><Text className="text-white/85 text-xs mt-1">{busy ? "انتظر لحظة وأكمل التحقق على جهازك" : biometricHint}</Text></View>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="chevron-left" size={25} color="#FFFFFF" />}</Pressable> : null}
          {biometricEnabled && biometricStatus && !biometricStatus.available ? <Text className="text-xs text-warning text-right mt-2">المصادقة الحيوية مفعلة للحساب، لكنها غير جاهزة حالياً على هذا الجهاز. فعّل بصمة أو وجهاً من إعدادات الهاتف أو استخدم رمز المرور.</Text> : null}
          {biometricEnabled ? <Text className="text-xs text-muted text-right mt-2">إذا لم تنجح المصادقة، استخدم زر الدخول برمز المرور. يمكنك إيقافها من إعدادات الحساب.</Text> : null}
          {mode === "manager" && managerTarget !== "manager" ? <Text className="text-xs text-primary text-right mt-3">سيتم فتح التطبيق بصلاحيات المندوب المحدد من قبل المدير.</Text> : null}
        </View>
      </ScrollView>
      <View className="border-t border-border bg-background px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 10) }}><Pressable testID="local-login-submit" disabled={busy} onPress={() => void submit()} accessibilityRole="button" accessibilityLabel="دخول إلى الحساب" accessibilityHint="اضغط للتحقق من رمز المرور وفتح الحساب" style={({ pressed }) => [{ height: 56, borderRadius: 14, backgroundColor: "#16835B", alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 8, opacity: busy ? 0.55 : pressed ? 0.8 : 1 }]}><MaterialIcons name="login" size={21} color="#FFFFFF" /><Text className="text-white font-bold text-base">{busy ? "جارٍ التحقق..." : "دخول"}</Text></Pressable><Pressable onPress={() => setRecoveryVisible(true)} disabled={busy} accessibilityRole="link" accessibilityLabel="نسيت كلمة المرور" className="self-center mt-2 px-3 py-1" style={({ pressed }) => [{ opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}><Text className="text-primary font-bold text-sm underline">نسيت كلمة المرور؟</Text></Pressable></View>
      <SelectionModal visible={accountModal} title="اختر الحساب" options={options} selected={mode === "manager" ? managerTarget : selectedRep} onClose={() => setAccountModal(false)} onSelect={(option) => { if (mode === "manager") setManagerTarget(option.value); else setSelectedRep(option.value); setAccountModal(false); }} />
    </View>
  );
}
