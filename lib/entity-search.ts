import type { MedicalEntity } from "@/shared/visit-types";

function searchableText(entity: MedicalEntity) {
  return [entity.name, entity.kind, entity.specialty, entity.category, entity.address, entity.geographicLocation, entity.nearestPharmacy]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function rankEntitiesForSearch(entities: MedicalEntity[], query: string, limit = 20) {
  const normalized = query.trim().toLocaleLowerCase();
  return entities
    .filter((entity) => !normalized || searchableText(entity).includes(normalized))
    .sort((left, right) => {
      if (!normalized) return left.name.localeCompare(right.name, "ar");
      const leftName = left.name.toLocaleLowerCase();
      const rightName = right.name.toLocaleLowerCase();
      const leftStarts = leftName.startsWith(normalized) ? 0 : 1;
      const rightStarts = rightName.startsWith(normalized) ? 0 : 1;
      return leftStarts - rightStarts || left.name.localeCompare(right.name, "ar");
    })
    .slice(0, limit);
}
