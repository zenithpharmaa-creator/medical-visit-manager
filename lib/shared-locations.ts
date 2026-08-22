import type { MedicalEntity, SharedLocation } from "@/shared/visit-types";

const coordinatesKey = (latitude: number, longitude: number) => `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;

export function sharedLocationMatchesCoordinates(location: SharedLocation, coordinates?: { latitude: number; longitude: number }) {
  return Boolean(coordinates && coordinatesKey(location.coordinates.latitude, location.coordinates.longitude) === coordinatesKey(coordinates.latitude, coordinates.longitude));
}

export function countEntitiesUsingSharedLocation(entities: MedicalEntity[], location: SharedLocation) {
  return entities.filter((entity) => sharedLocationMatchesCoordinates(location, entity.geographicCoordinates)).length;
}

export function deriveSharedLocations(entities: MedicalEntity[]): SharedLocation[] {
  const byCoordinates = new Map<string, SharedLocation>();

  entities.forEach((entity) => {
    const coordinates = entity.geographicCoordinates;
    if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return;
    const key = coordinatesKey(coordinates.latitude, coordinates.longitude);
    const current = byCoordinates.get(key);
    if (current) {
      current.usageCount += 1;
      if (!current.address && entity.address?.trim()) current.address = entity.address.trim();
      if (entity.createdAt < current.createdAt) current.createdAt = entity.createdAt;
      return;
    }
    byCoordinates.set(key, {
      id: `shared-location-${key.replace(/[^0-9-]/g, "")}`,
      name: entity.geographicLocation?.trim() || entity.address?.trim() || entity.name,
      address: entity.address?.trim() || undefined,
      coordinates: { ...coordinates },
      usageCount: 1,
      createdAt: entity.createdAt,
    });
  });

  return sortSharedLocations([...byCoordinates.values()]);
}

export function sortSharedLocations(locations: SharedLocation[]) {
  return [...locations].sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, "ar"));
}

export function normalizeSharedLocations(value: unknown, entities: MedicalEntity[]): SharedLocation[] {
  if (!Array.isArray(value)) return deriveSharedLocations(entities);
  const valid = value.filter((item): item is SharedLocation => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<SharedLocation>;
    return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.usageCount === "number" && !!candidate.coordinates && Number.isFinite(candidate.coordinates.latitude) && Number.isFinite(candidate.coordinates.longitude);
  }).map((item) => ({
    ...item,
    address: item.address?.trim() || undefined,
    usageCount: Math.max(0, Math.floor(item.usageCount)),
    coordinates: { ...item.coordinates },
  }));
  return sortSharedLocations(valid.length ? valid : deriveSharedLocations(entities));
}
