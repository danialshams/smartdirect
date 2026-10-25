"use client";
import { useDashboardAccountSelection } from "./DashboardAccountContext";

import GlassModalPresence from "./GlassModalPresence";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Clock3, RefreshCw, X, MessageSquare } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import SmartReminderSkeleton from "./SmartReminderSkeleton";
import { getDashboardListSnapshot, setDashboardListSnapshot } from "@/src/lib/dashboard/list-snapshot-cache";
import { smartReminderOptionName } from "@/lib/automation/smart-reminder-options";

type Account = { id: string; isConnected: boolean };
type Rule = {
  id: string; automationId: string; instagramAccountId: string;
  delayMinutes: number; text: string;
  automation: { keyword: string | null; triggerType: string; keywordMatchMode?: string | null };
  _count?: { deliveries: number };
};
function duration(minutes: number) {
  if (minutes < 60) return new Intl.NumberFormat("fa-IR").format(minutes) + " دقیقه";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return new Intl.NumberFormat("fa-IR").format(hours) + " ساعت" + (rest ? " و " + new Intl.NumberFormat("fa-IR").format(rest) + " دقیقه" : "");
}
export default function SmartRemindersList() {
  const {accounts:dashboardAccounts,accountId:dashboardAccountId,isReady:dashboardReady}=useDashboardAccountSelection();
  const activeDashboardAccount=dashboardAccounts.find(a=>a.id===dashboardAccountId&&a.isConnected);
  const router = useRouter();
  const listKey = activeDashboardAccount ? "smart-reminders:" + activeDashboardAccount.id : null;
  const [account, setAccount] = useState<Account | null>(() => listKey && getDashboardListSnapshot<Rule>(listKey) ? (activeDashboardAccount ?? null) : null);
  const [rules, setRules] = useState<Rule[]>(() => listKey ? getDashboardListSnapshot<Rule>(listKey) ?? [] : []);
  const [loadedFor, setLoadedFor] = useState<string | null>(() => listKey && getDashboardListSnapshot<Rule>(listKey) ? listKey : null);
  const [loading, setLoading] = useState(() => !(listKey && getDashboardListSnapshot<Rule>(listKey)));
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!dashboardReady) return;
    const controller = new AbortController();
    const key = "smart-reminders:" + (activeDashboardAccount?.id || "");
    const cached = activeDashboardAccount ? getDashboardListSnapshot<Rule>(key) : null;
    if (cached) {
      setAccount(activeDashboardAccount ?? null);
      setRules(cached);
      setLoadedFor(key);
      setLoading(false);
    } else {
      setRules([]);
      setLoadedFor(null);
      setLoading(true);
    }
    setError("");
    void (async () => {
      try {
        const connected=activeDashboardAccount;
        if (!connected) throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
        const response = await fetch("/api/smart-reminders?view=list&instagramAccountId=" + encodeURIComponent(connected.id), { cache: "no-store", credentials: "include", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "دریافت یادآوری‌ها ناموفق بود.");
        if (!controller.signal.aborted) {
          const next = (Array.isArray(data.data) ? data.data : []) as Rule[];
          setDashboardListSnapshot(key, next);
          setAccount(connected);
          setRules(next);
          setLoadedFor(key);
        }
      } catch (e) {
        if (!controller.signal.aborted && !cached) setError(e instanceof Error ? e.message : "خطا در بارگذاری یادآوری‌ها.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refresh,dashboardReady,activeDashboardAccount?.id]);

  const filtered = useMemo(() => rules.filter(r =>
    [r.text, smartReminderOptionName(r.automation)].some(text => text.toLocaleLowerCase("fa").includes(search.trim().toLocaleLowerCase("fa"))),
  ), [rules, search]);

  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(deleteTarget.id); setActionError("");
    try {
      const response = await fetch("/api/smart-reminders", {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "حذف یادآوری ناموفق بود.");
      setRules(current => {
        const next = current.filter(r => r.id !== deleteTarget.id);
        if (listKey) setDashboardListSnapshot(listKey, next);
        return next;
      });
      setDeleteTarget(null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "حذف یادآوری ناموفق بود."); }
    finally { setBusy(null); }
  }

  if (loading || (dashboardReady && Boolean(listKey) && loadedFor !== listKey && !error)) return <SmartReminderSkeleton />;
  if (error) return <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-4xl flex-col items-center justify-center gap-4 px-4">
    <p role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>
    <button onClick={() => setRefresh(v => v + 1)} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--daira-primary)] px-5 text-sm font-bold text-white"><RefreshCw size={16}/> تلاش دوباره</button>
  </div>;

  return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
    <button type="button" onClick={() => router.push("/dashboard/reminders/new")}
      dir="rtl" className="daira-create-action daira-leading-action flex min-h-[54px] w-full flex-row items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-sm transition hover:brightness-95"
      style={{ background: dairaPalette.primary.main }}><Plus size={20} aria-hidden="true" className="shrink-0"/><span>ایجاد یادآوری جدید</span></button>
    <label className="daira-search-field relative flex">
      <Search size={18} className="shrink-0 text-[var(--daira-search-placeholder)]"/>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو در یادآوری‌ها..." aria-label="جستجوی یادآوری‌ها"
        className="daira-search-input min-w-0 flex-1 border-0 bg-transparent text-base outline-none"/>
    </label>
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</p>}
    {filtered.length ? <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map(rule => <article key={rule.id} className="daira-automation-list-card space-y-3 rounded-2xl border border-[var(--daira-border)] bg-[var(--daira-surface)] p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]"><Clock3 size={18}/></span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-[var(--daira-heading)]">{smartReminderOptionName(rule.automation)}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--daira-text-secondary)]">ارسال پس از {duration(rule.delayMinutes)} بدون پاسخ</p>
          </div>
        </div>
        <p className="line-clamp-3 min-h-12 text-xs leading-6 text-[var(--daira-text-secondary)]">{rule.text}</p>
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--daira-text-secondary)]">
          <span className="rounded-lg bg-[var(--daira-neutral-bg)] px-2.5 py-1">ارسال‌شده: {new Intl.NumberFormat("fa-IR").format(rule._count?.deliveries || 0)}</span>
        </div>
        <div className="flex gap-2 border-t border-[var(--daira-neutral-bg)] pt-3">
          <button onClick={() => router.push("/dashboard/reminders/" + rule.id)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--daira-outline-hover-bg)] text-xs font-bold text-[var(--daira-primary-hover)]"><Pencil size={15}/> ویرایش</button>
          <button onClick={() => { setActionError(""); setDeleteTarget(rule); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--daira-error-border)] bg-white text-xs font-bold text-[var(--daira-error-text)]"><Trash2 size={15}/> حذف</button>
        </div>
      </article>)}
    </div> : <div className="daira-empty-state space-y-3 rounded-2xl border border-dashed border-[var(--daira-outline)] bg-[var(--daira-surface-hover)] px-4 py-14 text-center">
      <MessageSquare size={30} className="mx-auto text-[var(--daira-text-disabled)]"/>
      <p className="text-sm font-semibold text-[var(--daira-text-secondary)]">{search ? "یادآوری‌ای با این عبارت پیدا نشد." : "هنوز یادآوری هوشمندی ساخته نشده است."}</p>
      {!search && <p className="mx-auto max-w-md text-xs leading-6 text-[var(--daira-text-secondary)]">یک پاسخ خودکار را انتخاب کن، زمان انتظار و متن یادآوری را مشخص کن؛ اگر کاربر پاسخی ندهد و پنجره مجاز باشد، پیام ارسال می‌شود.</p>}
    </div>}
      <GlassModalPresence open={Boolean(deleteTarget)} onEscape={() => { if (!busy) setDeleteTarget(null); }}>
    {deleteTarget && <div className="daira-glass-overlay fixed inset-0 z-[2500] flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-label="حذف یادآوری" className="daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm rounded-2xl p-5">
        <div className="flex items-center justify-between"><strong className="text-base text-[var(--daira-heading)]">حذف یادآوری</strong><button onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)} aria-label="بستن"><X size={20}/></button></div>
        <p className="my-4 text-sm leading-7 text-[var(--daira-text-secondary)]">این یادآوری حذف می‌شود و یادآوری‌های زمان‌بندی‌شدهٔ آن دیگر ارسال نخواهند شد.</p>
        {actionError && <p role="alert" className="mb-3 text-xs text-red-600">{actionError}</p>}
        <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl border border-[var(--daira-border)] text-sm font-bold">انصراف</button>
          <button onClick={() => void remove()} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-[var(--daira-error-text)] text-sm font-bold text-white">{busy ? "در حال حذف..." : "حذف"}</button></div>
      </div>
    </div>}
    </GlassModalPresence>
  </div>;
}
