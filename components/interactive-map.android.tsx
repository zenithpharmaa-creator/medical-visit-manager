import MapView, { Circle, Marker } from "react-native-maps";

import type { InteractiveMapProps } from "@/shared/map-types";

const REP_COLORS = ["#1565C0", "#16835B", "#D97706"];

export function InteractiveMap({ visits, representatives, initialRegion, currentLocation, targetLocation, allowedRadiusMeters = 200, targetTitle = "موقع الجهة", representativeLocations = {}, representativeFilter = "الكل" }: InteractiveMapProps) {
  return (
    <MapView style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation={false} showsCompass>
      {currentLocation ? <Marker coordinate={currentLocation} title="موقع المندوب الحالي" description="الموقع الحالي للجهاز" pinColor="#D97706" /> : null}
      {Object.entries(representativeLocations).filter(([id]) => representativeFilter === "الكل" || representativeFilter === id).map(([id, record], index) => <Marker key={`rep-${id}`} coordinate={record.location} title={representatives.find((rep) => rep.id === id)?.name ?? "مندوب"} description={`آخر تحديث: ${new Date(record.updatedAt).toLocaleString("ar-YE")}`} pinColor={REP_COLORS[index % REP_COLORS.length]} />)}
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
