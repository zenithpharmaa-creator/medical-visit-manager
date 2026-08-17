import type { AppData } from "@/shared/visit-types";

export type RestoreSummary = { representatives: number; entities: number; visits: number; plannedVisits: number };
export type MergeSummary = RestoreSummary & { skippedRepresentatives: number; skippedEntities: number; skippedVisits: number; skippedPlannedVisits: number };

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const ids = new Set(current.map((item) => item.id));
  return { values: [...current, ...incoming.filter((item) => !ids.has(item.id))], skipped: incoming.filter((item) => ids.has(item.id)).length };
}

export function mergeAppData(current: AppData, incoming: AppData): { data: AppData; summary: MergeSummary } {
  const representatives = mergeById(current.representatives, incoming.representatives);
  const entities = mergeById(current.entities, incoming.entities);
  const visits = mergeById(current.visits, incoming.visits);
  const plannedVisits = mergeById(current.plannedVisits, incoming.plannedVisits);
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
