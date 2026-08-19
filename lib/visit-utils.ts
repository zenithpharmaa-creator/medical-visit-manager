import { EntityKind, Visit } from "../shared/visit-types";

export const ENTITY_KINDS: EntityKind[] = ["عيادة", "صيدلية", "مستشفى", "مركز طبي"];

export const SPECIALTIES = [
  "I.M", "Endo", "Emer", "Gyno", "Psych", "Ped", "Cardi", "Derm", "ENT", "G.P", "Hema", "Hepa", "Immu", "Nephro", "Neur", "Onco", "Ortho", "Pulmo", "Rheum", "Surg", "Uro",
] as const;

export const ENTITY_CATEGORIES = ["A", "B", "C"] as const;

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameLocalDay(first: Date, second: Date) {
  return localDateKey(first) === localDateKey(second);
}

export function visitsForDate(visits: Visit[], date: Date) {
  return visits.filter((visit) => isSameLocalDay(new Date(visit.recordedAt), date));
}

export function formatArabicDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
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
