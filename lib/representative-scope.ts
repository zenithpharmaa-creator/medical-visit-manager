import type { EntityKind, MedicalEntity, Representative } from "@/shared/visit-types";

export function isEntityVisibleToRepresentative(entity: MedicalEntity, representative?: Representative) {
  if (!representative) return false;
  const assignedIds = representative.assignedEntityIds ?? [];
  // An explicit entity allow-list is the manager's most specific assignment.
  // It must not be hidden by a stale/legacy region or category on the entity.
  if (assignedIds.length > 0) return assignedIds.includes(entity.id);
  if (representative.region && entity.region !== representative.region) return false;
  const assignedKinds = representative.assignedKinds ?? [];
  if (assignedKinds.length > 0 && !assignedKinds.includes(entity.kind as EntityKind)) return false;
  const assignedItems = representative.assignedItems ?? [];
  if (assignedItems.length > 0) {
    const searchable = [entity.category, entity.specialty, entity.kind, entity.nearestPharmacy].filter(Boolean).join(" ").toLocaleLowerCase();
    if (!assignedItems.some((item) => searchable.includes(item.toLocaleLowerCase()))) return false;
  }
  const assignedLocations = representative.assignedSharedLocationIds ?? [];
  if (assignedLocations.length > 0 && (!entity.sharedLocationId || !assignedLocations.includes(entity.sharedLocationId))) return false;
  return true;
}

export function getEntitiesForRepresentative(entities: MedicalEntity[], representative?: Representative) {
  return entities.filter((entity) => isEntityVisibleToRepresentative(entity, representative));
}
