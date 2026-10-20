"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RadioTower, Search, Pencil, Trash2, Loader2, RefreshCw, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";

type LiveRule = {
  id: string; keyword: string; initialText: string; requireFollow: boolean;
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
    [item.keyword, item.initialText, item.followupKeyword].some(value => value.toLocaleLowerCase("fa").includes(search.trim().toLocaleLowerCase("fa"))),
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
      <button type="button" onClick={() => setRefresh(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white"><RefreshCw size={16} /> تلاش دوباره</button>
    </div>
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
      <button type="button" onClick={() => router.push("/dashboard/live-automation/new")}
        className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-sm transition hover:brightness-95"
        style={{ background: dairaPalette.primary.main }}>
        <Plus size={20} /> ایجاد پاسخ جدید
      </button>
      {subscription && !subscription.subscribed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-xs leading-6 text-[#92400E]" role="status">
          <div className="min-w-0 flex-1">
            <strong className="block text-sm">{subscriptionBusy ? "در حال آماده‌سازی پاسخ به لایو..." : "دریافت کامنت‌های لایو فعال نشده است"}</strong>
            <span>{subscription.error || (subscriptionBusy ? "برنامه در حال فعال‌سازی خودکار اتصال به Meta است." : "اتصال دریافت کامنت‌های لایو هنوز تأیید نشده است.")}</span>
          </div>
          <button type="button" onClick={() => account && void activateSubscription(account.id)} disabled={subscriptionBusy}
            className="min-h-10 rounded-xl bg-white px-4 font-bold text-[#92400E] ring-1 ring-[#FDE68A] disabled:opacity-50">
            {subscriptionBusy ? "در حال اتصال..." : "تلاش دوباره"}
          </button>
        </div>
      )}
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true" />
        <input value={search} onChange={event => setSearch(event.target.value)}
          placeholder="جستجو در کلمات کلیدی یا پاسخ‌ها..." aria-label="جستجوی پاسخ‌های لایو"
          className="min-h-12 w-full rounded-xl border border-[#DBE2ED] bg-white py-3 pl-4 pr-10 text-base outline-none focus:border-[#2563EB]" />
      </label>
      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(rule => (
            <article key={rule.id} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_3px_12px_rgba(24,35,60,0.025)]">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><RadioTower size={18}/></span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-[#0F172A]">{rule.keyword.replace(/,/g, "، ")}</h3>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">کلمه کلیدی لایو</p>
                </div>
              </div>
              <p className="line-clamp-3 min-h-12 text-xs leading-6 text-[#475569]">{rule.initialText}</p>
              <div className="flex flex-wrap gap-2 text-[11px] text-[#64748B]">
                {rule.followupEnabled && <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1">پاسخ چندمرحله‌ای</span>}
                {rule.requireFollow && <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1">اجبار به فالو</span>}
              </div>
              <div className="flex gap-2 border-t border-[#F1F5F9] pt-3">
                <button type="button" onClick={() => router.push("/dashboard/live-automation/" + rule.id)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8] transition hover:bg-[#DBEAFE]">
                  <Pencil size={15} /> ویرایش
                </button>
                <button type="button" onClick={() => { setDeleteError(""); setDeleteTarget(rule); }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-white text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2]">
                  <Trash2 size={15} /> حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-14 text-center">
          <RadioTower size={30} className="mx-auto text-[#94A3B8]" />
          <p className="text-sm font-semibold text-[#475569]">{search ? "پاسخی با این عبارت پیدا نشد." : "هنوز پاسخ خودکار لایو ساخته نشده است."}</p>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-[#18233C]/40 p-4" role="presentation"
          onMouseDown={event => { if (event.currentTarget === event.target && !deleting) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-live-title" className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="delete-live-title" className="text-base font-bold text-[#0F172A]">حذف پاسخ خودکار لایو؟</h2>
              <button type="button" aria-label="بستن" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-lg p-2 text-[#64748B]"><X size={17}/></button>
            </div>
            <p className="text-sm leading-6 text-[#475569]">پاسخ مربوط به «{deleteTarget.keyword.replace(/,/g, "، ")}» دیگر اجرا نمی‌شود.</p>
            {deleteError && <p role="alert" className="text-xs text-[#B91C1C]">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-xl border border-[#E2E8F0] font-semibold text-[#475569]">انصراف</button>
              <button type="button" disabled={deleting} onClick={() => void deleteRule()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#DC2626] text-sm font-bold text-white disabled:opacity-50">
                {deleting && <Loader2 size={15} className="animate-spin"/>} حذف
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
