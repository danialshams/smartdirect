"use client";

import GlassModalPresence from "./GlassModalPresence";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RadioTower, Search, Pencil, Trash2, Loader2, RefreshCw, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";

type LiveRule = {
  id: string; keyword: string; matchMode?: "EXACT" | "CONTAINS_ANY"; initialText: string; requireFollow: boolean;
  followupEnabled: boolean; followupKeyword: string; updatedAt: string;
};
type Account = { id: string; igUsername: string; isConnected: boolean };
type Subscription = { subscribed: boolean; fields: string[]; error?: string };

export default function LiveAutomationList() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [rules, setRules] = useState<LiveRule[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const autoSubscriptionAttempted = useRef<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiveRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const activateSubscription = useCallback(async (instagramAccountId: string) => {
    setSubscriptionBusy(true);
    try {
      const response = await fetch("/api/live-automation/subscription?instagramAccountId=" + encodeURIComponent(instagramAccountId), {
        method: "POST", credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "فعال‌سازی دریافت پیام‌های لایو ناموفق بود.");
      setSubscription(result.data);
    } catch (err) {
      setSubscription(current => ({
        subscribed: false, fields: current?.fields || [],
        error: err instanceof Error ? err.message : "خطا در دریافت رویدادهای لایو",
      }));
    } finally { setSubscriptionBusy(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { credentials: "include", cache: "no-store", signal: controller.signal });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت پیج‌های اینستاگرام ناموفق بود.");
        const connected = ((accountsResult.accounts || []) as Account[]).find(item => item.isConnected);
        if (!connected) throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
        const [listResponse, subscriptionResponse] = await Promise.all([
          fetch("/api/live-automation?instagramAccountId=" + encodeURIComponent(connected.id), { credentials: "include", cache: "no-store", signal: controller.signal }),
          fetch("/api/live-automation/subscription?instagramAccountId=" + encodeURIComponent(connected.id), { credentials: "include", cache: "no-store", signal: controller.signal }).catch(() => null),
        ]);
        const result = await listResponse.json();
        if (!listResponse.ok || !result.success) throw new Error(result.error || "دریافت پاسخ‌های لایو ناموفق بود.");
        const status = subscriptionResponse ? await subscriptionResponse.json().catch(() => null) : null;
        if (!controller.signal.aborted) {
          setAccount(connected);
          setRules(result.data || []);
          setSubscription(status?.data ?? null);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "بارگذاری ناموفق بود.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (loading || !account || !subscription || subscription.subscribed || subscription.error || subscriptionBusy || autoSubscriptionAttempted.current === account.id) return;
    autoSubscriptionAttempted.current = account.id;
    void activateSubscription(account.id);
  }, [loading, account, subscription, subscriptionBusy, activateSubscription]);

  const filtered = useMemo(() => rules.filter(item =>
    [item.keyword || (item.matchMode === "CONTAINS_ANY" ? "هر کامنتی" : ""), item.initialText, item.followupKeyword].some(value => value.toLocaleLowerCase("fa").includes(search.trim().toLocaleLowerCase("fa"))),
  ), [rules, search]);

  async function deleteRule() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/live-automation/" + encodeURIComponent(deleteTarget.id), {
        method: "DELETE", credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "حذف پاسخ خودکار لایو ناموفق بود.");
      setRules(current => current.filter(rule => rule.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "حذف ناموفق بود.");
    } finally { setDeleting(false); }
  }

  if (loading) return <LiveAutomationSkeleton />;
  if (error) return (
    <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-4xl flex-col items-center justify-center gap-4 px-4">
      <p role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>
      <button type="button" onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--daira-primary)] px-5 text-sm font-bold text-white"><RefreshCw size={16} /> تلاش دوباره</button>
    </div>
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
      <button type="button" onClick={() => router.push("/dashboard/live-automation/new")}
        className="daira-create-action daira-leading-action flex min-h-[54px] w-full flex-row items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-sm transition hover:brightness-95"
        style={{ background: dairaPalette.primary.main }}>
        <Plus size={20} /> ایجاد پاسخ جدید
      </button>
      <label className="daira-search-field relative flex">
        <Search size={18} className="shrink-0 text-[var(--daira-search-placeholder)]" aria-hidden="true" />
        <input value={search} onChange={event => setSearch(event.target.value)}
          placeholder="جستجو در کلمات کلیدی یا پاسخ‌ها..." aria-label="جستجوی پاسخ‌های لایو"
          className="daira-search-input min-w-0 flex-1 border-0 bg-transparent text-base outline-none" />
      </label>
      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(rule => (
            <article key={rule.id} className="daira-automation-list-card space-y-3 rounded-2xl border border-[var(--daira-border)] bg-[var(--daira-surface)] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><RadioTower size={18}/></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-[var(--daira-heading)]">{rule.matchMode === "CONTAINS_ANY" && !rule.keyword?.trim() ? "هر کامنتی" : rule.keyword.replace(/,/g, "، ")}</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--daira-text-secondary)]">{rule.matchMode === "CONTAINS_ANY" && !rule.keyword?.trim() ? "پاسخ به همه کامنت‌های لایو" : "کلمه کلیدی لایو"}</p>
                </div>
              </div>
              <p className="line-clamp-3 min-h-12 text-xs leading-6 text-[var(--daira-text-secondary)]">{rule.initialText}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-[var(--daira-text-secondary)]">
                {rule.followupEnabled && <span className="rounded-lg bg-[var(--daira-neutral-bg)] px-2.5 py-1">پاسخ چندمرحله‌ای</span>}
                {rule.requireFollow && <span className="rounded-lg bg-[var(--daira-neutral-bg)] px-2.5 py-1">اجبار به فالو</span>}
              </div>
              <div className="flex gap-2 border-t border-[var(--daira-neutral-bg)] pt-3">
                <button type="button" onClick={() => router.push("/dashboard/live-automation/" + rule.id)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--daira-outline-hover-bg)] text-xs font-bold text-[var(--daira-primary-hover)] transition hover:bg-[var(--daira-outline-active-bg)]">
                  <Pencil size={15} /> ویرایش
                </button>
                <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(rule); }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--daira-error-border)] bg-white text-xs font-bold text-[var(--daira-error-text)] hover:bg-[var(--daira-error-background)]">
                  <Trash2 size={15} /> حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="daira-empty-state space-y-3 rounded-2xl border border-dashed border-[var(--daira-outline)] bg-[var(--daira-surface-hover)] px-4 py-14 text-center">
          <RadioTower size={30} className="mx-auto text-[var(--daira-text-disabled)]" />
          <p className="text-sm font-semibold text-[var(--daira-text-secondary)]">{search ? "پاسخی با این عبارت پیدا نشد." : "هنوز پاسخ خودکار لایو ساخته نشده است."}</p>
          {!search && <p className="mx-auto max-w-md text-xs leading-6 text-[var(--daira-text-secondary)]">می‌توانی پاسخ را قبل از شروع لایو بسازی. هنگام لایو، کامنت‌های دارای کلمهٔ کلیدی به‌صورت خودکار بررسی می‌شوند.</p>}
        </div>
      )}
      <GlassModalPresence open={Boolean(deleteTarget)} onEscape={() => { if (!deleting) setDeleteTarget(null); }}>
      {deleteTarget && (
        <div className="daira-glass-overlay fixed inset-0 z-[2500] flex items-center justify-center p-4" role="presentation"
          onMouseDown={event => { if (event.currentTarget === event.target && !deleting) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-live-title" className="daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm space-y-4 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 id="delete-live-title" className="text-base font-bold text-[var(--daira-heading)]">حذف پاسخ خودکار لایو؟</h2>
              <button type="button" aria-label="بستن" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg p-2 text-[var(--daira-text-secondary)]"><X size={17}/></button>
            </div>
            <p className="text-sm leading-6 text-[var(--daira-text-secondary)]">پاسخ مربوط به «{deleteTarget.matchMode === "CONTAINS_ANY" && !deleteTarget.keyword?.trim() ? "هر کامنتی" : deleteTarget.keyword.replace(/,/g, "، ")}» دیگر اجرا نمی‌شود.</p>
            {deleteError && <p role="alert" className="text-xs text-[var(--daira-error-text)]">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-xl border border-[var(--daira-border)] font-semibold text-[var(--daira-text-secondary)]">انصراف</button>
              <button type="button" disabled={deleting} onClick={() => void deleteRule()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--daira-error-text)] text-sm font-bold text-white disabled:opacity-50">
                {deleting && <Loader2 size={15} className="animate-spin"/>} حذف
              </button>
            </div>
          </section>
        </div>
      )}
      </GlassModalPresence>
    </div>
  );
}
