import type { Visit } from "../shared/visit-types";

export const REPRESENTATIVE_VISIT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canManageVisit(visit: Visit, role: "manager" | "representative", representativeId?: string, now = new Date()) {
  if (role === "manager") return true;
  if (!representativeId || visit.representativeId !== representativeId) return false;
  const recordedAt = new Date(visit.recordedAt).getTime();
  const elapsed = now.getTime() - recordedAt;
  return Number.isFinite(recordedAt) && elapsed >= 0 && elapsed <= REPRESENTATIVE_VISIT_EDIT_WINDOW_MS;
}
