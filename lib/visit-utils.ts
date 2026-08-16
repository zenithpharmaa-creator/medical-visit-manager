import { EntityKind, Visit } from "../shared/visit-types";

export const ENTITY_KINDS: EntityKind[] = ["عيادة", "صيدلية", "مستشفى", "مركز طبي"];

export const SPECIALTIES = [
  "I.M", "Endo", "Emer", "Gyno", "Psych", "Ped", "Cardi", "Derm", "ENT", "G.P", "Hema", "Hepa", "Immu", "Nephro", "Neur", "Onco", "Ortho", "Pulmo", "Rheum", "Surg", "Uro",
] as const;

export const ENTITY_CATEGORIES = ["A", "B", "C"] as const;

export function visitsForDate(visits: Visit[], date: Date) {
  const target = date.toISOString().slice(0, 10);
  return visits.filter((visit) => visit.recordedAt.slice(0, 10) === target);
}

export function formatArabicDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}


export function distanceBetweenMeters(first: { latitude: number; longitude: number }, second: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLatitude = toRadians(second.latitude - first.latitude);
  const dLongitude = toRadians(second.longitude - first.longitude);
  const latitudeA = toRadians(first.latitude);
  const latitudeB = toRadians(second.latitude);
  const a = Math.sin(dLatitude / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(dLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinGeofence(distanceMeters: number, allowedRadiusMeters: number) {
  return distanceMeters <= allowedRadiusMeters;
}
