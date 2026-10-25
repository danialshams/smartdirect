/**
 * In-memory, account-scoped cache for the non-sensitive home summary counters.
 * Avoids a skeleton flash when navigating back to Home.
 * Not persisted to sessionStorage or localStorage; cleared on document reload.
 */
export type DashboardHomeCounts = {
  unreadConversations: number;
  pendingPublishing: number;
  activeAutomations: number;
};

type Snapshot = { value: DashboardHomeCounts; fetchedAt: number };
const snapshots = new Map<string, Snapshot>();
const KEEP_MS = 2 * 60 * 1000;
const MAX_ACCOUNTS = 16;

export function getDashboardHomeSnapshot(key: string, now = Date.now()): Snapshot | null {
  const snapshot = snapshots.get(key);
  if (!snapshot) return null;
  if (now - snapshot.fetchedAt > KEEP_MS || now < snapshot.fetchedAt) {
    snapshots.delete(key);
    return null;
  }
  return snapshot;
}

export function setDashboardHomeSnapshot(
  key: string,
  value: DashboardHomeCounts,
  now = Date.now(),
): void {
  // Keep the cache bounded even when a dashboard session changes accounts.
  snapshots.delete(key);
  snapshots.set(key, { value, fetchedAt: now });
  if (snapshots.size > MAX_ACCOUNTS) {
    const oldest = snapshots.keys().next().value;
    if (oldest) snapshots.delete(oldest);
  }
}
