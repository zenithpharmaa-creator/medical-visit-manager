import { TEMPORARY_REPORT_VISITS } from "../temporary-data/visit-sources/زيارات2026";
import type { Visit } from "@/shared/visit-types";

function visitShift(visit: Pick<Visit, "recordedAt">) {
  return new Date(visit.recordedAt).getHours() >= 16 ? "evening" : "morning";
}

function dedupeKey(visit: Pick<Visit, "recordedAt" | "representativeId" | "entityName" | "entityAddress">) {
  return [visit.recordedAt.slice(0, 10), visit.representativeId, visit.entityName.trim().toLocaleLowerCase(), (visit.entityAddress ?? "").trim().toLocaleLowerCase(), visitShift(visit)].join("|");
}

const temporaryVisits: Visit[] = TEMPORARY_REPORT_VISITS.map((visit) => ({
  id: visit.id,
  representativeId: visit.representativeId,
  entityId: visit.entityId,
  entityName: visit.entityName,
  entityKind: "عيادة",
  specialty: visit.specialty || undefined,
  category: visit.category || undefined,
  entityAddress: visit.entityAddress || undefined,
  recordedAt: visit.recordedAt,
  location: null,
  notes: visit.notes,
  visitedItems: [...visit.visitedItems],
}));

/** Report-only merge. Imported rows never enter AppData.visits or the sync queue. */
export function getReportVisits(localVisits: Visit[]): Visit[] {
  const existing = new Set(localVisits.map(dedupeKey));
  const imported = temporaryVisits.filter((visit) => !existing.has(dedupeKey(visit)));
  return [...localVisits, ...imported];
}

export const TEMPORARY_REPORT_SOURCE_INFO = {
  fileName: "زيارات2026.xlsx",
  rowCount: temporaryVisits.length,
  mode: "report-only" as const,
};
