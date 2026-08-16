import type { Representative, Visit, VisitLocation } from "./visit-types";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type InteractiveMapProps = {
  visits: Visit[];
  representatives: Representative[];
  initialRegion: MapRegion;
  currentLocation?: VisitLocation | null;
  targetLocation?: VisitLocation | null;
  allowedRadiusMeters?: number;
  targetTitle?: string;
};
