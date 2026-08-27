import { describe, expect, it } from "vitest";

import { buildRepresentativeSummaryRows } from "../lib/visit-report-format";

describe("representative summary report", () => {
  it("calculates total, morning, evening, and distinct doctors", () => {
    const [row] = buildRepresentativeSummaryRows([{
      id: "rep-1",
      name: "مندوب 1",
      visits: [
        { recordedAt: "2026-08-27T09:00:00.000Z", entityId: "doctor-1", entityName: "طبيب 1" },
        { recordedAt: "2026-08-27T18:00:00.000Z", entityId: "doctor-2", entityName: "طبيب 2" },
        { recordedAt: "2026-08-28T10:00:00.000Z", entityId: "doctor-1", entityName: "طبيب 1" },
      ],
    }]);

    expect(row).toMatchObject({ representative: "مندوب 1", total: 3, morning: 2, evening: 1, doctors: 2 });
  });

  it("keeps representatives with no visits in the summary", () => {
    const [row] = buildRepresentativeSummaryRows([{ id: "rep-2", name: "مندوب 2", visits: [] }]);
    expect(row).toMatchObject({ total: 0, morning: 0, evening: 0, doctors: 0 });
  });
});
