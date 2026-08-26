import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = { visible: boolean; value?: string; title: string; onClose: () => void; onSelect: (value: string) => void };
const pad = (value: number) => String(value).padStart(2, "0");
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function UnifiedDatePicker({ visible, value, title, onClose, onSelect }: Props) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const days = useMemo(() => { const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay(); const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); return [...Array(firstDay).fill(null), ...Array.from({ length: total }, (_, index) => index + 1)]; }, [month]);
  const selected = value || "";
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.card}><View style={styles.header}><Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="إغلاق التقويم"><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><Text style={styles.title}>{title}</Text></View><View style={styles.content}><View style={styles.monthHeader}><Pressable onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} style={styles.iconButton} accessibilityLabel="الشهر التالي"><MaterialIcons name="chevron-right" size={24} color="#1257A6" /></Pressable><Text style={styles.monthTitle}>{month.toLocaleDateString("ar", { month: "long", year: "numeric" })}</Text><Pressable onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} style={styles.iconButton} accessibilityLabel="الشهر السابق"><MaterialIcons name="chevron-left" size={24} color="#1257A6" /></Pressable></View><View style={styles.weekRow}>{["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"].map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View><View style={styles.grid}>{days.map((day, index) => { const date = day ? new Date(month.getFullYear(), month.getMonth(), day) : null; const dateValue = date ? formatDate(date) : ""; const isSelected = dateValue === selected; return <View key={`${dateValue}-${index}`} style={styles.cell}><Pressable disabled={!date} onPress={() => { if (dateValue) { onSelect(dateValue); onClose(); } }} style={[styles.dayButton, !date && styles.emptyDay, isSelected && styles.selectedDay]}><Text style={[styles.dayText, !date && styles.emptyText, isSelected && styles.selectedText]}>{day || "0"}</Text></Pressable></View>; })}</View></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 20 },
  card: { width: "100%", maxWidth: 480, borderRadius: 24, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E0EA", overflow: "hidden" },
  header: { padding: 16, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#D8E0EA" },
  title: { flex: 1, marginRight: 12, color: "#102A43", fontSize: 18, fontWeight: "700", textAlign: "right" },
  content: { padding: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" },
  monthHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthTitle: { color: "#102A43", fontSize: 18, fontWeight: "700" },
  weekRow: { flexDirection: "row-reverse", marginBottom: 8 },
  weekDay: { flex: 1, color: "#7C8798", fontSize: 12, fontWeight: "700", textAlign: "center" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap" },
  cell: { width: "14.2857%", padding: 4 },
  dayButton: { height: 40, borderRadius: 12, backgroundColor: "#F5F8FC", alignItems: "center", justifyContent: "center" },
  emptyDay: { backgroundColor: "transparent" },
  selectedDay: { backgroundColor: "#1257A6" },
  dayText: { color: "#102A43", fontSize: 14, fontWeight: "700" },
  emptyText: { color: "transparent" },
  selectedText: { color: "#FFFFFF" },
});
