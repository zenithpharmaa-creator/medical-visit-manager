import type { AppData, MedicalEntity, PlannedVisit, Representative, Visit } from "@/shared/visit-types";

export type RestoreSummary = { representatives: number; entities: number; visits: number; plannedVisits: number };
export type MergeSummary = RestoreSummary & { skippedRepresentatives: number; skippedEntities: number; skippedVisits: number; skippedPlannedVisits: number };

const clean = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("ar-YE").replace(/[ًٌٍَُِّْـ]/g, "").replace(/\s+/g, " ");
const entityKey = (item: MedicalEntity) => `${clean(item.name)}|${clean(item.kind)}|${clean(item.region)}`;
const hasConflict = (left: MedicalEntity, right: MedicalEntity) => ["address", "nearestPharmacy", "geographicLocation", "specialty", "category"].some((field) => { const a = clean(left[field as keyof MedicalEntity]); const b = clean(right[field as keyof MedicalEntity]); return Boolean(a && b && a !== b); });
const sameEntity = (left: MedicalEntity, right: MedicalEntity) => left.id === right.id || (entityKey(left) === entityKey(right) && Boolean(clean(left.name)) && !hasConflict(left, right));
const sameRepresentative = (left: Representative, right: Representative) => left.id === right.id || (clean(left.name) === clean(right.name) && Boolean(clean(left.name)));
const sameVisit = (left: Visit, right: Visit, entityMap: Map<string, string>, representativeMap: Map<string, string>) => left.id === right.id || (Boolean(left.recordedAt && right.recordedAt) && representativeMap.get(left.representativeId) === representativeMap.get(right.representativeId) && entityMap.get(left.entityId) === entityMap.get(right.entityId) && left.recordedAt === right.recordedAt);
const samePlan = (left: PlannedVisit, right: PlannedVisit, entityMap: Map<string, string>, representativeMap: Map<string, string>) => left.id === right.id || (representativeMap.get(left.representativeId) === representativeMap.get(right.representativeId) && entityMap.get(left.entityId) === entityMap.get(right.entityId) && left.scheduledDate === right.scheduledDate && clean(left.scheduledTime) === clean(right.scheduledTime));

function mergeCollection<T>(current: T[], incoming: T[], isSame: (left: T, right: T) => boolean) {
  const values = [...current];
  let skipped = 0;
  for (const item of incoming) {
    if (values.some((existing) => isSame(existing, item))) skipped += 1;
    else values.push(item);
  }
  return { values, skipped };
}

export function mergeAppData(current: AppData, incoming: AppData): { data: AppData; summary: MergeSummary } {
  const representatives = mergeCollection(current.representatives, incoming.representatives, sameRepresentative);
  const representativeMap = new Map<string, string>();
  for (const imported of incoming.representatives) representativeMap.set(imported.id, current.representatives.find((existing) => sameRepresentative(existing, imported))?.id ?? imported.id);
  const entities = mergeCollection(current.entities, incoming.entities, sameEntity);
  const entityMap = new Map<string, string>();
  for (const imported of incoming.entities) entityMap.set(imported.id, current.entities.find((existing) => sameEntity(existing, imported))?.id ?? imported.id);
  const visits = mergeCollection(current.visits, incoming.visits, (left, right) => sameVisit(left, right, entityMap, representativeMap));
  const plannedVisits = mergeCollection(current.plannedVisits, incoming.plannedVisits, (left, right) => samePlan(left, right, entityMap, representativeMap));
  return {
    data: {
      ...current,
      representatives: representatives.values,
      entities: entities.values,
      visits: visits.values,
      plannedVisits: plannedVisits.values,
      representativeLocations: { ...incoming.representativeLocations, ...current.representativeLocations },
      settings: current.settings,
    },
    summary: { representatives: representatives.values.length, entities: entities.values.length, visits: visits.values.length, plannedVisits: plannedVisits.values.length, skippedRepresentatives: representatives.skipped, skippedEntities: entities.skipped, skippedVisits: visits.skipped, skippedPlannedVisits: plannedVisits.skipped },
  };
}

export function parseBackupJson(text: string): { data: AppData; summary: RestoreSummary } {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) throw new Error("ملف النسخة لا يحتوي على بيانات التطبيق.");
  const data = (parsed as { data: unknown }).data;
  if (!data || typeof data !== "object") throw new Error("بنية البيانات غير صالحة.");
  const candidate = data as Partial<AppData>;
  if (!Array.isArray(candidate.representatives) || !Array.isArray(candidate.entities) || !Array.isArray(candidate.visits) || !Array.isArray(candidate.plannedVisits) || !candidate.settings || typeof candidate.settings !== "object") throw new Error("النسخة ناقصة أو ليست نسخة صادرة من التطبيق.");
  const requiredArrays = [...candidate.representatives, ...candidate.entities, ...candidate.visits, ...candidate.plannedVisits];
  if (requiredArrays.some((item) => !item || typeof item !== "object" || typeof (item as { id?: unknown }).id !== "string")) throw new Error("توجد سجلات غير صالحة داخل النسخة.");
  return { data: candidate as AppData, summary: { representatives: candidate.representatives.length, entities: candidate.entities.length, visits: candidate.visits.length, plannedVisits: candidate.plannedVisits.length } };
}
