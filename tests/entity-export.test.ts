import { describe, expect, it } from "vitest";

import { buildEntityExportRows, buildEntitiesPdfHtml } from "../lib/entity-export-format";
import type { MedicalEntity } from "../shared/visit-types";

const entity: MedicalEntity = {
  id: "entity-1",
  name: "د. أحمد محمد",
  kind: "عيادة",
  specialty: "باطنة",
  category: "A",
  region: "north",
  geographicLocation: "حي حدة، صنعاء",
  address: "شارع حدة",
  nearestPharmacy: "صيدلية السلام",
  contactName: "777000000",
  geographicCoordinates: { latitude: 15.3694, longitude: 44.191, accuracy: 20 },
  createdAt: "2026-08-19T00:00:00.000Z",
};

describe("entity export", () => {
  it("preserves Arabic fields and coordinates", () => {
    const rows = buildEntityExportRows([entity]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["اسم الطبيب"]).toBe("د. أحمد محمد");
    expect(rows[0]["خط العرض"]).toBe("15.3694");
    expect(rows[0]["خط الطول"]).toBe("44.191");
    expect(rows[0]["المنطقة"]).toBe("شمال صنعاء");
  });

  it("builds an Arabic RTL PDF document with the total count", () => {
    const html = buildEntitiesPdfHtml(buildEntityExportRows([entity]));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("سجل جهات الزيارة");
    expect(html).toContain("عدد الجهات: 1");
    expect(html).toContain("15.3694");
  });
});
