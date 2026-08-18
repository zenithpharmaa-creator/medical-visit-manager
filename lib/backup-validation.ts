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

type Keyed = { id: string };
type KeyFn<T> = (item: T) => string[];

/**
 * Merge with indexed candidate lookup instead of scanning the complete result for every item.
 * This keeps restore time close to linear for normal backups while preserving conflict rules.
 */
function mergeCollection<T extends Keyed>(current: T[], incoming: T[], isSame: (left: T, right: T) => boolean, keysOf: KeyFn<T>) {
  const values = [...current];
  const index = new Map<string, T[]>();
  const addToIndex = (item: T) => {
    for (const key of keysOf(item)) {
      if (!key) continue;
      const bucket = index.get(key);
      if (bucket) bucket.push(item);
      else index.set(key, [item]);
    }
  };
  for (const item of current) addToIndex(item);
  let skipped = 0;
  for (const item of incoming) {
    const candidates = new Set<T>();
    for (const key of keysOf(item)) for (const candidate of index.get(key) ?? []) candidates.add(candidate);
    if ([...candidates].some((existing) => isSame(existing, item))) skipped += 1;
    else { values.push(item); addToIndex(item); }
  }
  return { values, skipped };
}

const representativeKeys = (item: Representative) => [item.id, `name:${clean(item.name)}`];
const entityKeys = (item: MedicalEntity) => [item.id, `entity:${entityKey(item)}`];

function resolveImportedIds<T extends Keyed>(current: T[], incoming: T[], isSame: (left: T, right: T) => boolean, keysOf: KeyFn<T>) {
  const index = new Map<string, T[]>();
  for (const item of current) for (const key of keysOf(item)) { const bucket = index.get(key); if (bucket) bucket.push(item); else index.set(key, [item]); }
  const resolved = new Map<string, string>();
  for (const item of incoming) {
    const candidates = new Set<T>();
    for (const key of keysOf(item)) for (const candidate of index.get(key) ?? []) candidates.add(candidate);
    resolved.set(item.id, [...candidates].find((candidate) => isSame(candidate, item))?.id ?? item.id);
  }
  return resolved;
}

export function mergeAppData(current: AppData, incoming: AppData): { data: AppData; summary: MergeSummary } {
  const representatives = mergeCollection(current.representatives, incoming.representatives, sameRepresentative, representativeKeys);
  const representativeMap = resolveImportedIds(current.representatives, incoming.representatives, sameRepresentative, representativeKeys);
  const entities = mergeCollection(current.entities, incoming.entities, sameEntity, entityKeys);
  const entityMap = resolveImportedIds(current.entities, incoming.entities, sameEntity, entityKeys);
  const visitKeys = (item: Visit) => [item.id, item.recordedAt ? `visit:${representativeMap.get(item.representativeId) ?? item.representativeId}|${entityMap.get(item.entityId) ?? item.entityId}|${item.recordedAt}` : ""];
  const planKeys = (item: PlannedVisit) => [item.id, `plan:${representativeMap.get(item.representativeId) ?? item.representativeId}|${entityMap.get(item.entityId) ?? item.entityId}|${item.scheduledDate}|${clean(item.scheduledTime)}`];
  const visits = mergeCollection(current.visits, incoming.visits, (left, right) => sameVisit(left, right, entityMap, representativeMap), visitKeys);
  const plannedVisits = mergeCollection(current.plannedVisits, incoming.plannedVisits, (left, right) => samePlan(left, right, entityMap, representativeMap), planKeys);
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
