"use client";
import { useDashboardAccountSelection } from "./DashboardAccountContext";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import SmartReminderSkeleton from "./SmartReminderSkeleton";
import { smartReminderOptionName } from "@/lib/automation/smart-reminder-options";

type Account = { id: string; isConnected: boolean };
type Automation = { id: string; triggerType: string; keyword: string | null; keywordMatchMode?: string | null };
type Rule = { id: string; instagramAccountId: string; automationId: string; text: string; delayMinutes: number; isActive: boolean; automation: Automation };
type Draft = { automationId: string; delayMinutes: string; text: string };
const INITIAL: Draft = { automationId: "", delayMinutes: "60", text: "" };
function Guide({ number, title, hint }: { number: number; title: string; hint: string }) {
  return <div className="daira-guide-glass mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border, color: dairaPalette.guide.text }}>
    <Lightbulb size={17} className="mt-1 shrink-0" style={{ color: dairaPalette.guide.icon }}/>
    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: dairaPalette.guide.icon }}>{new Intl.NumberFormat("fa-IR").format(number)}</span><strong className="text-sm font-extrabold">{title}</strong></div><p className="mt-1 text-xs leading-6">{hint}</p></div>
  </div>;
}
const presets = [15, 30, 60, 120, 360, 720] as const;

export default function SmartReminderEditor({ id }: { id?: string }) {
  const {accounts:dashboardAccounts,accountId:dashboardAccountId,isReady:dashboardReady}=useDashboardAccountSelection();
  const activeDashboardAccount=dashboardAccounts.find(a=>a.id===dashboardAccountId&&a.isConnected);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [draft, setDraft] = useState<Draft>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const initialState = useRef("");
  const changed = useMemo(() => JSON.stringify(draft) !== initialState.current, [draft]);
  const eligible = Boolean(account && draft.automationId && draft.text.trim().length > 0 &&
    draft.text.trim().length <= 1000 && /^\d+$/.test(draft.delayMinutes) &&
    Number(draft.delayMinutes) >= 5 && Number(draft.delayMinutes) <= 1380 && (!id || changed) && !saving);
  const patch = (fields: Partial<Draft>) => setDraft(d => ({ ...d, ...fields }));

  useEffect(() => {
    if (!dashboardReady) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const connected=activeDashboardAccount;
        if (!connected) throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
        const response = await fetch("/api/smart-reminders?instagramAccountId=" + encodeURIComponent(connected.id), {
          cache: "no-store", credentials: "include", signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "دریافت یادآوری‌ها ناموفق بود.");
        const rules = (result.data || []) as Rule[];
        const existing = id ? rules.find(rule => rule.id === id) : null;
        if (id && !existing) throw new Error("یادآوری انتخاب‌شده پیدا نشد.");
        const options = ((result.automations || []) as Automation[]).filter(item =>
          Boolean(existing && item.id === existing.automationId) || !rules.some(rule => rule.automationId === item.id));
        if (existing && !options.some(item => item.id === existing.automationId)) options.unshift({
          ...existing.automation,
        });
        const next: Draft = existing ? { automationId: existing.automationId,
          delayMinutes: String(existing.delayMinutes), text: existing.text } : INITIAL;
        if (!controller.signal.aborted) {
          initialState.current = JSON.stringify(next);
          setAccount(connected); setAutomations(options); setDraft(next);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "بارگذاری ناموفق بود."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [id, retry,dashboardReady,activeDashboardAccount?.id]);

  async function save() {
    if (!eligible || !account) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/smart-reminders", {
        method: id ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, delayMinutes: Number(draft.delayMinutes), id, instagramAccountId: account.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "ذخیره یادآوری ناموفق بود.");
      router.push("/dashboard/reminders", { scroll: true });
    } catch (e) { setError(e instanceof Error ? e.message : "ذخیره یادآوری ناموفق بود."); }
    finally { setSaving(false); }
  }

  if (loading) return <SmartReminderSkeleton view="editor"/>;
  if (error && !account) return <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-4xl flex-col items-center justify-center gap-4 px-4">
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
    <button onClick={() => setRetry(n => n + 1)} className="min-h-11 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white">تلاش دوباره</button>
  </div>;

  return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
    <section>
      <Guide number={1} title="انتخاب پاسخ خودکار" hint="پس از ارسال پاسخ خودکار انتخاب‌شده، اگر کاربر پاسخی ندهد یادآوری زمان‌بندی می‌شود."/>
      <div className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <label htmlFor="reminder-automation" className="block text-xs font-semibold text-[var(--daira-input-label)]">انتخاب پاسخ خودکار</label>
        <select id="reminder-automation" value={draft.automationId} onChange={e => patch({ automationId: e.target.value })}
          className="min-h-12 w-full rounded-xl border border-[var(--daira-input-border)] bg-white px-3.5 text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)]">
          <option value="">یک پاسخ خودکار انتخاب کن</option>
          {automations.map(item => <option key={item.id} value={item.id}>{smartReminderOptionName(item)}</option>)}
        </select>
        {!automations.length && <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">پاسخ خودکار قابل انتخابی وجود ندارد. ابتدا یک پاسخ خودکار کامنت، استوری یا دایرکت با کلمهٔ کلیدی بساز.</p>}
        <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">برای پاسخ‌های کامنت، یادآوری فقط وقتی ارسال می‌شود که مشتری از قبل پنجرهٔ مجاز دایرکت را با پیام خود باز کرده باشد. کامنت به‌تنهایی مجوز ارسال پیام دوم نیست.</p>
      </div>
    </section>
    <section>
      <Guide number={2} title="زمان انتظار" hint="از لحظهٔ ارسال پاسخ خودکار محاسبه می‌شود. اگر کاربر در این فاصله پیام بفرستد، یادآوری لغو می‌شود."/>
      <div className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          {presets.map(minutes => <button type="button" key={minutes} onClick={() => patch({ delayMinutes: String(minutes) })}
            aria-pressed={draft.delayMinutes === String(minutes)}
            className={"min-h-11 rounded-xl border px-2 text-xs font-bold transition " + (draft.delayMinutes === String(minutes)
              ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-input-border)] bg-white text-[var(--daira-text-secondary)]")}>
            {minutes < 60 ? new Intl.NumberFormat("fa-IR").format(minutes) + " دقیقه" :
              new Intl.NumberFormat("fa-IR").format(minutes / 60) + " ساعت"}
          </button>)}
        </div>
        <label htmlFor="reminder-delay" className="block text-xs font-semibold text-[var(--daira-input-label)]">زمان دلخواه (دقیقه)</label>
        <input id="reminder-delay" type="number" min={5} max={1380} step={1} dir="ltr" value={draft.delayMinutes}
          onChange={e => patch({ delayMinutes: e.target.value })}
          className="min-h-12 w-full rounded-xl border border-[var(--daira-input-border)] px-3.5 text-center text-base outline-none focus:border-[var(--daira-primary)]"/>
        <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">بین ۵ دقیقه تا ۲۳ ساعت. اگر پنجرهٔ مجاز ۲۴ساعتهٔ Meta بسته شده باشد، پیام ارسال نمی‌شود.</p>
      </div>
    </section>
    <section>
      <Guide number={3} title="متن پیام یادآوری" hint="این متن فقط در صورت پاسخ‌ندادن کاربر و باز بودن پنجرهٔ مجاز در دایرکت ارسال می‌شود."/>
      <div className="space-y-2 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
        <label htmlFor="reminder-text" className="block text-xs font-semibold text-[var(--daira-input-label)]">متن یادآوری در دایرکت کاربر</label>
        <textarea id="reminder-text" rows={4} maxLength={1000} value={draft.text} onChange={e => patch({ text: e.target.value })}
          className="w-full resize-y rounded-xl border border-[var(--daira-input-border)] px-3.5 py-3 text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)]"/>
        <p className="text-left text-[11px] text-[var(--daira-text-disabled)]">{new Intl.NumberFormat("fa-IR").format(draft.text.length)} / ۱۰۰۰</p>
      </div>
    </section>
    {error && <p role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] p-3 text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
    <button type="button" disabled={!eligible} onClick={() => void save()}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
      {saving && <Loader2 size={17} className="animate-spin"/>}
      {!saving && <CheckCircle2 size={17}/>}
      {saving ? "در حال ذخیره..." : id ? "ذخیره تغییرات" : "ساخت یادآوری هوشمند"}
    </button>
  </div>;
}
