import type { PlannedVisit, Visit } from "@/shared/visit-types";
import { isSameLocalDay } from "./visit-utils";

export function findWeeklyPlanConflict(
  plans: PlannedVisit[],
  entityId: string,
  representativeId: string,
  scheduledDate: string,
  excludedPlanId?: string,
  allowManagerAssignment = false,
) {
  return plans.find((plan) =>
    plan.id !== excludedPlanId &&
    plan.entityId === entityId &&
    plan.scheduledDate === scheduledDate &&
    !(allowManagerAssignment && plan.representativeId !== representativeId),
  ) ?? null;
}

export function findDailyVisitConflict(
  visits: Visit[],
  plannedVisits: PlannedVisit[],
  entityId: string,
  representativeId: string,
  recordedAt: string,
) {
  const hasManagerAssignment = plannedVisits.some((plan) =>
    plan.assignmentType === "assigned" &&
    plan.entityId === entityId &&
    plan.representativeId === representativeId &&
    isSameLocalDay(new Date(plan.scheduledTime ?? `${plan.scheduledDate}T12:00:00`), new Date(recordedAt)) &&
    plan.taskStatus !== "rejected" &&
    plan.taskStatus !== "completed" &&
    plan.planStatus !== "cancelled" &&
    plan.approvalStatus !== "rejected",
  );

  if (hasManagerAssignment) return null;

  return visits.find((visit) =>
    visit.entityId === entityId &&
    visit.representativeId !== representativeId &&
    isSameLocalDay(new Date(visit.recordedAt), new Date(recordedAt)),
  ) ?? null;
}
