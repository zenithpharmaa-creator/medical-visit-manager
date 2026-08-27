export function isSingleDateReport(variant: string) {
  return variant === "daily" || variant === "daily-analysis";
}

export function reportDateMatches(variant: string, day: string, fromDate: string, toDate: string) {
  if (isSingleDateReport(variant)) return day === fromDate;
  return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
}
