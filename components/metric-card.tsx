import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

type Props = {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  tone?: "primary" | "success" | "warning";
};

const toneClass = { primary: "bg-primary", success: "bg-success", warning: "bg-warning" };

export function MetricCard({ label, value, icon, tone = "primary" }: Props) {
  return (
    <View className="flex-1 min-w-[30%] rounded-2xl bg-surface border border-border p-3 items-end">
      <View className={`w-9 h-9 rounded-xl ${toneClass[tone]} items-center justify-center mb-3`}>
        <MaterialIcons name={icon} size={19} color="#FFFFFF" />
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs font-semibold text-muted mt-1 text-right">{label}</Text>
    </View>
  );
}
