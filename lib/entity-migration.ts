import type { MedicalEntity } from "@/shared/visit-types";

export const EMBEDDED_COORDINATES_MIGRATION_VERSION = 2;

const normalizeName = (value: string) => value
  .normalize("NFKC")
  .replace(/[\u0640]/g, "")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/[ى]/g, "ي")
  .replace(/[ة]/g, "ه")
  .toLocaleLowerCase()
  .replace(/[\s\u200b\u200c\u200d]+/g, "")
  .replace(/[.,،؛:()\[\]{}\-_/\\]+/g, "");

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
    if (!applyEmbeddedCoordinates || saved.geographicCoordinates || !embedded?.geographicCoordinates) return saved;
    return { ...saved, geographicCoordinates: embedded.geographicCoordinates };
  });

  for (const embedded of embeddedEntities) {
    if (!savedNames.has(normalizeName(embedded.name))) merged.push(embedded);
  }
  return merged;
}
