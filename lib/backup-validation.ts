import type { AppData } from "@/shared/visit-types";

export type RestoreSummary = { representatives: number; entities: number; visits: number; plannedVisits: number };

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
