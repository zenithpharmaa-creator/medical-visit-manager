import { EntityKind, Visit } from "../shared/visit-types";

export const ENTITY_KINDS: EntityKind[] = ["عيادة", "صيدلية", "مستشفى", "مركز طبي"];

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
