import { buildId, normalizeEntityKind, SPECIALTIES } from "./visit-utils";
import { EntityKind, MedicalEntity } from "../shared/visit-types";

type ExcelRow = Record<string, unknown>;

const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("ar-YE").replace(/\s+/g, " ");

function textValue(row: ExcelRow, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const entry = entries.find(([key]) => normalizeHeader(key) === normalizedAlias);
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
  return normalizeEntityKind(value);
}

function parseCoordinate(value: string): number | undefined {
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\s/g, "")
    .replace(/،/g, ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export type ImportedMedicalEntity = MedicalEntity & { coordinatePatch?: { latitude?: number; longitude?: number } };

export function parseEntitiesFromRows(rows: ExcelRow[]): ImportedMedicalEntity[] {
  return rows
    .map((row): ImportedMedicalEntity | null => {
      const name = textValue(row, ["اسم الطبيب", "الطبيب", "doctor", "doctor name", "الاسم", "اسم الجهة", "اسم المركز", "name", "entity name"]);
      if (!name) return null;
      const importedId = textValue(row, ["المعرّف", "المعرف", "id", "entity id"]);
      return {
        id: importedId || buildId("entity"),
        name,
        kind: resolveKind(textValue(row, ["النوع", "نوع الجهة", "type", "entity type"])),
        region: resolveRegion(textValue(row, ["منطقة الزيارة", "منطقة الطبيب", "region", "doctor region"])),
        contactName: textValue(row, ["المسؤول", "المسؤول الطبي", "contact", "contact name"]),
        phone: textValue(row, ["الهاتف", "رقم الهاتف", "phone", "mobile"]),
        address: textValue(row, ["العنوان", "address"]),
        specialty: resolveSpecialty(textValue(row, ["التخصص", "التخصص الطبي", "specialty", "medical specialty"])),
        category: textValue(row, ["الفئة", "تصنيف الفئة", "category", "class"]),
        geographicLocation: textValue(row, ["الموقع الجغرافي", "الموقع", "المنطقة", "الحي", "geographic location", "location", "area"]),
        geographicCoordinates: (() => { const latitude = parseCoordinate(textValue(row, ["خط العرض", "خط عرض", "خطول العرض", "خط العرض الجغرافي", "latitude", "lat"])); const longitude = parseCoordinate(textValue(row, ["خط الطول", "خط طول", "خطول الطول", "خط الطول الجغرافي", "longitude", "lng", "lon"])); return latitude !== undefined && longitude !== undefined && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? { latitude, longitude, accuracy: null } : undefined; })(),
        coordinatePatch: (() => { const latitude = parseCoordinate(textValue(row, ["خط العرض", "خط عرض", "خطول العرض", "خط العرض الجغرافي", "latitude", "lat"])); const longitude = parseCoordinate(textValue(row, ["خط الطول", "خط طول", "خطول الطول", "خط الطول الجغرافي", "longitude", "lng", "lon"])); return latitude !== undefined || longitude !== undefined ? { latitude: latitude !== undefined && latitude >= -90 && latitude <= 90 ? latitude : undefined, longitude: longitude !== undefined && longitude >= -180 && longitude <= 180 ? longitude : undefined } : undefined; })(),
        nearestPharmacy: textValue(row, ["أقرب صيدلية", "اقرب صيدلية", "الصيدلية الأقرب", "nearest pharmacy", "pharmacy"]),
        notes: textValue(row, ["ملاحظات", "الملاحضات", "notes", "remarks"]),
        createdAt: new Date().toISOString(),
      };
    })
    .filter((entity): entity is MedicalEntity => entity !== null);
}
