import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
  const mapUrl = coordinates ? `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}&z=16&output=embed` : "";
  // The native map module must not be imported by the web bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mapsModule = Platform.OS === "web" ? null : require("react-native-maps") as { default?: React.ComponentType<any>; Marker?: React.ComponentType<any> };
  const NativeMapView = mapsModule?.default;
  const NativeMarker = mapsModule?.Marker;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق الخريطة" style={styles.close}><MaterialIcons name="close" size={22} color="#102A43" /></Pressable><View style={styles.headerText}><Text style={styles.title}>الموقع الجغرافي</Text><Text style={styles.label} numberOfLines={2}>{label}</Text></View><MaterialIcons name="location-on" size={26} color="#1257A6" /></View>
      {coordinates ? Platform.OS === "web" ? <iframe title="خريطة موقع الجهة" src={mapUrl} style={{ width: "100%", height: 310, border: 0 }} /> : NativeMapView ? <NativeMapView style={styles.map} initialRegion={{ latitude: coordinates.latitude, longitude: coordinates.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }}>{NativeMarker ? <NativeMarker coordinate={coordinates} title="موقع الجهة" description={label} /> : null}</NativeMapView> : <View style={styles.empty}><MaterialIcons name="map" size={34} color="#1257A6" /><Text style={styles.emptyText}>الخريطة غير متاحة في هذه النسخة.</Text></View> : <View style={styles.empty}><MaterialIcons name="location-off" size={34} color="#7C8798" /><Text style={styles.emptyText}>لا توجد إحداثيات محفوظة لهذه الجهة.</Text></View>}
      {coordinates ? <View style={styles.coordinateCard}><View style={styles.coordinateItem}><Text style={styles.coordinateLabel}>خط الطول</Text><Text style={styles.coordinateValue}>{coordinates.longitude.toFixed(6)}</Text></View><View style={styles.coordinateItem}><Text style={styles.coordinateLabel}>خط العرض</Text><Text style={styles.coordinateValue}>{coordinates.latitude.toFixed(6)}</Text></View></View> : null}
      <View style={styles.actions}><Pressable onPress={onClose} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>إغلاق</Text></Pressable><Pressable onPress={onOpenExternal} disabled={!coordinates} style={({ pressed }) => [styles.primaryButton, !coordinates && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="open-in-new" size={18} color="#FFFFFF" /><Text style={styles.primaryText}>فتح Google Maps</Text></Pressable></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { maxHeight: "86%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingBottom: 18 },
  header: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  close: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "flex-end" },
  title: { color: "#102A43", fontSize: 18, fontWeight: "800" },
  label: { color: "#64748B", fontSize: 11, marginTop: 3, textAlign: "right" },
  map: { height: 310, width: "100%" },
  empty: { height: 210, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", gap: 10 },
  emptyText: { color: "#64748B", fontSize: 13, fontWeight: "700" },
  coordinateCard: { margin: 14, padding: 12, borderRadius: 14, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row-reverse", gap: 10 },
  coordinateItem: { flex: 1, alignItems: "center" },
  coordinateLabel: { color: "#64748B", fontSize: 10 },
  coordinateValue: { color: "#1257A6", fontSize: 13, fontWeight: "800", marginTop: 4 },
  actions: { paddingHorizontal: 14, flexDirection: "row-reverse", gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  secondaryText: { color: "#40566F", fontSize: 13, fontWeight: "800" },
  primaryButton: { flex: 1.5, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 7, backgroundColor: "#1257A6" },
  primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
