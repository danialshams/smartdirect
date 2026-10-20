"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RadioTower, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";
import { parseLiveRule, type LiveRule } from "@/lib/live-replies/config";

type Account = { id: string; igUsername: string; isConnected: boolean };
type Row = { id: string; updatedAt: string; config: LiveRule };

export default function LiveAutomationManager() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const run = async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { signal: controller.signal, cache: "no-store" });
        const accountsData = await response.json();
        if (!response.ok || !accountsData?.success) throw new Error(accountsData?.error || "دریافت پیج ناموفق بود.");
        const account = (Array.isArray(accountsData.accounts) ? accountsData.accounts : [] as Account[])
          .find((item: Account) => item.isConnected);
        if (!account) throw new Error("ابتدا پیج اینستاگرام خود را متصل کنید.");
        const listResponse = await fetch("/api/live-automations?instagramAccountId=" + encodeURIComponent(account.id),
          { signal: controller.signal, cache: "no-store" });
        const result = await listResponse.json();
        if (!listResponse.ok || !result?.success) throw new Error(result?.error || "دریافت پاسخ‌های خودکار لایو ناموفق بود.");
        const loaded: Row[] = [];
        for (const item of Array.isArray(result.data) ? result.data : []) {
          try { loaded.push({ id: item.id, updatedAt: item.updatedAt, config: parseLiveRule(item.config) }); }
          catch { continue; }
        }
        if (!controller.signal.aborted) setRows(loaded);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "دریافت پاسخ‌های لایو ناموفق بود.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [reload]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fa-IR");
    if (!q) return rows;
    return rows.filter((item) => item.config.keywords.some((keyword) => keyword.includes(q))
      || item.config.initialText.toLocaleLowerCase("fa-IR").includes(q));
  }, [rows, query]);
  const remove = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setError("");
    try {
      const response = await fetch("/api/live-automations/" + encodeURIComponent(deleteTarget.id), {
        method: "DELETE", credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "حذف پاسخ خودکار لایو ناموفق بود.");
      setRows((items) => items.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { setError(e instanceof Error ? e.message : "حذف پاسخ خودکار لایو ناموفق بود."); }
    finally { setDeletingId(null); }
  };
  if (loading) return <LiveAutomationSkeleton mode="list" />;
  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 pb-12 pt-2">
      <button type="button" onClick={() => router.push("/dashboard/live-automation/new")}
        className="flex min-h-[54px] w-full flex-row-reverse items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95"
        style={{ background: dairaPalette.primary.main }}>
        <Plus size={20} aria-hidden="true" /> ایجاد پاسخ جدید
      </button>
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو در کلمات کلیدی یا متن پاسخ..."
          aria-label="جستجوی پاسخ خودکار لایو"
          className="w-full rounded-xl border border-[#E2E8F0] bg-white py-3 pl-4 pr-10 text-base outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB]" />
      </div>
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs leading-6 text-[#B91C1C]">
          {error}
          <button type="button" onClick={() => setReload((x) => x + 1)} className="font-bold underline">تلاش دوباره</button>
        </div>
      )}
      {!rows.length && !error ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center">
          <RadioTower size={32} className="mx-auto text-[#94A3B8]" />
          <h2 className="text-sm font-bold text-[#0F172A]">هنوز پاسخی برای لایو ساخته نشده است.</h2>
          <p className="text-xs leading-6 text-[#64748B]">با کلمات کلیدی لایو، یک دایرکت خودکار برای بیننده ارسال کن.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#64748B]">پاسخی با این عبارت پیدا نشد.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <article key={item.id} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_3px_12px_rgba(24,35,60,0.025)]">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                  <RadioTower size={16} className="text-[#2563EB]" /> پاسخ خودکار لایو
                </div>
                <span className="rounded-full bg-[#F1F5F9] px-2 py-1 text-[11px] font-semibold text-[#64748B]">
                  {item.config.mode === "DIRECT" ? "پاسخ مستقیم" : "چندمرحله‌ای"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.config.keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">{keyword}</span>
                ))}
              </div>
              <p className="line-clamp-2 min-h-10 text-xs leading-6 text-[#475569]">{item.config.initialText}</p>
              {item.config.requireFollow && <p className="text-xs font-semibold text-[#2563EB]">اجبار به فالو فعال است</p>}
              <div className="flex gap-2 border-t border-[#F1F5F9] pt-3">
                <button type="button" onClick={() => router.push("/dashboard/live-automation/" + item.id)}
                  className="sd-neutral-button flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D8E0EC] text-xs font-bold text-[#2563EB] transition hover:bg-[#EFF6FF]">
                  <Pencil size={15} /> ویرایش
                </button>
                <button type="button" onClick={() => setDeleteTarget(item)} aria-label="حذف پاسخ خودکار"
                  className="sd-destructive-button flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#FECACA] text-xs font-bold text-[#DC2626] transition hover:bg-[#FEF2F2]">
                  <Trash2 size={15} /> حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {deleteTarget && (
        <div role="presentation" className="fixed inset-0 z-[2300] flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !deletingId) setDeleteTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-live-title"
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 id="delete-live-title" className="text-base font-bold text-[#0F172A]">حذف پاسخ خودکار لایو؟</h2>
              <button type="button" aria-label="بستن" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)}><X size={18}/></button>
            </div>
            <p className="text-sm leading-7 text-[#64748B]">این پاسخ از فهرست حذف می‌شود و برای پیام‌های جدید لایو اجرا نخواهد شد.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}
                className="sd-neutral-button min-h-11 rounded-xl border border-[#E2E8F0] text-sm font-bold text-[#475569]">انصراف</button>
              <button type="button" disabled={Boolean(deletingId)} onClick={() => void remove()}
                className="sd-destructive-button min-h-11 rounded-xl bg-[#DC2626] text-sm font-bold text-white disabled:opacity-50">
                {deletingId ? "در حال حذف..." : "حذف"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
