import type { AppData, OfficialHoliday } from "@/shared/visit-types";

export function isApprovedHolidayOnDate(holidays: OfficialHoliday[], date: string) {
  return holidays.some((holiday) => holiday.status === "approved" && holiday.startDate <= date && (holiday.endDate ?? holiday.startDate) >= date);
}

export function expandApprovedHolidayDates(holidays: OfficialHoliday[], monthKey: string) {
  const dates = new Set<string>();
  const monthStart = `${monthKey}-01`;
  const monthEndDate = new Date(`${monthStart}T12:00:00`);
  monthEndDate.setMonth(monthEndDate.getMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  holidays.filter((holiday) => holiday.status === "approved" && holiday.startDate <= monthEnd && (holiday.endDate ?? holiday.startDate) >= monthStart).forEach((holiday) => {
    const cursor = new Date(`${holiday.startDate < monthStart ? monthStart : holiday.startDate}T12:00:00`);
    const end = new Date(`${(holiday.endDate ?? holiday.startDate) > monthEnd ? monthEnd : (holiday.endDate ?? holiday.startDate)}T12:00:00`);
    while (cursor <= end) {
      dates.add(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return [...dates].sort();
}

export function findPendingEmptyDays(data: Pick<AppData, "representatives" | "plannedVisits" | "visits" | "officialHolidays" | "emptyDayReviews">, today: string) {
  return data.representatives.filter((rep) => rep.active).flatMap((rep) => {
    const plannedDates = new Set(data.plannedVisits.filter((item) => item.representativeId === rep.id && item.scheduledDate <= today).map((item) => item.scheduledDate));
    return [...plannedDates].filter((date) => !data.visits.some((visit) => visit.representativeId === rep.id && visit.recordedAt.slice(0, 10) === date) && !isApprovedHolidayOnDate(data.officialHolidays ?? [], date) && !(data.emptyDayReviews ?? []).some((review) => review.representativeId === rep.id && review.date === date)).map((date) => ({ representativeId: rep.id, date }));
  }).sort((left, right) => right.date.localeCompare(left.date));
}
