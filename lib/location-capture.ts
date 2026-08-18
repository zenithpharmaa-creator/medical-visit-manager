import type { VisitLocation } from "@/shared/visit-types";

export type LocationSample = VisitLocation & { capturedAt?: number };

export function isFiniteLocation(value: Partial<VisitLocation> | null | undefined): value is VisitLocation {
  return Boolean(
    value &&
      typeof value.latitude === "number" &&
      typeof value.longitude === "number" &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      value.latitude >= -90 &&
      value.latitude <= 90 &&
      value.longitude >= -180 &&
      value.longitude <= 180,
  );
}

export function isRecentLocation(value: LocationSample | null | undefined, now = Date.now(), maxAgeMs = 5 * 60 * 1000) {
  if (!isFiniteLocation(value) || !Number.isFinite(value.capturedAt)) return false;
  const age = now - (value.capturedAt as number);
  return age >= 0 && age <= maxAgeMs;
}

export function normalizeLocation(value: { latitude: number; longitude: number; accuracy?: number | null }, capturedAt = Date.now()): LocationSample | null {
  if (!isFiniteLocation(value)) return null;
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: Number.isFinite(value.accuracy) ? value.accuracy : null,
    capturedAt,
  };
}
