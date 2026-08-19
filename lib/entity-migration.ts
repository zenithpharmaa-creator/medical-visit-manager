import type { MedicalEntity } from "@/shared/visit-types";

export const EMBEDDED_COORDINATES_MIGRATION_VERSION = 2;

const normalizeName = (value: string) => value.trim().toLocaleLowerCase();

export function preserveExistingCoordinates(existing: MedicalEntity, incoming: MedicalEntity): MedicalEntity {
  return { ...incoming, geographicCoordinates: incoming.geographicCoordinates ?? existing.geographicCoordinates };
}

export function mergeEmbeddedEntities(
  savedEntities: MedicalEntity[] | undefined,
  embeddedEntities: MedicalEntity[],
  applyEmbeddedCoordinates: boolean,
): MedicalEntity[] {
  if (!savedEntities?.length) return embeddedEntities;

  const embeddedByName = new Map(embeddedEntities.map((entity) => [normalizeName(entity.name), entity]));
  const savedNames = new Set<string>();
  const merged = savedEntities.map((saved) => {
    const key = normalizeName(saved.name);
    savedNames.add(key);
    const embedded = embeddedByName.get(key);
    if (!applyEmbeddedCoordinates || !embedded?.geographicCoordinates) return saved;
    return { ...saved, geographicCoordinates: embedded.geographicCoordinates };
  });

  for (const embedded of embeddedEntities) {
    if (!savedNames.has(normalizeName(embedded.name))) merged.push(embedded);
  }
  return merged;
}
