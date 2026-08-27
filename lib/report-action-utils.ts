export type ReportActionFormat = "pdf" | "xlsx" | "csv" | "html";

const coordinatePattern = /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

export function extractCoordinates(location?: string | null) {
  if (!location) return null;
  const match = location.match(coordinatePattern);
  if (!match) return null;
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
}

export function buildGoogleMapsUrl(location?: string | null) {
  const coordinates = extractCoordinates(location);
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`;
}

export const REPORT_ACTION_FORMATS: Array<{ value: ReportActionFormat; label: string; mimeType: string }> = [
  { value: "xlsx", label: "Excel", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { value: "pdf", label: "PDF", mimeType: "application/pdf" },
  { value: "csv", label: "CSV", mimeType: "text/csv" },
  { value: "html", label: "HTML", mimeType: "text/html" },
];
