import { SANAA_NEIGHBORHOODS } from "../data/sanaa-neighborhoods";

export const MAX_SANAAN_NEIGHBORHOOD_DISTANCE_METERS = 25_000;

export type DerivedGeographicLocation = {
  label: string;
  neighborhood: string;
  district: string;
  distanceMeters: number;
  approximate: true;
};

const distanceSquared = (latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) => {
  const latitudeScale = 111_000;
  const longitudeScale = 111_000 * Math.cos((latitude * Math.PI) / 180);
  const northSouth = (latitude - targetLatitude) * latitudeScale;
  const eastWest = (longitude - targetLongitude) * longitudeScale;
  return northSouth ** 2 + eastWest ** 2;
};

export function deriveSanaaLocation(latitude: number, longitude: number): DerivedGeographicLocation | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const nearest = SANAA_NEIGHBORHOODS.reduce((best, candidate) => {
    if (!best) return candidate;
    return distanceSquared(latitude, longitude, candidate.latitude, candidate.longitude) < distanceSquared(latitude, longitude, best.latitude, best.longitude) ? candidate : best;
  }, SANAA_NEIGHBORHOODS[0]);
  if (!nearest) return null;
  const distanceMeters = Math.round(Math.sqrt(distanceSquared(latitude, longitude, nearest.latitude, nearest.longitude)));
  if (distanceMeters > MAX_SANAAN_NEIGHBORHOOD_DISTANCE_METERS) return null;
  return { label: `${nearest.name}، مديرية ${nearest.district}، صنعاء`, neighborhood: nearest.name, district: nearest.district, distanceMeters, approximate: true };
}

export function getSanaaLocationFailureReason(latitude: number | undefined, longitude: number | undefined): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "خط العرض أو خط الطول مفقود أو غير صالح";
  const result = deriveSanaaLocation(latitude as number, longitude as number);
  return result ? null : "الإحداثيات بعيدة عن نطاق أحياء صنعاء المحلية";
}
