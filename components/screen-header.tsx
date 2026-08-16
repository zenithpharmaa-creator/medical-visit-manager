import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

type Props = { title: string; subtitle?: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] };

export function ScreenHeader({ title, subtitle, icon }: Props) {
  return (
    <View className="flex-row-reverse items-center gap-3 mb-5">
      <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center shadow-sm">
        <MaterialIcons name={icon} size={24} color="#FFFFFF" />
      </View>
      <View className="flex-1 items-end">
        <Text className="text-xl font-bold text-foreground text-right">{title}</Text>
        {subtitle ? <Text className="text-sm text-muted mt-0.5 text-right">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
