export function hasRequiredVisitedItems(items: string[] | undefined | null): boolean {
  return Array.isArray(items) && items.some((item) => item.trim().length > 0);
}
