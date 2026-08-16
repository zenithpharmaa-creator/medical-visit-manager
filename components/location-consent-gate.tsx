import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { PropsWithChildren, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

const CONSENT_KEY = "medical-visit-manager-location-consent-v1";

export function LocationConsentGate({ children }: PropsWithChildren) {
  const [checked, setChecked] = useState(false);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY).then((value) => { setConsented(value === "accepted"); setChecked(true); }).catch(() => setChecked(true));
  }, []);

  const accept = async () => {
    await AsyncStorage.setItem(CONSENT_KEY, "accepted");
    setConsented(true);
  };

  if (!checked) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator color="#1565C0" /></View>;
  if (consented) return <>{children}</>;

  return <View className="flex-1 bg-background px-6 justify-center"><View className="rounded-[28px] bg-surface border border-border p-6 items-end"><View className="w-16 h-16 rounded-2xl bg-primary items-center justify-center mb-5 self-center"><MaterialIcons name="location-on" size={32} color="#FFFFFF" /></View><Text className="text-2xl font-bold text-foreground text-right w-full">موافقة استخدام الموقع</Text><Text className="text-base text-muted leading-7 text-right mt-3">يستخدم التطبيق موقع المندوب عند تسجيل الزيارة أو تحديث موقعه، للتحقق من قربه من الجهة وعرضه على خريطة المدير. لا يعمل التتبع المستمر، ولا يُلتقط الموقع إلا عند طلب الإجراء.</Text><View className="rounded-2xl bg-primary/10 p-4 mt-5 flex-row-reverse items-start gap-3"><MaterialIcons name="privacy-tip" size={22} color="#1565C0" /><Text className="flex-1 text-primary text-sm leading-6 text-right">يمكن تغيير أذونات الموقع لاحقاً من إعدادات جهاز Android.</Text></View><Pressable onPress={accept} className="w-full h-14 rounded-2xl bg-primary items-center justify-center flex-row-reverse gap-2 mt-6" style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}><MaterialIcons name="check-circle" size={21} color="#FFFFFF" /><Text className="text-white font-bold text-base">موافقة ومتابعة</Text></Pressable></View></View>;
}
