import XLSXModule from "xlsx";
import fs from "node:fs";
import path from "node:path";

const XLSX = XLSXModule.default ?? XLSXModule;
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: node build-temporary-report-source.mjs <input.xlsx> <output.ts>");

function pad(value) { return String(value).padStart(2, "0"); }
function normalizeDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;
  return text;
}
function slug(value) { return value.normalize("NFKC").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 48); }
const representativeIds = { "علي الشعيبي": "rep-1", "محمد الحداد": "rep-2", "محمود الرميمة": "rep-3" };
const workbook = XLSX.readFile(input, { cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const seen = new Set();
const records = [];
for (const row of rows) {
  const visitDate = normalizeDate(row["تاريخ الزيارة"]);
  const doctorName = String(row["الطبيب"] ?? "").trim();
  const representativeName = String(row["المندوب"] ?? "").trim();
  const address = String(row["العنوان"] ?? "").trim();
  const shift = String(row["الفترة"] ?? "").trim() === "مساء" ? "evening" : "morning";
  const items = String(row["الاصناف الموصوفة"] ?? "").split(":").map((item) => item.trim()).filter(Boolean);
  if (!visitDate || !doctorName || !representativeName) continue;
  const dedupeKey = [visitDate, representativeName, doctorName, address, shift].join("|");
  if (seen.has(dedupeKey)) continue;
  seen.add(dedupeKey);
  records.push({
    id: `xlsx-2026-${records.length + 1}-${slug(doctorName)}`,
    representativeId: representativeIds[representativeName] ?? `imported-${slug(representativeName)}`,
    representativeName,
    entityId: `xlsx-entity-${slug(doctorName)}-${slug(address)}`,
    entityName: doctorName,
    entityKind: "عيادة",
    specialty: String(row["التخصص"] ?? "").trim(),
    category: String(row["التصنيف"] ?? "").trim(),
    entityAddress: address,
    recordedAt: `${visitDate}T${shift === "evening" ? "18:00:00" : "09:00:00"}.000Z`,
    shift,
    visitedItems: items,
    notes: "مصدر مؤقت: زيارات2026.xlsx",
  });
}
const contents = `// Generated temporary report source from زيارات2026.xlsx. Delete this file and the source workbook when the import review is complete.\nexport type TemporaryReportVisit = ${JSON.stringify({})};\nexport const TEMPORARY_REPORT_VISITS = ${JSON.stringify(records, null, 2)} as const;\n`;
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, contents, "utf8");
console.log(JSON.stringify({ sourceRows: rows.length, normalizedRows: records.length, duplicateRowsRemoved: rows.length - records.length, output }, null, 2));
