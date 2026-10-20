"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, Clock3, RefreshCw, X, MessageSquare } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import SmartReminderSkeleton from "./SmartReminderSkeleton";

type Account = { id: string; isConnected: boolean };
type Rule = {
  id: string; automationId: string; instagramAccountId: string;
  delayMinutes: number; text: string; isActive: boolean;
  automation: { keyword: string | null; triggerType: string; isActive: boolean };
  _count?: { deliveries: number };
};
function automationName(rule: Rule) {
  const type = rule.automation.triggerType === "STORY_REPLY_KEYWORD" ? "پاسخ استوری" : "پاسخ دایرکت";
  return rule.automation.keyword?.trim()
    ? type + " — " + rule.automation.keyword.replace(/,/g, "، ")
    : type;
}
function duration(minutes: number) {
  if (minutes < 60) return new Intl.NumberFormat("fa-IR").format(minutes) + " دقیقه";
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return new Intl.NumberFormat("fa-IR").format(hours) + " ساعت" + (rest ? " و " + new Intl.NumberFormat("fa-IR").format(rest) + " دقیقه" : "");
}
export default function SmartRemindersList() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include", signal: controller.signal });
        const accounts = await accountsResponse.json();
        if (!accountsResponse.ok || !accounts.success) throw new Error(accounts.error || "دریافت پیج‌های اینستاگرام ناموفق بود.");
        const connected = (Array.isArray(accounts.accounts) ? accounts.accounts : []).find((a: Account) => a.isConnected);
        if (!connected) throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
        const response = await fetch("/api/smart-reminders?instagramAccountId=" + encodeURIComponent(connected.id), { cache: "no-store", credentials: "include", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "دریافت یادآوری‌ها ناموفق بود.");
        if (!controller.signal.aborted) { setAccount(connected); setRules(data.data || []); }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "خطا در بارگذاری یادآوری‌ها.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(() => rules.filter(r =>
    [r.text, automationName(r)].some(text => text.toLocaleLowerCase("fa").includes(search.trim().toLocaleLowerCase("fa"))),
  ), [rules, search]);

  async function toggle(rule: Rule) {
    if (busy) return;
    setBusy(rule.id); setActionError("");
    try {
      const response = await fetch("/api/smart-reminders", {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, instagramAccountId: rule.instagramAccountId,
          automationId: rule.automationId, delayMinutes: rule.delayMinutes,
          text: rule.text, isActive: !rule.isActive }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "تغییر وضعیت ناموفق بود.");
      setRules(current => current.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch (e) { setActionError(e instanceof Error ? e.message : "خطا در تغییر وضعیت."); }
    finally { setBusy(null); }
  }
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
      setRules(current => current.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "حذف یادآوری ناموفق بود."); }
    finally { setBusy(null); }
  }

  if (loading) return <SmartReminderSkeleton />;
  if (error) return <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-4xl flex-col items-center justify-center gap-4 px-4">
    <p role="alert" className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{error}</p>
    <button onClick={() => setRefresh(v => v + 1)} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white"><RefreshCw size={16}/> تلاش دوباره</button>
  </div>;

  return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
    <button type="button" onClick={() => router.push("/dashboard/reminders/new")}
      className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white shadow-sm transition hover:brightness-95"
      style={{ background: dairaPalette.primary.main }}><Plus size={20}/> ایجاد یادآوری جدید</button>
    <label className="relative block">
      <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"/>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو در یادآوری‌ها..." aria-label="جستجوی یادآوری‌ها"
        className="min-h-12 w-full rounded-xl border border-[#DBE2ED] bg-white py-3 pl-4 pr-10 text-base outline-none focus:border-[#2563EB]"/>
    </label>
    {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{actionError}</p>}
    {filtered.length ? <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map(rule => <article key={rule.id} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_3px_12px_rgba(24,35,60,0.025)]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><Clock3 size={18}/></span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-[#0F172A]">{automationName(rule)}</h3>
            <p className="mt-0.5 text-[11px] text-[#64748B]">ارسال پس از {duration(rule.delayMinutes)} بدون پاسخ</p>
          </div>
          <label className="shrink-0 cursor-pointer" aria-label="وضعیت یادآوری">
            <input type="checkbox" role="switch" className="daira-form-switch -scale-x-100" checked={rule.isActive}
              disabled={Boolean(busy)} onChange={() => void toggle(rule)} aria-label={rule.isActive ? "غیرفعال‌کردن یادآوری" : "فعال‌کردن یادآوری"}/>
          </label>
        </div>
        <p className="line-clamp-3 min-h-12 text-xs leading-6 text-[#475569]">{rule.text}</p>
        <div className="flex flex-wrap gap-2 text-[11px] text-[#64748B]">
          <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1">{rule.isActive ? "فعال" : "غیرفعال"}</span>
          <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1">ارسال‌شده: {new Intl.NumberFormat("fa-IR").format(rule._count?.deliveries || 0)}</span>
        </div>
        <div className="flex gap-2 border-t border-[#F1F5F9] pt-3">
          <button onClick={() => router.push("/dashboard/reminders/" + rule.id)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#EFF6FF] text-xs font-bold text-[#1D4ED8]"><Pencil size={15}/> ویرایش</button>
          <button onClick={() => { setActionError(""); setDeleteTarget(rule); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#FECACA] bg-white text-xs font-bold text-[#DC2626]"><Trash2 size={15}/> حذف</button>
        </div>
      </article>)}
    </div> : <div className="space-y-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-14 text-center">
      <MessageSquare size={30} className="mx-auto text-[#94A3B8]"/>
      <p className="text-sm font-semibold text-[#475569]">{search ? "یادآوری‌ای با این عبارت پیدا نشد." : "هنوز یادآوری هوشمندی ساخته نشده است."}</p>
      {!search && <p className="mx-auto max-w-md text-xs leading-6 text-[#64748B]">برای اتوماسیون دایرکت یا استوری، زمان انتظار و متن یادآوری را مشخص کن؛ اگر کاربر پاسخی ندهد و پنجره مجاز باشد، پیام ارسال می‌شود.</p>}
    </div>}
    {deleteTarget && <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-[#18233C]/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="حذف یادآوری" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><strong className="text-base text-[#18233C]">حذف یادآوری</strong><button onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)} aria-label="بستن"><X size={20}/></button></div>
        <p className="my-4 text-sm leading-7 text-[#64748B]">این یادآوری حذف می‌شود و یادآوری‌های زمان‌بندی‌شدهٔ آن دیگر ارسال نخواهند شد.</p>
        {actionError && <p role="alert" className="mb-3 text-xs text-red-600">{actionError}</p>}
        <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl border border-[#E2E8F0] text-sm font-bold">انصراف</button>
          <button onClick={() => void remove()} disabled={Boolean(busy)} className="min-h-11 flex-1 rounded-xl bg-[#DC2626] text-sm font-bold text-white">{busy ? "در حال حذف..." : "حذف"}</button></div>
      </div>
    </div>}
  </div>;
}
