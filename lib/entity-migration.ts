import type { MedicalEntity } from "@/shared/visit-types";
import { normalizeEntityKind } from "./visit-utils";

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
  const normalizedEmbeddedEntities = embeddedEntities.map((entity) => ({ ...entity, kind: normalizeEntityKind(entity.kind) }));
  const normalizedSavedEntities = savedEntities?.map((entity) => ({ ...entity, kind: normalizeEntityKind(entity.kind) }));
  if (!normalizedSavedEntities?.length) return normalizedEmbeddedEntities;

  const embeddedByName = new Map(normalizedEmbeddedEntities.map((entity) => [normalizeName(entity.name), entity]));
  const savedNames = new Set<string>();
  const merged = normalizedSavedEntities.map((saved) => {
    const key = normalizeName(saved.name);
    savedNames.add(key);
    const embedded = embeddedByName.get(key);
    if (!applyEmbeddedCoordinates || saved.geographicCoordinates || !embedded?.geographicCoordinates) return saved;
    return { ...saved, geographicCoordinates: embedded.geographicCoordinates };
  });

  for (const embedded of normalizedEmbeddedEntities) {
    if (!savedNames.has(normalizeName(embedded.name))) merged.push(embedded);
  }
  return merged;
}
