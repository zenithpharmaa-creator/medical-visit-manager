import { buildId, ENTITY_KINDS } from "./visit-utils";
import { EntityKind, MedicalEntity } from "../shared/visit-types";

type ExcelRow = Record<string, unknown>;

function textValue(row: ExcelRow, aliases: string[]) {
  const entry = Object.entries(row).find(([key]) => aliases.includes(key.trim().toLowerCase()));
  return entry?.[1] === undefined || entry?.[1] === null ? "" : String(entry[1]).trim();
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
      const name = textValue(row, ["الاسم", "اسم الجهة", "اسم المركز", "name", "entity name"]);
      if (!name) return null;
      return {
        id: buildId("entity"),
        name,
        kind: resolveKind(textValue(row, ["النوع", "نوع الجهة", "type", "entity type"])),
        contactName: textValue(row, ["الطبيب", "المسؤول", "اسم الطبيب", "contact", "doctor"]),
        phone: textValue(row, ["الهاتف", "رقم الهاتف", "phone", "mobile"]),
        address: textValue(row, ["العنوان", "address"]),
        notes: textValue(row, ["ملاحظات", "notes"]),
        createdAt: new Date().toISOString(),
      };
    })
    .filter((entity): entity is MedicalEntity => entity !== null);
}
