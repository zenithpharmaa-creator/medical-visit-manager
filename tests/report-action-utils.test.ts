import { describe, expect, it } from "vitest";

import { buildGoogleMapsUrl, extractCoordinates, REPORT_ACTION_FORMATS } from "../lib/report-action-utils";

describe("report action utilities", () => {
  it("extracts coordinates from the displayed geographic location", () => {
    expect(extractCoordinates("شارع الجامعة (15.36944, 44.19102)")).toEqual({ latitude: 15.36944, longitude: 44.19102 });
    expect(extractCoordinates("موقع بلا إحداثيات")).toBeNull();
  });

  it("builds a Google Maps search URL only for valid coordinates", () => {
    expect(buildGoogleMapsUrl("مستشفى العلوم (15.37000, 44.19200)")).toBe("https://www.google.com/maps/search/?api=1&query=15.37,44.192");
    expect(buildGoogleMapsUrl("غير محدد")).toBeNull();
  });

  it("exposes every manager action export format", () => {
    expect(REPORT_ACTION_FORMATS.map((item) => item.value)).toEqual(["xlsx", "pdf", "csv", "html"]);
    expect(REPORT_ACTION_FORMATS.map((item) => item.mimeType)).toEqual([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
      "text/csv",
      "text/html",
    ]);
  });
});
