import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import type { InteractiveMapProps } from "@/shared/map-types";

export function InteractiveMap({ visits, entities = [] }: InteractiveMapProps) {
  const mappedEntities = entities.filter((entity) => entity.geographicCoordinates);
  return (
    <View className="flex-1 items-center justify-center bg-surface p-6">
      <MaterialIcons name="map" size={42} color="#1565C0" />
      <Text className="font-bold text-foreground mt-3 text-center">خريطة مواقع الأطباء متاحة داخل تطبيق Android</Text>
      <Text className="text-sm text-muted mt-2 text-center leading-5">توجد {mappedEntities.length} مواقع أطباء بإحداثيات، إضافة إلى {visits.length} مواقع زيارات. افتح النسخة على الهاتف لعرض العلامات والتكبير والتحريك.</Text>
    </View>
  );
}
