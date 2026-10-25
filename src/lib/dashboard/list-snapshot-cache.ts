/**
 * Small, tab-memory-only cache for account-scoped dashboard lists.
 * Never persists private data to localStorage/sessionStorage or shared HTTP caches.
 * Every consumer must revalidate after mount and update snapshots after writes.
 */
type Snapshot = { savedAt: number; rows: readonly unknown[] };
const items = new Map<string, Snapshot>();
export const DASHBOARD_LIST_MEMORY_TTL_MS = 90_000;
const MAX_ENTRIES = 24;

export function getDashboardListSnapshot<T>(key: string, now = Date.now()): T[] | null {
  const snapshot = items.get(key);
  if (!snapshot) return null;
  if (now < snapshot.savedAt || now - snapshot.savedAt >= DASHBOARD_LIST_MEMORY_TTL_MS) {
    items.delete(key);
    return null;
  }
  return [...snapshot.rows] as T[];
}
export function setDashboardListSnapshot<T>(key: string, rows: readonly T[], now = Date.now()): void {
  items.delete(key);
  items.set(key, { savedAt: now, rows: [...rows] });
  if (items.size > MAX_ENTRIES) {
    const firstKey = items.keys().next().value;
    if (firstKey) items.delete(firstKey);
  }
}
export function clearDashboardListSnapshot(key: string): void {
  items.delete(key);
}
