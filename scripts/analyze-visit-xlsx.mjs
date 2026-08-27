import XLSXModule from "xlsx";
const XLSX = XLSXModule.default ?? XLSXModule;
import fs from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Missing input file");
const workbook = XLSX.readFile(input, { cellDates: false });
const summary = { worksheets: workbook.SheetNames, sheets: [] };
for (const name of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
  const reps = new Map();
  const dates = new Map();
  const duplicateKeys = new Map();
  for (const row of rows) {
    const representative = String(row["المندوب"] ?? "").trim();
    const date = String(row["تاريخ الزيارة"] ?? "").trim();
    const doctor = String(row["الطبيب"] ?? "").trim();
    const address = String(row["العنوان"] ?? "").trim();
    const shift = String(row["الفترة"] ?? "").trim();
    reps.set(representative, (reps.get(representative) ?? 0) + 1);
    dates.set(date, (dates.get(date) ?? 0) + 1);
    const key = [date, representative, doctor, address, shift].join("|");
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }
  summary.sheets.push({
    name,
    rows: rows.length,
    columns: rows.length ? Object.keys(rows[0]) : [],
    representatives: Object.fromEntries([...reps.entries()].sort((a, b) => b[1] - a[1])),
    dateRange: [...dates.keys()].filter(Boolean).sort(),
    duplicateRows: [...duplicateKeys.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0),
  });
}
console.log(JSON.stringify(summary, null, 2));
