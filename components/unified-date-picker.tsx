import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type Props = { visible: boolean; value?: string; title: string; onClose: () => void; onSelect: (value: string) => void };
const pad = (value: number) => String(value).padStart(2, "0");
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function UnifiedDatePicker({ visible, value, title, onClose, onSelect }: Props) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)];
  }, [month]);
  const selected = value || "";
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View className="flex-1 items-center justify-center bg-black/35 px-5"><View className="w-full max-w-md rounded-3xl bg-background border border-border overflow-hidden"><View className="p-4 flex-row-reverse items-center justify-between border-b border-border"><Pressable onPress={onClose} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text className="flex-1 text-right text-lg font-bold text-foreground mr-3">{title}</Text></View><View className="p-4"><View className="flex-row-reverse items-center justify-between mb-4"><Pressable onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="chevron-right" size={24} color="#1257A6" /></Pressable><Text className="text-lg font-bold text-foreground">{month.toLocaleDateString("ar", { month: "long", year: "numeric" })}</Text><Pressable onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="w-10 h-10 rounded-xl bg-surface items-center justify-center"><MaterialIcons name="chevron-left" size={24} color="#1257A6" /></Pressable></View><View className="flex-row-reverse mb-2">{["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"].map((day) => <Text key={day} className="flex-1 text-center text-xs font-bold text-muted">{day}</Text>)}</View><View className="flex-row-reverse flex-wrap">{days.map((day, index) => { const date = day ? new Date(month.getFullYear(), month.getMonth(), day) : null; const dateValue = date ? formatDate(date) : ""; const isSelected = dateValue === selected; return <View key={`${dateValue}-${index}`} className="w-[14.285%] p-1"><Pressable disabled={!date} onPress={() => { if (dateValue) { onSelect(dateValue); onClose(); } }} className={`h-10 rounded-xl items-center justify-center ${isSelected ? "bg-primary" : date ? "bg-surface" : "bg-transparent"}`}><Text className={`text-sm font-bold ${isSelected ? "text-white" : date ? "text-foreground" : "text-transparent"}`}>{day || "0"}</Text></Pressable></View>; })}</View></View></View></View></Modal>;
}
