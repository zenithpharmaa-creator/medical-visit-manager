import { describe, expect, it } from "vitest";

import { getReportDownloadBaseName, getReportDownloadMeta } from "../lib/report-download-utils";

describe("report download metadata", () => {
  it("returns a stable label and MIME type for every supported format", () => {
    expect(getReportDownloadMeta("pdf")).toEqual({ fileName: "تقرير-الزيارات.pdf", mimeType: "application/pdf" });
    expect(getReportDownloadMeta("xlsx").fileName).toMatch(/\.xlsx$/);
    expect(getReportDownloadMeta("csv").mimeType).toBe("text/csv");
    expect(getReportDownloadMeta("html").fileName).toMatch(/\.html$/);
  });

  it("removes only the final extension from a file name", () => {
    expect(getReportDownloadBaseName("تقرير-الزيارات.xlsx")).toBe("تقرير-الزيارات");
    expect(getReportDownloadBaseName("report.daily.csv")).toBe("report.daily");
  });
});
