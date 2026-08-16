import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Alert, Modal, Pressable, Text, View } from "react-native";

import type { VisitLocation } from "@/shared/visit-types";

type Props = { visible: boolean; value: { label: string; coordinates: VisitLocation } | null; onClose: () => void; onConfirm: (value: { label: string; coordinates: VisitLocation }) => void };

export function LocationPicker({ visible, onClose }: Props) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View className="flex-1 justify-end bg-black/35"><View className="bg-background rounded-t-[28px] px-5 pt-6 pb-8 items-center"><MaterialIcons name="map" size={42} color="#1565C0" /><Text className="text-lg font-bold text-foreground mt-3 text-center">اختيار الموقع متاح داخل Android</Text><Text className="text-sm text-muted mt-2 text-center leading-5">استخدم تطبيق Android لتحديد الموقع الحالي أو البحث والنقر على الخريطة.</Text><Pressable onPress={onClose} className="h-12 w-full rounded-xl bg-primary items-center justify-center mt-5"><Text className="text-white font-bold">حسناً</Text></Pressable></View></View></Modal>;
}
