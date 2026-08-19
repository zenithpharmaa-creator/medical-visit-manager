import type { Visit } from "@/shared/visit-types";

export type VisitSyncState = "pending" | "synced" | "local";

export function getVisitSyncState(visit: Pick<Visit, "offlineRecorded" | "verificationStatus">): VisitSyncState {
  if (!visit.offlineRecorded) return "local";
  return visit.verificationStatus === "pending" || !visit.verificationStatus ? "pending" : "synced";
}

export function getVisitSyncLabel(state: VisitSyncState) {
  if (state === "pending") return "محفوظ دون إنترنت · بانتظار الرفع والتحقق";
  if (state === "synced") return "تمت المزامنة والتحقق";
  return "محفوظ على الجهاز";
}
