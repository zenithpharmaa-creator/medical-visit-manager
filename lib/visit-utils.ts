import { EntityKind, Visit } from "../shared/visit-types";

export const ENTITY_KINDS: EntityKind[] = ["عيادة", "صيدلية", "مستشفى", "مركز طبي"];

export const SPECIALTIES = [
  "طب عام", "باطنة", "قلب", "أطفال", "نساء وولادة", "جلدية", "أسنان",
  "أنف وأذن وحنجرة", "عظام", "عيون", "جراحة", "تغذية", "صيدلة", "أخرى",
] as const;

export const ENTITY_CATEGORIES = [
  "الفئة أ", "الفئة ب", "الفئة ج", "VIP", "حكومي", "خاص", "غير مصنف",
] as const;

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
