import { buildId, normalizeEntityKind } from "./visit-utils";
import type { MedicalEntity, VisitLocation } from "../shared/visit-types";

export type EntityMergeConflict = {
  code: "id-conflict" | "field-conflict" | "coordinate-conflict" | "coordinate-name-conflict";
  existingId?: string;
  existingName?: string;
  importedName: string;
  fields: string[];
  message: string;
};

export type EntityMergeResult = {
  entities: MedicalEntity[];
  added: MedicalEntity[];
  updated: MedicalEntity[];
  unchanged: MedicalEntity[];
  duplicates: MedicalEntity[];
  conflicts: EntityMergeConflict[];
};

const MATCHABLE_FIELDS: Array<keyof MedicalEntity> = [
  "kind", "contactName", "phone", "address", "specialty", "category", "geographicLocation", "nearestPharmacy", "notes", "sharedLocationId", "region",
];

const normalizeText = (value?: string) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/[ى]/g, "ي")
  .replace(/[ة]/g, "ه")
  .replace(/[\u0640]/g, "")
  .toLocaleLowerCase()
  .replace(/[\s\u200b\u200c\u200d]+/g, "")
  .replace(/[.,،؛:()\[\]{}\-_/\\]+/g, "");

const isFilled = (value: unknown) => typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;

const sameCoordinate = (left?: VisitLocation, right?: VisitLocation) => {
  if (!left || !right) return false;
  return Math.abs(left.latitude - right.latitude) <= 0.00005 && Math.abs(left.longitude - right.longitude) <= 0.00005;
};

const coordinateLabel = (coordinates?: VisitLocation) => coordinates ? `${coordinates.latitude}, ${coordinates.longitude}` : "غير موجود";

function normalizeEntity(entity: MedicalEntity): MedicalEntity {
  return { ...entity, kind: normalizeEntityKind(entity.kind) };
}

function findMatch(incoming: MedicalEntity, current: MedicalEntity[]) {
  const byId = incoming.id ? current.find((entity) => entity.id === incoming.id) : undefined;
  if (byId) return { entity: byId, method: "id" as const };
  const incomingName = normalizeText(incoming.name);
  if (incomingName) {
    const byName = current.find((entity) => normalizeText(entity.name) === incomingName);
    if (byName) return { entity: byName, method: "name" as const };
  }
  const byCoordinates = current.find((entity) => sameCoordinate(entity.geographicCoordinates, incoming.geographicCoordinates));
  if (byCoordinates) return { entity: byCoordinates, method: "coordinates" as const };
  return undefined;
}

export function mergeEntitiesSmart(existingEntities: MedicalEntity[], importedEntities: MedicalEntity[]): EntityMergeResult {
  const merged = existingEntities.map(normalizeEntity);
  const added: MedicalEntity[] = [];
  const updated: MedicalEntity[] = [];
  const unchanged: MedicalEntity[] = [];
  const duplicates: MedicalEntity[] = [];
  const conflicts: EntityMergeConflict[] = [];

  for (const [index, incoming] of importedEntities.map(normalizeEntity).entries()) {
    const match = findMatch(incoming, merged);
    if (!match) {
      merged.push(incoming);
      added.push(incoming);
      continue;
    }

    const existing = match.entity;
    const sameName = normalizeText(existing.name) === normalizeText(incoming.name);
    if (match.method === "coordinates" && !sameName) {
      conflicts.push({
        code: "coordinate-name-conflict",
        existingId: existing.id,
        existingName: existing.name,
        importedName: incoming.name,
        fields: ["الاسم", "الإحداثيات"],
        message: `الإحداثيات ${coordinateLabel(incoming.geographicCoordinates)} مستخدمة للجهة «${existing.name}» بينما الملف يحتوي «${incoming.name}».`,
      });
      const safeIncoming = { ...incoming, id: buildId(`entity-import-${index}`) };
      merged.push(safeIncoming);
      added.push(safeIncoming);
      continue;
    }

    const next = { ...existing };
    const changedFields: string[] = [];
    const conflictingFields: string[] = [];

    MATCHABLE_FIELDS.forEach((field) => {
      const oldValue = next[field];
      const newValue = incoming[field];
      if (!isFilled(oldValue) && isFilled(newValue)) {
        (next as Record<string, unknown>)[field] = newValue;
        changedFields.push(String(field));
      } else if (isFilled(oldValue) && isFilled(newValue) && normalizeText(String(oldValue)) !== normalizeText(String(newValue))) {
        conflictingFields.push(field === "kind" ? "نوع الجهة" : field);
      }
    });

    if (!isFilled(next.geographicCoordinates) && incoming.geographicCoordinates) {
      next.geographicCoordinates = incoming.geographicCoordinates;
      changedFields.push("الإحداثيات");
    } else if (next.geographicCoordinates && incoming.geographicCoordinates && !sameCoordinate(next.geographicCoordinates, incoming.geographicCoordinates)) {
      conflictingFields.push("الإحداثيات");
    }

    if (conflictingFields.length > 0) {
      conflicts.push({
        code: conflictingFields.includes("الإحداثيات") ? "coordinate-conflict" : "field-conflict",
        existingId: existing.id,
        existingName: existing.name,
        importedName: incoming.name,
        fields: [...new Set(conflictingFields)],
        message: `السجل «${existing.name}» يحتوي بيانات مختلفة في: ${[...new Set(conflictingFields)].join("، ")}. تم الاحتفاظ بالبيانات الحالية.`,
      });
    }

    if (changedFields.length > 0) {
      const indexInMerged = merged.findIndex((entity) => entity.id === existing.id);
      if (indexInMerged >= 0) merged[indexInMerged] = next;
      updated.push(next);
    } else if (conflictingFields.length === 0) {
      duplicates.push(incoming);
      unchanged.push(existing);
    } else {
      unchanged.push(existing);
    }
  }

  return { entities: merged, added, updated, unchanged, duplicates, conflicts };
}

export function formatEntityMergeReport(result: EntityMergeResult) {
  return {
    added: result.added.length,
    updated: result.updated.length,
    duplicates: result.duplicates.length,
    conflicts: result.conflicts.length,
    conflictDetails: result.conflicts,
  };
}
