import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { goBackToPreviousScreen } from "@/lib/navigation";

import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/screen-header";
import { SelectionModal } from "@/components/selection-modal";
import { useAuth } from "@/hooks/use-auth";
import { useAccountSession } from "@/lib/account-session";
import { createTRPCClient } from "@/lib/trpc";
import { getActivatedDevice, getOrCreateSyncDeviceId, getSyncDeviceLabel, saveActivatedDevice } from "@/lib/sync-device";
import { useVisitStore } from "@/lib/visit-store";

const client = createTRPCClient();
type Device = { deviceId: string; representativeId: string | null; deviceLabel: string | null; lastSeenAt: Date; lastSyncAt: Date | null; revokedAt: Date | null; createdAt: Date };


export default function DeviceActivationScreen() {
  const { session } = useAccountSession();
  const { data } = useVisitStore();
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth({ autoFetch: true });
  const isManager = session?.role === "manager";
  const [selectedRep, setSelectedRep] = useState(data.representatives[0]?.id ?? "");
  const [repModal, setRepModal] = useState(false);
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceLabel, setDeviceLabel] = useState(getSyncDeviceLabel());
  const [activation, setActivation] = useState<{ code: string; expiresAt: Date; qrDataUrl: string } | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [activated, setActivated] = useState<{ representativeId: string; deviceId: string } | null>(null);

  const selectedRepresentative = useMemo(() => data.representatives.find((item) => item.id === selectedRep), [data.representatives, selectedRep]);

  const loadDevices = useCallback(async () => {
    if (!isManager || !user) return;
    try {
      const result = await client.sync.devices.query();
      setDevices(result as Device[]);
    } catch {
      // The UI keeps the last result and explains that central manager login may be required.
    }
  }, [isManager, user]);

  useEffect(() => {
    void getOrCreateSyncDeviceId().then(setDeviceId);
    void getActivatedDevice().then((value) => setActivated(value ? { representativeId: value.representativeId, deviceId: value.deviceId } : null));
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const connectManager = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { startOAuthLogin } = await import("@/constants/oauth");
      await startOAuthLogin();
      setConnectionNotice("تم فتح صفحة تسجيل الدخول السحابي. أكمل اختيار حساب المدير ثم عد إلى التطبيق.");
      Alert.alert("تم فتح صفحة الربط", "أكمل تسجيل الدخول في المتصفح، ثم عد إلى التطبيق لإتمام الربط.");
      await refreshAuth();
    } catch (error) {
      Alert.alert("تعذر ربط حساب المدير", error instanceof Error ? error.message : "تحقق من الإنترنت ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  const issueCode = async () => {
    if (!selectedRep || !user) return;
    setBusy(true);
    try {
      const result = await client.sync.issueActivationCode.mutate({ representativeId: selectedRep, ttlMinutes: 15 });
      setActivation(result as { code: string; expiresAt: Date; qrDataUrl: string });
      await loadDevices();
    } catch (error) {
      Alert.alert("تعذر إصدار الرمز", error instanceof Error ? error.message : "يجب ربط حساب المدير المركزي أولاً.");
    } finally { setBusy(false); }
  };

  const redeemCode = async () => {
    if (code.trim().length < 8 || !deviceId) { Alert.alert("بيانات ناقصة", "أدخل رمز التفعيل المكوّن من 8 أحرف على الأقل."); return; }
    setBusy(true);
    try {
      const result = await client.sync.redeemActivationCode.mutate({ code: code.trim(), deviceId, deviceLabel: deviceLabel.trim() || getSyncDeviceLabel() });
      if (!result.activated) { Alert.alert("رمز غير صالح", "الرمز منتهي أو مستخدم سابقاً. اطلب رمزاً جديداً من المدير."); return; }
      await saveActivatedDevice({ representativeId: result.representativeId, deviceToken: result.deviceToken });
      setActivated({ representativeId: result.representativeId, deviceId: result.deviceId });
      setCode("");
      Alert.alert("تم تفعيل الجهاز", "حُفظت هوية الجهاز بأمان، وسيبدأ طابور المزامنة عند توفر الإنترنت.");
    } catch (error) {
      Alert.alert("تعذر التفعيل", error instanceof Error ? error.message : "تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى.");
    } finally { setBusy(false); }
  };

  const revoke = (item: Device) => Alert.alert("إلغاء الجهاز", "لن يستطيع هذا الجهاز دفع أو سحب التغييرات بعد الإلغاء.", [
    { text: "إلغاء", style: "cancel" },
    { text: "إلغاء التفعيل", style: "destructive", onPress: async () => { await client.sync.revokeDevice.mutate({ deviceId: item.deviceId }); await loadDevices(); } },
  ]);

  if (!session) return null;
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={{ paddingTop: 18, paddingBottom: 44 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <ScreenHeader title="تفعيل المزامنة" subtitle={isManager ? "إصدار رموز الأجهزة وإدارتها" : "ربط جهازك بحساب المندوب"} icon="phonelink-lock" />
    <View className="rounded-2xl bg-primary/10 border border-primary/20 p-4 mb-5 flex-row-reverse items-start gap-3"><MaterialIcons name="cloud-sync" size={24} color="#1257A6" /><Text className="flex-1 text-right text-primary text-sm leading-6">يعمل التطبيق محلياً دون إنترنت. بعد التفعيل، تُرسل التغييرات عند عودة الاتصال ولا يُحذف أي سجل محلي بسبب انقطاع الشبكة.</Text></View>
    {connectionNotice ? <View className="rounded-2xl bg-success/10 border border-success/25 p-3 mb-4 flex-row-reverse items-center gap-2"><MaterialIcons name="check-circle" size={20} color="#16835B" /><Text className="flex-1 text-right text-success font-bold text-sm">{connectionNotice}</Text></View> : null}
    {isManager ? <>
      {!user ? <View className="rounded-2xl bg-warning/10 border border-warning/30 p-4 mb-4 items-end"><Text className="font-bold text-foreground text-right">ربط حساب المدير المركزي مطلوب</Text><Text className="text-xs text-muted text-right mt-1 leading-5">تسجيل الدخول المحلي يبقى كما هو، لكن إصدار رمز آمن يحتاج اتصال المدير بحساب الخادم مرة واحدة.</Text><Pressable disabled={busy} onPress={connectManager} className="h-12 rounded-xl bg-primary px-5 mt-3 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: busy ? 0.55 : pressed ? 0.8 : 1 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="login" size={19} color="#FFFFFF" />}<Text className="text-white font-bold">{busy ? "جاري فتح تسجيل الدخول..." : "ربط حساب المدير"}</Text></Pressable></View> : <View className="rounded-2xl bg-success/10 border border-success/25 p-3 mb-4 flex-row-reverse items-center gap-2"><MaterialIcons name="verified-user" size={20} color="#16835B" /><Text className="flex-1 text-right text-success font-bold">حساب المدير المركزي متصل</Text></View>}
      <View className="rounded-2xl bg-surface border border-border p-4 mb-5"><Text className="font-bold text-foreground text-right mb-2">إصدار رمز لمندوب</Text><Pressable disabled={!user || busy} onPress={() => setRepModal(true)} className="h-14 rounded-2xl border border-border bg-background px-4 flex-row-reverse items-center justify-between"><Text className="font-bold text-foreground">{selectedRepresentative?.name ?? "اختر المندوب"}</Text><MaterialIcons name="keyboard-arrow-down" size={24} color="#102A43" /></Pressable><Pressable disabled={!user || busy} onPress={issueCode} className="h-14 rounded-2xl bg-primary mt-3 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: !user || busy ? 0.5 : pressed ? 0.8 : 1 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="qr-code-2" size={21} color="#FFFFFF" />}<Text className="text-white font-bold">{busy ? "جارٍ الإصدار..." : "إنشاء رمز وQR"}</Text></Pressable>{activation ? <View className="mt-4 items-center rounded-2xl bg-background border border-primary/30 p-4"><Text className="text-xs text-muted">أرسل هذا الرمز للمندوب خلال 15 دقيقة</Text><Text selectable className="text-3xl font-bold tracking-[5px] text-primary mt-2">{activation.code}</Text><Image source={{ uri: activation.qrDataUrl }} className="w-52 h-52 mt-3" /><Text className="text-xs text-muted text-center mt-2">يُستخدم QR كطريقة عرض للرمز نفسه ولا يمكن استعماله بعد المرة الأولى.</Text></View> : null}</View>
      <View className="flex-row-reverse items-center justify-between mb-3"><Text className="font-bold text-foreground">الأجهزة المفعّلة</Text><Pressable onPress={() => void loadDevices()} className="w-10 h-10 rounded-xl bg-surface border border-border items-center justify-center"><MaterialIcons name="refresh" size={20} color="#1257A6" /></Pressable></View>
      {authLoading ? <ActivityIndicator color="#1257A6" /> : devices.length ? devices.map((item) => <View key={item.deviceId} className="rounded-2xl bg-surface border border-border p-4 mb-3 flex-row-reverse items-center gap-3"><View className={`w-11 h-11 rounded-xl items-center justify-center ${item.revokedAt ? "bg-error/10" : "bg-success/10"}`}><MaterialIcons name={item.revokedAt ? "phonelink-erase" : "phonelink-lock"} size={22} color={item.revokedAt ? "#C0392B" : "#16835B"} /></View><View className="flex-1 items-end"><Text className="font-bold text-foreground">{data.representatives.find((rep) => rep.id === item.representativeId)?.name ?? item.representativeId ?? "مندوب غير معروف"}</Text><Text className="text-xs text-muted mt-1">{item.deviceLabel ?? item.deviceId}</Text><Text className="text-xs text-muted mt-1">آخر اتصال: {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString("ar-YE") : "غير متوفر"}</Text></View>{!item.revokedAt ? <Pressable onPress={() => revoke(item)} className="w-10 h-10 rounded-xl bg-error/10 items-center justify-center"><MaterialIcons name="block" size={20} color="#C0392B" /></Pressable> : <Text className="text-xs text-error font-bold">ملغى</Text>}</View>) : <Text className="text-sm text-muted text-right mb-4">لا توجد أجهزة مفعّلة بعد.</Text>}
      <SelectionModal visible={repModal} title="اختر المندوب" options={data.representatives.filter((item) => item.active).map((item) => ({ label: item.name, value: item.id }))} selected={selectedRep} onClose={() => setRepModal(false)} onSelect={(option) => { setSelectedRep(option.value); setRepModal(false); }} />
    </> : <View className="rounded-2xl bg-surface border border-border p-4"><Text className="font-bold text-foreground text-right">إدخال رمز التفعيل</Text><Text className="text-xs text-muted text-right mt-1 leading-5">اطلب الرمز من المدير. الرمز صالح لمدة محدودة ويُستخدم مرة واحدة فقط.</Text><TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" maxLength={16} placeholder="مثال: AB7K29QX" placeholderTextColor="#7C8798" textAlign="center" className="h-16 rounded-2xl border-2 border-primary/30 bg-background px-4 text-foreground font-bold text-xl tracking-[4px] mt-4" /><Text className="font-bold text-foreground text-right mt-4 mb-2">اسم هذا الجهاز</Text><TextInput value={deviceLabel} onChangeText={setDeviceLabel} placeholder="جهاز المندوب" placeholderTextColor="#7C8798" textAlign="right" className="h-14 rounded-2xl border border-border bg-background px-4 text-foreground" /><Pressable disabled={busy} onPress={redeemCode} className="h-14 rounded-2xl bg-success mt-4 items-center justify-center flex-row-reverse gap-2" style={({ pressed }) => [{ opacity: busy ? 0.55 : pressed ? 0.8 : 1 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="verified" size={21} color="#FFFFFF" />}<Text className="text-white font-bold">{busy ? "جارٍ التحقق..." : "تفعيل وحفظ الجهاز"}</Text></Pressable>{activated ? <View className="rounded-xl bg-success/10 border border-success/25 p-3 mt-4 flex-row-reverse items-center gap-2"><MaterialIcons name="cloud-done" size={20} color="#16835B" /><Text className="flex-1 text-right text-success font-bold">الجهاز مفعّل للمندوب: {data.representatives.find((rep) => rep.id === activated.representativeId)?.name ?? activated.representativeId}</Text></View> : null}<Pressable onPress={goBackToPreviousScreen} className="h-12 rounded-xl bg-surface border border-border mt-3 items-center justify-center"><Text className="font-bold text-foreground">رجوع</Text></Pressable></View>}
  </ScrollView></ScreenContainer>;
}
