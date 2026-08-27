import type { OfficialHoliday } from "@/shared/visit-types";

const pad = (value: number) => String(value).padStart(2, "0");

export function formatGregorianDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** يعرض اليوم والشهر الهجريين بصيغة رقمية مشابهة للتقويم المرجعي: (5/21). */
export function formatHijriDate(date: Date) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric" });
    const parts = formatter.formatToParts(date);
    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return day && month ? `(${month}/${day})` : "";
  } catch {
    return "";
  }
}

export function getYemenOfficialHolidaySeeds(year: number): OfficialHoliday[] {
  const fixed: Array<[string, string, "official" | "national"]> = [
    ["01-01", "رأس السنة الميلادية", "official"],
    ["05-01", "عيد العمال", "official"],
    ["05-22", "عيد الوحدة اليمنية", "national"],
    ["09-26", "ذكرى ثورة 26 سبتمبر", "national"],
    ["10-14", "ذكرى ثورة 14 أكتوبر", "national"],
    ["11-30", "عيد الاستقلال الوطني", "national"],
  ];
  const holidays: OfficialHoliday[] = fixed.map(([suffix, name, kind]) => ({ id: `ye-${year}-${suffix}`, name, kind, startDate: `${year}-${suffix}`, status: "approved", note: "عطلة رسمية يمنية افتراضية قابلة للمراجعة من مدير النظام", createdAt: new Date(0).toISOString() }));
  if (year === 2026) {
    holidays.push(
      { id: "ye-2026-eid-fitr", name: "إجازة عيد الفطر المبارك", kind: "official", startDate: "2026-03-18", endDate: "2026-03-24", status: "approved", note: "التاريخ الافتراضي لعام 2026؛ يمكن للمدير تعديله وفق الإعلان الرسمي", createdAt: new Date(0).toISOString() },
      { id: "ye-2026-eid-adha", name: "إجازة عيد الأضحى المبارك", kind: "official", startDate: "2026-05-26", endDate: "2026-05-31", status: "approved", note: "التاريخ الافتراضي لعام 2026؛ يمكن للمدير تعديله وفق الإعلان الرسمي", createdAt: new Date(0).toISOString() },
      { id: "ye-2026-hijri-new-year", name: "رأس السنة الهجرية", kind: "official", startDate: "2026-06-16", status: "approved", createdAt: new Date(0).toISOString() },
      { id: "ye-2026-prophet-birthday", name: "المولد النبوي الشريف", kind: "official", startDate: "2026-08-25", status: "approved", createdAt: new Date(0).toISOString() },
    );
  }
  return holidays;
}

export function isYemenOfficialHoliday(date: Date, holidays: OfficialHoliday[] = getYemenOfficialHolidaySeeds(date.getFullYear())) {
  const key = formatGregorianDateKey(date);
  return holidays.some((holiday) => holiday.status === "approved" && holiday.startDate <= key && (holiday.endDate ?? holiday.startDate) >= key);
}
