import { describe, expect, it } from "vitest";

import { buildComprehensiveDailyTableRows } from "../lib/visit-report-format";

describe("comprehensive daily report table", () => {
  it("preserves the requested column order and prescribed items", () => {
    const rows = buildComprehensiveDailyTableRows([{
      id: "visit-1",
      visitDate: "26/08/2026",
      doctor: "د. زكريا الحداد",
      specialty: "باطنة",
      shift: "مساء",
      address: "شارع حدة",
      prescribedItems: "Claritoр 500mg tab",
      representative: "مندوب 1",
      region: "الشمالية",
    }]);

    expect(Object.keys(rows[0])).toEqual([
      "id",
      "visitDate",
      "doctor",
      "specialty",
      "shift",
      "address",
      "prescribedItems",
      "representative",
      "region",
    ]);
    expect(rows[0].prescribedItems).toBe("Claritoр 500mg tab");
    expect(rows[0].region).toBe("الشمالية");
  });

  it("supports empty values without dropping the row", () => {
    const rows = buildComprehensiveDailyTableRows([{
      id: "visit-2",
      visitDate: "26/08/2026",
      doctor: "طبيب بدون أصناف",
      specialty: "—",
      shift: "صباح",
      address: "—",
      prescribedItems: "—",
      representative: "غير محدد",
      region: "غير محددة",
    }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].prescribedItems).toBe("—");
  });
});
