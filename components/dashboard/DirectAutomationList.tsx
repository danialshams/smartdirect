"use client";

import GlassModalPresence from "./GlassModalPresence";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, Trash2, X, RefreshCw } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import DirectAutomationSkeleton from "./DirectAutomationSkeleton";

type Account = { id: string; isConnected: boolean };
type Rule = { id: string; keyword: string | null; triggerType: string; updatedAt: string; createdAt: string; messages?: Array<{ messageType: string }> };
const formatWords = (value: string | null) => (value || "").split(/[,،;؛\n]+/).map(word => word.trim()).filter(Boolean).join("، ");
const formatDate = (value: string) => value ? new Date(value).toLocaleString("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }) : "";
const typeLabels: Record<string, string> = { TEXT: "متن", IMAGE: "عکس", VIDEO: "ویدیو", AUDIO: "وویس", SHOWCASE: "ویترین", FORM: "فرم" };
export default function DirectAutomationList() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [target, setTarget] = useState<Rule | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "دریافت پیج ناموفق بود.");
        const account = (Array.isArray(data.accounts) ? data.accounts : []).find((item: Account) => item.isConnected);
        if (!account) throw new Error("پیج اینستاگرام متصل نیست.");
        const listResponse = await fetch("/api/automations?instagramAccountId=" + encodeURIComponent(account.id),
          { cache: "no-store", credentials: "include", signal: controller.signal });
        const list = await listResponse.json();
        if (!listResponse.ok || !list.success) throw new Error(list.error || "دریافت پاسخ‌ها ناموفق بود.");
        if (!controller.signal.aborted) {
          const rows = (Array.isArray(list.data) ? list.data : []) as Rule[];
          setRules(rows.filter(item => item.triggerType === "DM" && Boolean(item.keyword?.trim()))
            .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt)));
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "بارگذاری پاسخ‌های خودکار ناموفق بود.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fa-IR");
    return rules.filter(item => !query || formatWords(item.keyword).toLocaleLowerCase("fa-IR").includes(query) ||
      (typeLabels[item.messages?.[0]?.messageType || ""] || "").includes(query));
  }, [rules, search]);

  async function remove() {
    if (!target || deleting) return;
    setDeleting(true); setError("");
    try {
      const response = await fetch("/api/automations/" + encodeURIComponent(target.id), { method: "DELETE", credentials: "include" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "حذف پاسخ خودکار ناموفق بود.");
      setRules(current => current.filter(item => item.id !== target.id));
      setTarget(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "حذف پاسخ ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <DirectAutomationSkeleton />;

  return (
    <div dir="rtl" className="min-h-[calc(100dvh-2rem)]">
      <div className="mx-auto w-full max-w-4xl">
        <section className="mb-4 px-0 pt-1">
          <button type="button" onClick={() => router.push("/dashboard/direct-automation/new")}
            className="daira-leading-action flex min-h-[54px] w-full flex-row items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95"
            style={{ background: dairaPalette.primary.main }}>
            <Plus size={20} aria-hidden="true" />
            <span>ایجاد پاسخ جدید</span>
          </button>
        </section>
        <div className="min-h-full px-1 py-2 sm:px-2 sm:py-3">
          <section className="rounded-[28px] bg-transparent">
            {!error && rules.length > 0 ? (
              <div className="mb-4 px-1">
                <label className="daira-search-field flex h-11 items-center gap-2.5 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 text-[var(--daira-text-secondary)] transition ">
                  <Search size={17} className="shrink-0" aria-hidden="true" />
                  <input type="search" value={search} onChange={event => setSearch(event.target.value)}
                    placeholder="جستجو براساس کلمه کلیدی..." aria-label="جستجو براساس کلمه کلیدی"
                    className="daira-search-input h-full min-w-0 flex-1 bg-transparent text-base text-[var(--daira-heading)] outline-none placeholder:text-[var(--daira-text-disabled)] sm:text-sm" />
                </label>
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium text-[var(--daira-error-text)]">
                <span>{error}</span>
                <button type="button" onClick={() => setRefresh(value => value + 1)} aria-label="تلاش دوباره"><RefreshCw size={17} /></button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="daira-empty-state flex min-h-28 items-center justify-center rounded-xl border border-[var(--daira-border)] px-4 text-center text-xs font-medium text-[var(--daira-text-disabled)]">
                {search ? "پاسخی با این کلمه کلیدی پیدا نشد." : "هنوز پاسخ خودکاری برای نمایش وجود ندارد."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map(item => (
                  <div key={item.id} className="daira-automation-list-card flex min-h-[84px] items-center justify-between gap-3 rounded-[22px] border border-[var(--daira-border)] bg-[var(--daira-surface)] px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                        <div className="max-w-full rounded-xl px-3 py-2 text-[13px] font-bold leading-6"
                          style={{ color: dairaPalette.primary.main, backgroundColor: dairaPalette.secondary.hoverBackground,
                            border: "1px solid " + dairaPalette.secondary.activeBackground }}>
                          <span className="break-words">{formatWords(item.keyword)}</span>
                        </div>
                        <span className="text-[11px] font-medium" style={{ color: dairaPalette.text.muted }}>
                          {formatDate(item.updatedAt || item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link href={"/dashboard/direct-automation/" + encodeURIComponent(item.id)}
                        className="daira-reply-list-edit">
                        <span>ویرایش</span>
                        <Pencil size={14} />
                      </Link>
                      <button type="button" onClick={() => setTarget(item)} aria-label={"حذف پاسخ " + formatWords(item.keyword)}
                        className="daira-reply-list-delete">
                        <span>حذف</span>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <GlassModalPresence open={Boolean(target)} onEscape={() => { if (!deleting) setTarget(null); }}>
      {target && (
        <div className="daira-glass-overlay fixed inset-0 z-[9998] flex items-center justify-center bg-[rgba(24,35,60,.36)] px-4 py-6 backdrop-blur-md"
          onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="direct-delete-title"
            className="daira-glass-dialog daira-glass-dialog--danger w-full max-w-sm space-y-4 rounded-[24px] p-5">
            <div className="flex items-start justify-between">
              <h2 id="direct-delete-title" className="font-bold text-[var(--daira-heading)]">حذف پاسخ خودکار دایرکت؟</h2>
              <button type="button" disabled={deleting} onClick={() => setTarget(null)} aria-label="بستن"><X size={18} /></button>
            </div>
            <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">پاسخ «{formatWords(target.keyword)}» حذف می‌شود و دیگر برای کاربران ارسال نخواهد شد.</p>
            <div className="flex gap-2">
              <button type="button" disabled={deleting} onClick={() => setTarget(null)}
                className="min-h-11 flex-1 rounded-xl border border-[var(--daira-border)] text-xs font-bold">انصراف</button>
              <button type="button" disabled={deleting} onClick={() => void remove()}
                className="min-h-11 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white disabled:opacity-50">
                {deleting ? "در حال حذف..." : "حذف پاسخ"}
              </button>
            </div>
          </section>
        </div>
      )}
      </GlassModalPresence>
    </div>
  );
}
