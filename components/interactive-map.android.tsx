import MapView, { Circle, Marker } from "react-native-maps";

import type { InteractiveMapProps } from "@/shared/map-types";

const REP_COLORS = ["#1565C0", "#16835B", "#D97706"];
const isValidCoordinate = (location?: { latitude: number; longitude: number } | null) => Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180);

export function InteractiveMap({ visits, entities = [], representatives, initialRegion, currentLocation, targetLocation, allowedRadiusMeters = 200, targetTitle = "موقع الجهة", representativeLocations = {}, representativeFilter = "الكل" }: InteractiveMapProps) {
  return (
    <MapView style={{ flex: 1 }} initialRegion={initialRegion} showsUserLocation={false} showsCompass>
      {currentLocation ? <Marker coordinate={currentLocation} title="موقع المندوب الحالي" description="الموقع الحالي للجهاز" pinColor="#D97706" /> : null}
      {Object.entries(representativeLocations).filter(([id, record]) => (representativeFilter === "الكل" || representativeFilter === id) && isValidCoordinate(record.location)).map(([id, record], index) => <Marker key={`rep-${id}`} coordinate={record.location} title={representatives.find((rep) => rep.id === id)?.name ?? "مندوب"} description={`آخر تحديث: ${new Date(record.updatedAt).toLocaleString("ar-YE")}`} pinColor={REP_COLORS[index % REP_COLORS.length]} />)}
      {entities.filter((entity) => isValidCoordinate(entity.geographicCoordinates)).map((entity) => <Marker key={`entity-${entity.id}`} coordinate={{ latitude: entity.geographicCoordinates!.latitude, longitude: entity.geographicCoordinates!.longitude }} title={entity.name} description={`${entity.region === "south" ? "جنوب صنعاء" : "شمال صنعاء"}${entity.nearestPharmacy ? ` · أقرب صيدلية: ${entity.nearestPharmacy}` : ""}`} pinColor={entity.region === "south" ? "#D97706" : "#1565C0"} />)}
      {isValidCoordinate(targetLocation) ? <><Marker coordinate={{ latitude: targetLocation!.latitude, longitude: targetLocation!.longitude }} title={targetTitle} description={`نطاق القبول ${allowedRadiusMeters} متر`} pinColor="#16835B" /><Circle center={{ latitude: targetLocation!.latitude, longitude: targetLocation!.longitude }} radius={allowedRadiusMeters} strokeColor="#16835B" fillColor="rgba(22,131,91,0.16)" strokeWidth={2} /></> : null}
      {visits.filter((visit) => isValidCoordinate(visit.location)).map((visit) => {
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
