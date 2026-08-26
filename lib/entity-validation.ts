import type { MedicalEntity, Visit } from "@/shared/visit-types";

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

export function normalizeEntityName(value: string) {
  return value
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLocaleLowerCase("ar-YE");
}

export function findDuplicateEntityName(entities: MedicalEntity[], name: string, excludeId?: string) {
  const normalized = normalizeEntityName(name);
  if (!normalized) return undefined;
  return entities.find((entity) => entity.id !== excludeId && normalizeEntityName(entity.name) === normalized);
}

export function missingEntityFields(entity: MedicalEntity, visits: Visit[] = []) {
  const visitedItems = visits.some((visit) => visit.entityId === entity.id && (visit.visitedItems?.length ?? 0) > 0);
  return [
    !entity.geographicCoordinates || !Number.isFinite(entity.geographicCoordinates.latitude) || !Number.isFinite(entity.geographicCoordinates.longitude) ? "الموقع الجغرافي" : "",
    !entity.address?.trim() ? "العنوان" : "",
    !entity.specialty?.trim() ? "التخصص" : "",
    !entity.category?.trim() ? "الفئة" : "",
    entity.kind !== "صيدلية" && !entity.nearestPharmacy?.trim() ? "أقرب صيدلية" : "",
    !visitedItems ? "الأصناف المزارة" : "",
  ].filter(Boolean);
}

export function duplicateEntityGroups(entities: MedicalEntity[]) {
  const groups = new Map<string, MedicalEntity[]>();
  for (const entity of entities) {
    const key = normalizeEntityName(entity.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(entity);
    groups.set(key, group);
  }
  return Array.from(groups.values()).filter((group) => group.length > 1);
}
