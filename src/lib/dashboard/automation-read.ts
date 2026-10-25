/**
 * Deduplicate concurrent, authenticated automation reads within the same tab.
 * The promise is discarded immediately on settle: this is not a stale response
 * cache and does not change backend caching, authorization or mutation rules.
 */
type AutomationReadResult = { success?: boolean; data?: unknown; error?: string; message?: string };
const pending = new Map<string, Promise<AutomationReadResult>>();

export function readAccountAutomations(accountId: string): Promise<AutomationReadResult> {
  const existing = pending.get(accountId);
  if (existing) return existing;

  const promise = fetch("/api/automations?instagramAccountId=" + encodeURIComponent(accountId), {
    cache: "no-store",
    credentials: "include",
  }).then(async response => {
    const data = (await response.json()) as AutomationReadResult;
    if (!response.ok) throw new Error(data.error || data.message || "دریافت پاسخ‌های خودکار ناموفق بود.");
    return data;
  });
  pending.set(accountId, promise);
  void promise.then(
    () => { if (pending.get(accountId) === promise) pending.delete(accountId); },
    () => { if (pending.get(accountId) === promise) pending.delete(accountId); },
  );
  return promise;
}
