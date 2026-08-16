import MapView, { Marker } from "react-native-maps";

import type { InteractiveMapProps } from "@/shared/map-types";

const REP_COLORS = ["#1565C0", "#16835B", "#D97706"];

export function InteractiveMap({ visits, representatives, initialRegion }: InteractiveMapProps) {
  return (
    <MapView style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation={false} showsCompass>
      {visits.map((visit) => {
        const repIndex = Math.max(0, representatives.findIndex((rep) => rep.id === visit.representativeId));
        const repName = representatives[repIndex]?.name ?? "مندوب";
        return (
          <Marker
            key={visit.id}
            coordinate={{ latitude: visit.location!.latitude, longitude: visit.location!.longitude }}
            title={visit.entityName}
            description={`${visit.entityKind} · ${repName}${visit.geographicLocation ? ` · ${visit.geographicLocation}` : ""}`}
            pinColor={REP_COLORS[repIndex % REP_COLORS.length]}
          />
        );
      })}
    </MapView>
  );
}
