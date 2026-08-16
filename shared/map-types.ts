import type { MedicalEntity, Representative, RepresentativeLocation, Visit, VisitLocation } from "./visit-types";

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type InteractiveMapProps = {
  visits: Visit[];
  entities?: MedicalEntity[];
  representatives: Representative[];
  initialRegion: MapRegion;
  currentLocation?: VisitLocation | null;
  targetLocation?: VisitLocation | null;
  allowedRadiusMeters?: number;
  targetTitle?: string;
  representativeLocations?: Record<string, RepresentativeLocation>;
  representativeFilter?: string;
};
