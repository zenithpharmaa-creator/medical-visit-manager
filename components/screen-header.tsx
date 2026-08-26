import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Alert, Pressable, Text, View } from "react-native";
import { goBackToPreviousScreen } from "@/lib/navigation";
import { useAccountSession } from "@/lib/account-session";

type Props = { title: string; subtitle?: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; showBack?: boolean; actionLabel?: string; actionIcon?: React.ComponentProps<typeof MaterialIcons>["name"]; onAction?: () => void };

export function ScreenHeader({ title, subtitle, icon, showBack = true, actionLabel, actionIcon = "login", onAction }: Props) {
  const { session, logout } = useAccountSession();
  const representativeLogout = session?.role === "representative" && !actionLabel;
  const resolvedActionLabel = representativeLogout ? "تسجيل الخروج" : actionLabel;
  const resolvedActionIcon = representativeLogout ? "logout" : actionIcon;
  const resolvedOnAction = representativeLogout ? () => Alert.alert("تأكيد تسجيل الخروج", "هل تريد تسجيل الخروج من الحساب الحالي؟", [{ text: "إلغاء", style: "cancel" }, { text: "تسجيل الخروج", style: "destructive", onPress: () => { void logout(); } }]) : onAction;
  const goBack = goBackToPreviousScreen;
  return <View className="flex-row-reverse flex-wrap items-center gap-2 mb-5"><View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-sm"><MaterialIcons name={icon} size={24} color="#FFFFFF" /></View><View className="flex-1 min-w-0 items-end"><Text className="text-xl font-bold text-foreground text-right" numberOfLines={2}>{title}</Text>{subtitle ? <Text className="text-sm text-muted mt-0.5 text-right" numberOfLines={2}>{subtitle}</Text> : null}</View>{resolvedActionLabel && resolvedOnAction ? <Pressable onPress={resolvedOnAction} accessibilityRole="button" accessibilityLabel={resolvedActionLabel} className="min-h-11 max-w-[150px] rounded-xl bg-primary/10 border border-primary/20 px-3 flex-row-reverse items-center gap-1" style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}><MaterialIcons name={resolvedActionIcon} size={18} color="#1565C0" /><Text className="text-primary font-bold text-xs">{resolvedActionLabel}</Text></Pressable> : null}{showBack ? <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="رجوع" className="w-11 h-11 rounded-xl bg-surface border border-border items-center justify-center" style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}><MaterialIcons name="arrow-forward" size={22} color="#102A43" /></Pressable> : null}</View>;
}
