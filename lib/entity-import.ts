import { buildId, ENTITY_KINDS, SPECIALTIES } from "./visit-utils";
import { EntityKind, MedicalEntity } from "../shared/visit-types";

type ExcelRow = Record<string, unknown>;

function textValue(row: ExcelRow, aliases: string[]) {
  for (const alias of aliases) {
    const entry = Object.entries(row).find(([key]) => key.trim().toLowerCase().replace(/\s+/g, " ") === alias.trim().toLowerCase().replace(/\s+/g, " "));
    if (entry) return entry[1] === undefined || entry[1] === null ? "" : String(entry[1]).trim();
  }
  return "";
}

function resolveRegion(value: string): "north" | "south" | undefined {
  const clean = value.trim().toLowerCase();
  if (clean.includes("جنوب") || clean.includes("south")) return "south";
  if (clean.includes("شمال") || clean.includes("north")) return "north";
  return undefined;
}

function resolveSpecialty(value: string): string {
  const clean = value.trim().toLowerCase();
  return SPECIALTIES.find((specialty) => specialty.toLowerCase() === clean) ?? value.trim();
}

function resolveKind(value: string): EntityKind {
  const clean = value.trim().toLowerCase();
  const match = ENTITY_KINDS.find((kind) => kind.toLowerCase() === clean);
  if (match) return match;
  if (clean.includes("صيد")) return "صيدلية";
  if (clean.includes("مست")) return "مستشفى";
  if (clean.includes("مركز")) return "مركز طبي";
  return "عيادة";
}

export function parseEntitiesFromRows(rows: ExcelRow[]): MedicalEntity[] {
  return rows
    .map((row): MedicalEntity | null => {
      const name = textValue(row, ["اسم الطبيب", "الطبيب", "doctor", "doctor name", "الاسم", "اسم الجهة", "اسم المركز", "name", "entity name"]);
      if (!name) return null;
      return {
        id: buildId("entity"),
        name,
        kind: resolveKind(textValue(row, ["النوع", "نوع الجهة", "type", "entity type"])),
        region: resolveRegion(textValue(row, ["منطقة الزيارة", "منطقة الطبيب", "region", "doctor region"])),
        contactName: textValue(row, ["المسؤول", "المسؤول الطبي", "contact", "contact name"]),
        phone: textValue(row, ["الهاتف", "رقم الهاتف", "phone", "mobile"]),
        address: textValue(row, ["العنوان", "address"]),
        specialty: resolveSpecialty(textValue(row, ["التخصص", "التخصص الطبي", "specialty", "medical specialty"])),
        category: textValue(row, ["الفئة", "تصنيف الفئة", "category", "class"]),
        geographicLocation: textValue(row, ["الموقع الجغرافي", "الموقع", "المنطقة", "الحي", "geographic location", "location", "area"]),
        geographicCoordinates: (() => { const latitude = Number(textValue(row, ["خط العرض", "latitude", "lat"])); const longitude = Number(textValue(row, ["خط الطول", "longitude", "lng", "lon"])); return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude, accuracy: null } : undefined; })(),
        nearestPharmacy: textValue(row, ["أقرب صيدلية", "اقرب صيدلية", "الصيدلية الأقرب", "nearest pharmacy", "pharmacy"]),
        notes: textValue(row, ["ملاحظات", "notes"]),
        createdAt: new Date().toISOString(),
      };
    })
    .filter((entity): entity is MedicalEntity => entity !== null);
}
