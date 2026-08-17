import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { SANAA_NEIGHBORHOODS } from "@/data/sanaa-neighborhoods";
import type { MedicalEntity } from "@/shared/visit-types";

type Props = { entities: MedicalEntity[] };

const bounds = { north: 15.46, south: 15.29, west: 44.13, east: 44.26 };
const pointStyle = (latitude: number, longitude: number) => ({
  left: `${Math.max(4, Math.min(96, ((longitude - bounds.west) / (bounds.east - bounds.west)) * 100))}%` as `${number}%`,
  top: `${Math.max(4, Math.min(92, ((bounds.north - latitude) / (bounds.north - bounds.south)) * 100))}%` as `${number}%`,
});

export function OfflineSanaaMap({ entities }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const localEntities = useMemo(() => entities.filter((entity) => {
    const location = entity.geographicCoordinates;
    return Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude));
  }), [entities]);
  const selectedEntity = localEntities.find((entity) => entity.id === selected);

  return (
    <View className="flex-1 overflow-hidden rounded-b-2xl bg-[#EAF1F4]">
      <View className="absolute inset-0 opacity-40">
        <View className="absolute left-1/4 top-0 bottom-0 border-l border-[#B8CDD5]" />
        <View className="absolute left-1/2 top-0 bottom-0 border-l border-[#B8CDD5]" />
        <View className="absolute left-3/4 top-0 bottom-0 border-l border-[#B8CDD5]" />
        <View className="absolute left-0 right-0 top-1/4 border-t border-[#B8CDD5]" />
        <View className="absolute left-0 right-0 top-1/2 border-t border-[#B8CDD5]" />
        <View className="absolute left-0 right-0 top-3/4 border-t border-[#B8CDD5]" />
      </View>
      {SANAA_NEIGHBORHOODS.map((area) => (
        <View key={area.id} style={[{ position: "absolute" }, pointStyle(area.latitude, area.longitude)]}>
          <View className="h-2 w-2 rounded-full bg-[#6C8792]" />
          <Text className="absolute right-2 -top-2 w-20 text-[8px] text-[#526A73] text-right" numberOfLines={1}>{area.name}</Text>
        </View>
      ))}
      {localEntities.map((entity) => (
        <Pressable key={entity.id} onPress={() => setSelected(entity.id)} style={[{ position: "absolute" }, pointStyle(entity.geographicCoordinates!.latitude, entity.geographicCoordinates!.longitude)]} className="h-8 w-8 -ml-4 -mt-4 rounded-full bg-primary border-2 border-white items-center justify-center shadow-sm">
          <MaterialIcons name={entity.kind === "صيدلية" ? "local-pharmacy" : "local-hospital"} size={15} color="#FFFFFF" />
        </Pressable>
      ))}
      <View className="absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 flex-row-reverse items-center gap-2">
        <MaterialIcons name="cloud-off" size={16} color="#16835B" />
        <Text className="text-[11px] text-success font-bold">خريطة صنعاء offline</Text>
      </View>
      <View className="absolute right-3 bottom-3 rounded-xl bg-white/95 px-3 py-2">
        <Text className="text-[10px] text-muted text-right">{SANAA_NEIGHBORHOODS.length} حي محلي · {localEntities.length} جهة بإحداثيات</Text>
        {selectedEntity ? <Text className="text-xs text-primary font-bold text-right mt-1" numberOfLines={1}>{selectedEntity.name}</Text> : null}
      </View>
    </View>
  );
}
