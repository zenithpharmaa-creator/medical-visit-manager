import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

type Props = { title: string; subtitle?: string; icon: React.ComponentProps<typeof MaterialIcons>["name"]; showBack?: boolean };

export function ScreenHeader({ title, subtitle, icon, showBack = true }: Props) {
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); };
  return <View className="flex-row-reverse items-center gap-3 mb-5"><View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-sm"><MaterialIcons name={icon} size={24} color="#FFFFFF" /></View><View className="flex-1 items-end"><Text className="text-xl font-bold text-foreground text-right">{title}</Text>{subtitle ? <Text className="text-sm text-muted mt-0.5 text-right">{subtitle}</Text> : null}</View>{showBack ? <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="رجوع" className="w-11 h-11 rounded-xl bg-surface border border-border items-center justify-center" style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}><MaterialIcons name="arrow-forward" size={22} color="#102A43" /></Pressable> : null}</View>;
}
