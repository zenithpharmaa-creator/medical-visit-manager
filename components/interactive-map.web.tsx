import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { InteractiveMapProps } from "@/shared/map-types";

export function InteractiveMap({ visits }: InteractiveMapProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface p-6">
      <MaterialIcons name="map" size={42} color="#1565C0" />
      <Text className="font-bold text-foreground mt-3 text-center">الخريطة التفاعلية متاحة داخل تطبيق Android</Text>
      <Text className="text-sm text-muted mt-2 text-center leading-5">تم تسجيل {visits.length} موقعاً. معاينة الويب لا تدعم خرائط native؛ افتح النسخة على الهاتف لعرض العلامات والتكبير والتحريك.</Text>
    </View>
  );
}
