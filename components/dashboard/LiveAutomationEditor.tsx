"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { dairaPalette } from "@/lib/design-system/palette";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem } from "./automation-form-utils";
import PublishingStoryAutomationSetup from "./publishing/PublishingStoryAutomationSetup";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";

type Account = { id: string; igUsername: string; isConnected: boolean };
type Rule = {
  id: string; instagramAccountId: string; keyword: string; matchMode: "EXACT" | "CONTAINS_ANY";
  initialText: string; followupEnabled: boolean; followupKeyword: string;
  requireFollow: boolean; followGateText: string; updatedAt: string; messages: unknown[];
};
type Draft = {
  keyword: string; matchMode: "EXACT" | "CONTAINS_ANY"; initialText: string;
  followupEnabled: boolean; followupKeyword: string; requireFollow: boolean;
  followGateText: string; message: MessageDraft;
};
const emptyDraft = (): Draft => ({
  keyword: "", matchMode: "EXACT", initialText: "", followupEnabled: false,
  followupKeyword: "ارسال کن", requireFollow: false,
  followGateText: "برای دریافت پاسخ ابتدا پیج را فالو کن.", message: createEmptyMessage(),
});
function snapshot(draft: Draft) {
  return JSON.stringify({
    keyword: draft.keyword.split(/[,،;؛\n]+/).map(s => s.trim()).filter(Boolean).join(","),
    matchMode: draft.matchMode, initialText: draft.initialText,
    followupEnabled: draft.followupEnabled,
    followupKeyword: draft.followupEnabled ? draft.followupKeyword : "",
    requireFollow: draft.requireFollow,
    followGateText: draft.requireFollow ? draft.followGateText : "",
    message: draft.followupEnabled ? draft.message : null,
  });
}
function Guide({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border, color: dairaPalette.guide.text }}>
      <Lightbulb size={17} className="mt-1 shrink-0" style={{ color: dairaPalette.guide.icon }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: dairaPalette.guide.icon }}>
            {new Intl.NumberFormat("fa-IR").format(number)}
          </span>
          <strong className="text-sm font-extrabold">{title}</strong>
        </div>
        {hint && <p className="mt-1 text-xs leading-6">{hint}</p>}
      </div>
    </div>
  );
}

