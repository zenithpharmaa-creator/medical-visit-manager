import { describe, expect, it } from "vitest";

import { findDailyVisitConflict } from "../lib/visit-rules";
import type { PlannedVisit, Visit } from "../shared/visit-types";

const existingVisit = (representativeId = "rep-1"): Visit => ({
  id: "visit-1",
  representativeId,
  entityId: "entity-1",
  entityName: "عيادة الاختبار",
  entityKind: "عيادة",
  recordedAt: "2026-08-19T09:00:00.000Z",
  location: null,
  notes: "",
});

const assignedPlan: PlannedVisit = {
  id: "plan-1",
  representativeId: "rep-2",
  entityId: "entity-1",
  entityName: "عيادة الاختبار",
  entityKind: "عيادة",
  scheduledDate: "2026-08-19",
  scheduledTime: "2026-08-19T10:00:00.000Z",
  shift: "morning",
  assignmentType: "assigned",
  taskStatus: "assigned",
};

describe("daily visit conflict rule", () => {
  it("يرفض زيارة مندوب آخر للجهة نفسها في اليوم نفسه", () => {
    expect(findDailyVisitConflict([existingVisit()], [], "entity-1", "rep-2", "2026-08-19T15:00:00.000Z")?.representativeId).toBe("rep-1");
  });

  it("يسمح بالزيارة عند وجود إسناد مباشر من المدير للمندوب الآخر", () => {
    expect(findDailyVisitConflict([existingVisit()], [assignedPlan], "entity-1", "rep-2", "2026-08-19T15:00:00.000Z")).toBeNull();
  });

  it("لا يعتبر زيارة المندوب نفسه تعارضاً مع قاعدة المندوبين المختلفين", () => {
    expect(findDailyVisitConflict([existingVisit("rep-2")], [], "entity-1", "rep-2", "2026-08-19T15:00:00.000Z")).toBeNull();
  });

  it("يرفض الاستثناء إذا أُلغيت أو رُفضت المهمة", () => {
    expect(findDailyVisitConflict([existingVisit()], [{ ...assignedPlan, taskStatus: "rejected" }], "entity-1", "rep-2", "2026-08-19T15:00:00.000Z")?.representativeId).toBe("rep-1");
    expect(findDailyVisitConflict([existingVisit()], [{ ...assignedPlan, planStatus: "cancelled" }], "entity-1", "rep-2", "2026-08-19T15:00:00.000Z")?.representativeId).toBe("rep-1");
  });
});


describe("weekly plan duplicate rule", () => {
  const plan = { id: "plan-1", representativeId: "rep-1", entityId: "entity-1", entityName: "عيادة الاختبار", entityKind: "عيادة" as const, scheduledDate: "2026-08-19", shift: "morning" as const };

  it("يرفض إضافة الجهة نفسها في اليوم نفسه داخل خطة مندوب آخر", async () => {
    const { findWeeklyPlanConflict } = await import("../lib/visit-rules");
    expect(findWeeklyPlanConflict([plan], "entity-1", "rep-2", "2026-08-19")?.id).toBe("plan-1");
  });

  it("يسمح بإسناد المدير للجهة نفسها لمندوب مختلف", async () => {
    const { findWeeklyPlanConflict } = await import("../lib/visit-rules");
    expect(findWeeklyPlanConflict([plan], "entity-1", "rep-2", "2026-08-19", undefined, true)).toBeNull();
  });

  it("يمنع تكرار الإسناد لنفس المندوب حتى مع استثناء المدير", async () => {
    const { findWeeklyPlanConflict } = await import("../lib/visit-rules");
    expect(findWeeklyPlanConflict([plan], "entity-1", "rep-1", "2026-08-19", undefined, true)?.id).toBe("plan-1");
  });
});
