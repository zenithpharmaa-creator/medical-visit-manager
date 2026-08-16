import type { Representative, Visit } from "./visit-types";

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
};