export default function LiveAutomationEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showcaseDirty, setShowcaseDirty] = useState(false);
  const initialSnapshot = useRef("");
  const initialVersion = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadingResources(true);
    setError("");
    void (async () => {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include", signal: controller.signal });
        const accountsResult = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsResult.success) throw new Error(accountsResult.error || "دریافت اکانت اینستاگرام ناموفق بود.");
        let rule: Rule | null = null;
        if (id) {
          const response = await fetch("/api/live-automation/" + encodeURIComponent(id), { cache: "no-store", credentials: "include", signal: controller.signal });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || "پاسخ لایو پیدا نشد.");
          rule = result.data as Rule;
        }
        const accounts = (accountsResult.accounts || []) as Account[];
        const connected = rule
          ? accounts.find(a => a.id === rule?.instagramAccountId && a.isConnected)
          : accounts.find(a => a.isConnected);
        if (!connected) throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
        const nextDraft: Draft = rule ? {
          keyword: rule.keyword.replace(/,/g, "، "), matchMode: rule.matchMode,
          initialText: rule.initialText, followupEnabled: rule.followupEnabled,
          followupKeyword: rule.followupKeyword || "ارسال کن",
          requireFollow: rule.requireFollow, followGateText: rule.followGateText || "برای دریافت پاسخ ابتدا پیج را فالو کن.",
          message: normalizeMessages(rule.messages || [])[0] ?? createEmptyMessage(),
        } : emptyDraft();
        // Match the exact form shown on screen when calculating whether the user edited it.
        initialSnapshot.current = snapshot(nextDraft);
        initialVersion.current = rule?.updatedAt || "";
        if (!controller.signal.aborted) {
          setAccount(connected);
          setDraft(nextDraft);
          setLoading(false);
        }
        const query = "?instagramAccountId=" + encodeURIComponent(connected.id);
        const [s, f] = await Promise.all([
          fetch("/api/showcases" + query, { cache: "no-store", credentials: "include", signal: controller.signal }),
          fetch("/api/forms" + query, { cache: "no-store", credentials: "include", signal: controller.signal }),
        ]);
        const [showcaseResponse, formsResponse] = await Promise.all([s.json(), f.json()]);
        if (!controller.signal.aborted) {
          setShowcases(Array.isArray(showcaseResponse) ? showcaseResponse : showcaseResponse.data || []);
          setForms(Array.isArray(formsResponse) ? formsResponse : formsResponse.data || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "بارگذاری پاسخ لایو ناموفق بود.");
      } finally {
        if (!controller.signal.aborted) { setLoading(false); setLoadingResources(false); }
      }
    })();
    return () => controller.abort();
  }, [id, retry]);

  const dirty = useMemo(() => snapshot(draft) !== initialSnapshot.current || showcaseDirty, [draft, showcaseDirty]);
  const keywords = useMemo(() => draft.keyword.split(/[,،;؛\n]+/).map(s => s.trim()).filter(Boolean), [draft.keyword]);
  const basicValid = keywords.length > 0 && keywords.length <= 10 && draft.initialText.trim().length > 0 &&
    draft.initialText.trim().length <= 1000 && (!draft.requireFollow || Boolean(draft.followGateText.trim())) &&
    (!draft.followupEnabled || Boolean(draft.followupKeyword.trim()));
  const canSave = Boolean(account && basicValid && !loadingResources && !saving && (!id || dirty));
  const patch = (value: Partial<Draft>) => { setDraft(current => ({ ...current, ...value })); setSaved(false); };

  async function save() {
    if (!canSave || !account) return;
    setSaving(true);
    setError("");
    const payload = {
      instagramAccountId: account.id,
      keyword: draft.keyword, matchMode: draft.matchMode, initialText: draft.initialText,
      followupEnabled: draft.followupEnabled, followupKeyword: draft.followupKeyword,
      requireFollow: draft.requireFollow, followGateText: draft.followGateText,
      message: draft.followupEnabled ? draft.message : null, expectedUpdatedAt: initialVersion.current,
    };
    try {
      const response = await fetch(id ? "/api/live-automation/" + encodeURIComponent(id) : "/api/live-automation", {
        method: id ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "ذخیره پاسخ خودکار لایو ناموفق بود.");
      setSaved(true);
      router.push("/dashboard/live-automation", { scroll: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره پاسخ خودکار لایو ناموفق بود.");
    } finally { setSaving(false); }
  }

  if (loading) return <LiveAutomationSkeleton view="editor" />;
  if (error && !account) return (
    <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-4xl flex-col items-center justify-center gap-4 px-4">
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      <button type="button" onClick={() => setRetry(v => v + 1)} className="min-h-11 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      <section>
        <Guide number={1} title="کلمات کلیدی" hint="وقتی بیننده داخل لایو یکی از این عبارت‌ها را بنویسد، دایرکت ارسال می‌شود." />
        <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="روش تشخیص عبارت لایو">
            {([{ value: "EXACT", label: "عبارت دقیق" }, { value: "CONTAINS_ANY", label: "شامل کلمه" }] as const).map(item => (
              <button key={item.value} type="button" aria-pressed={draft.matchMode === item.value}
                onClick={() => patch({ matchMode: item.value })}
                className={"min-h-11 rounded-xl border px-3 text-xs font-bold transition " + (draft.matchMode === item.value ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#D8E0EC] bg-white text-[#475569]")}>
                {item.label}
              </button>
            ))}
          </div>
          <label htmlFor="live-keyword" className="block text-xs font-semibold text-[#334155]">عبارت‌های فعال‌کننده (حداکثر ۱۰ مورد)</label>
          <textarea id="live-keyword" rows={2} value={draft.keyword} onChange={e => patch({ keyword: e.target.value })}
            placeholder="مثلاً قیمت، خرید، لینک" className="w-full resize-y rounded-xl border border-[#D8E0EC] px-3.5 py-3 text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB]" />
        </div>
      </section>

      <section>
        <Guide number={2} title="دایرکت اولیه" hint="اولین پاسخ به نوشته بیننده در لایو فقط متن است؛ لینک را می‌توان داخل متن گذاشت." />
        <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <label htmlFor="live-intro" className="block text-xs font-semibold text-[#334155]">متن پاسخ</label>
          <textarea id="live-intro" rows={4} maxLength={1000} value={draft.initialText} onChange={e => patch({ initialText: e.target.value })}
            placeholder="سلام! برای دریافت قیمت و مشخصات محصول، همینجا بنویس «ارسال کن»."
            className="w-full resize-y rounded-xl border border-[#D8E0EC] px-3.5 py-3 text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB]" />
          <p className="text-left text-[11px] text-[#94A3B8]">{new Intl.NumberFormat("fa-IR").format(draft.initialText.length)} / ۱۰۰۰</p>
        </div>
      </section>

      <section>
        <Guide number={3} title="ادامهٔ پاسخ در دایرکت" hint="اختیاری؛ ابتدا بیننده باید خودش به دایرکت پاسخ دهد تا ارسال فرم یا فایل مجاز شود." />
        <div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-bold text-[#0F172A]">پاسخ چندمرحله‌ای</span>
            <input type="checkbox" role="switch" className="daira-form-switch shrink-0 -scale-x-100"
              checked={draft.followupEnabled} onChange={e => patch({ followupEnabled: e.target.checked })}/>
          </label>
          {draft.followupEnabled && (
            <div className="space-y-4 border-t border-[#F1F5F9] pt-4">
              <div className="space-y-2">
                <label htmlFor="live-followup-keyword" className="block text-xs font-semibold text-[#334155]">کلمهٔ ادامهٔ گفتگو</label>
                <input id="live-followup-keyword" maxLength={60} value={draft.followupKeyword} onChange={e => patch({ followupKeyword: e.target.value })}
                  placeholder="مثلاً ارسال کن" className="min-h-12 w-full rounded-xl border border-[#D8E0EC] px-3.5 text-base outline-none focus:border-[#2563EB]" />
              </div>
              <div className="border-t border-[#F1F5F9] pt-4">
                <PublishingStoryAutomationSetup
                  message={draft.message}
                  instagramAccountId={account?.id || ""}
                  showcases={showcases}
                  forms={forms}
                  loadingResources={loadingResources}
                  onUpdate={changes => patch({ message: { ...draft.message, ...changes } })}
                  keywordValid
                  onContinue={() => undefined}
                  storyCreateMode
                  storyEditMode={Boolean(id)}
                  onDraftChange={setShowcaseDirty}
                  responseTypeTitle="نوع پاسخ بعد از دریافت پیام"
                  responseTypeDescription=""
                  textPlaceholder="متن پاسخی که بعد از «ارسال کن» برای بیننده فرستاده می‌شود..."
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <Guide number={4} title="اجبار به فالو" hint="اختیاری؛ اگر کاربر فالو نکند، ابتدا پیام درخواست فالو دریافت می‌کند." />
        <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <strong className="text-sm text-[#0F172A]">اجبار به فالو</strong>
            <input type="checkbox" role="switch" className="daira-form-switch shrink-0 -scale-x-100"
              checked={draft.requireFollow} onChange={e => patch({ requireFollow: e.target.checked })}/>
          </label>
          {draft.requireFollow && (
            <div className="space-y-2 border-t border-[#F1F5F9] pt-4">
              <label htmlFor="live-follow-gate" className="block text-xs font-semibold text-[#334155]">متن درخواست فالو</label>
              <textarea id="live-follow-gate" rows={3} maxLength={640}
                value={draft.followGateText} onChange={e => patch({ followGateText: e.target.value })}
                placeholder="برای دریافت اطلاعات، ابتدا پیج را فالو کن."
                className="w-full resize-y rounded-xl border border-[#D8E0EC] px-3.5 py-3 text-base leading-7 outline-none focus:border-[#2563EB]" />
            </div>
          )}
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs leading-6 text-[#B91C1C]">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 text-sm text-[#166534]"><CheckCircle2 size={16}/> تغییرات ذخیره شد.</p>}
      <button type="button" disabled={!canSave} onClick={() => void save()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">
        {saving && <Loader2 size={17} className="animate-spin"/>}
        {saving ? "در حال ذخیره..." : id ? "ذخیره تغییرات" : "ساخت پاسخ خودکار"}
      </button>
    </div>
  );
}
