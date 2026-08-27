import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export type MiniMapCoordinate = { latitude: number; longitude: number };

export function MiniMapModal({
  visible,
  label,
  coordinates,
  onClose,
  onOpenExternal,
}: {
  visible: boolean;
  label: string;
  coordinates: MiniMapCoordinate | null;
  onClose: () => void;
  onOpenExternal: () => void;
}) {
  const [zoom, setZoom] = useState(16);
  const mapUrl = coordinates ? `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=${zoom}&output=embed` : "";
  const adjustZoom = (delta: number) => setZoom((current) => Math.min(20, Math.max(8, current + delta)));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق الخريطة" style={styles.close}><MaterialIcons name="close" size={24} color="#102A43" /></Pressable><View style={styles.headerText}><Text style={styles.title}>الموقع الجغرافي</Text><Text style={styles.label} numberOfLines={2}>{label}</Text></View><MaterialIcons name="location-on" size={26} color="#1257A6" /></View>
        {coordinates ? <View style={styles.mapWrap}><iframe title="خريطة موقع الجهة" src={mapUrl} style={{ width: "100%", height: 310, border: 0 }} /><View style={styles.zoomControls}><Pressable onPress={() => adjustZoom(1)} accessibilityRole="button" accessibilityLabel="تقريب الخريطة" style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#102A43" /></Pressable><Pressable onPress={() => adjustZoom(-1)} accessibilityRole="button" accessibilityLabel="تبعيد الخريطة" style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}><MaterialIcons name="remove" size={24} color="#102A43" /></Pressable></View></View> : <View style={styles.empty}><MaterialIcons name="location-off" size={34} color="#7C8798" /><Text style={styles.emptyText}>لا توجد إحداثيات محفوظة لهذه الجهة.</Text></View>}
        {coordinates ? <View style={styles.coordinateCard}><View style={styles.coordinateItem}><Text style={styles.coordinateLabel}>خط الطول</Text><Text style={styles.coordinateValue}>{coordinates.longitude.toFixed(6)}</Text></View><View style={styles.coordinateItem}><Text style={styles.coordinateLabel}>خط العرض</Text><Text style={styles.coordinateValue}>{coordinates.latitude.toFixed(6)}</Text></View></View> : null}
        <View style={styles.actions}><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق نافذة الخريطة" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><MaterialIcons name="close" size={18} color="#40566F" /><Text style={styles.secondaryText}>إغلاق</Text></Pressable><Pressable onPress={onOpenExternal} disabled={!coordinates} accessibilityRole="button" accessibilityLabel="فتح الموقع في Google Maps" style={({ pressed }) => [styles.primaryButton, !coordinates && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={18} color="#FFFFFF" /><Text style={styles.primaryText}>فتح Google Maps</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "88%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingBottom: 18 },
  header: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  close: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#E8EEF5", borderWidth: 1, borderColor: "#B8C7D9", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "flex-end" },
  title: { color: "#102A43", fontSize: 18, fontWeight: "800" },
  label: { color: "#64748B", fontSize: 11, marginTop: 3, textAlign: "right" },
  mapWrap: { height: 310, width: "100%", position: "relative" },
  zoomControls: { position: "absolute", right: 14, top: 14, gap: 8 },
  zoomButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center", shadowColor: "#102A43", shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  empty: { height: 210, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", gap: 10 },
  emptyText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  coordinateCard: { margin: 14, padding: 12, borderRadius: 14, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row-reverse", gap: 10 },
  coordinateItem: { flex: 1, alignItems: "center" },
  coordinateLabel: { color: "#64748B", fontSize: 10 },
  coordinateValue: { color: "#1257A6", fontSize: 13, fontWeight: "800", marginTop: 4 },
  actions: { paddingHorizontal: 14, flexDirection: "row-reverse", gap: 10 },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  secondaryText: { color: "#40566F", fontSize: 13, fontWeight: "800" },
  primaryButton: { flex: 1.5, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7, backgroundColor: "#1257A6" },
  primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
