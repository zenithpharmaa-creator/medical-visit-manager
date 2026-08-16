import MapView, { Circle, Marker } from "react-native-maps";

import type { InteractiveMapProps } from "@/shared/map-types";

const REP_COLORS = ["#1565C0", "#16835B", "#D97706"];

export function InteractiveMap({ visits, representatives, initialRegion, currentLocation, targetLocation, allowedRadiusMeters = 200, targetTitle = "موقع الجهة" }: InteractiveMapProps) {
  return (
    <MapView style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation={false} showsCompass>
      {currentLocation ? <Marker coordinate={currentLocation} title="موقع المندوب الحالي" description="الموقع الحالي للجهاز" pinColor="#D97706" /> : null}
      {targetLocation ? <><Marker coordinate={targetLocation} title={targetTitle} description={`نطاق القبول ${allowedRadiusMeters} متر`} pinColor="#16835B" /><Circle center={targetLocation} radius={allowedRadiusMeters} strokeColor="#16835B" fillColor="rgba(22,131,91,0.16)" strokeWidth={2} /></> : null}
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
