import { Text, View } from "react-native";

export function NativeDateTimePicker({ mode }: { value: Date; mode: "date" | "time"; onChange: (date: Date) => void }) {
  return <View className="rounded-xl bg-primary/10 p-3"><Text className="text-primary text-xs text-center">منتقي {mode === "date" ? "التاريخ" : "الوقت"} الأصلي متاح على Android.</Text></View>;
}
