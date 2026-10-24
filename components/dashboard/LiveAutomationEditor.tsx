"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import ResponseModeSwitcher from "./ResponseModeSwitcher";
import CompleteAutomationPicker from "./CompleteAutomationPicker";
import { dairaPalette } from "../../lib/design-system/palette";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem } from "./automation-form-utils";
import PublishingStoryAutomationSetup, { type PublishingStoryAutomationSetupHandle } from "./publishing/PublishingStoryAutomationSetup";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";

type Account = { id: string; igUsername: string; isConnected: boolean };
type Rule = {
  id: string; instagramAccountId: string; title?: string; keyword: string; matchMode: "EXACT" | "CONTAINS_ANY";
  initialText: string; followupEnabled: boolean; followupKeyword: string;
  requireFollow: boolean; followGateText: string; followGateButtonText: string; updatedAt: string; messages: unknown[];
};
type Draft = {
  responseName: string; keyword: string; matchMode: "EXACT" | "CONTAINS_ANY"; initialText: string;
  followupEnabled: boolean; followupKeyword: string; requireFollow: boolean;
  followGateText: string; followGateButtonText: string; message: MessageDraft;
};
const emptyDraft = (): Draft => ({
  responseName: "", keyword: "", matchMode: "EXACT", initialText: "", followupEnabled: false,
  followupKeyword: "ارسال کن", requireFollow: false,
  followGateText: "برای دریافت پاسخ ابتدا پیج را فالو کن.",
  followGateButtonText: "بررسی فالو", message: createEmptyMessage(),
});
function snapshot(draft: Draft) {
  return JSON.stringify({
    responseName: draft.responseName.trim(),
    keyword: draft.matchMode === "CONTAINS_ANY" && !draft.keyword.trim() ? "" : draft.keyword.split(/[,،;؛\n]+/).map(s => s.trim()).filter(Boolean).join(","),
    matchMode: draft.matchMode, initialText: draft.initialText,
    followupEnabled: draft.followupEnabled,
    followupKeyword: draft.followupEnabled ? draft.followupKeyword : "",
    requireFollow: draft.requireFollow,
    followGateText: draft.requireFollow ? draft.followGateText : "",
    followGateButtonText: draft.requireFollow ? draft.followGateButtonText : "",
    message: draft.followupEnabled ? draft.message : null,
  });
}
function Guide({ number, title, hint }: { number: number; title: string; hint?: string }) {
  return (
    <div className="daira-guide-glass mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border, color: dairaPalette.guide.text }}>
      <Lightbulb size={17} className="mt-1 shrink-0" style={{ color: dairaPalette.guide.icon }} />
      <div className="min-w-0 flex-1">
        <div className="daira-keyword-field flex items-center gap-2">
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
  const responseEditorRef = useRef<PublishingStoryAutomationSetupHandle>(null);
  const introSaveRef = useRef<((draft: MessageDraft) => Promise<boolean>) | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showcaseDirty, setShowcaseDirty] = useState(false);
  const [liveRules, setLiveRules] = useState<Rule[]>([]);
  const [loadingLiveRules, setLoadingLiveRules] = useState(true);
  const [creationMode, setCreationMode] = useState<"new" | "existing">("new");
  const [selectedLiveRuleId, setSelectedLiveRuleId] = useState("");
  const [editingView, setEditingView] = useState<"edit" | "replace">("edit");
  const initialSnapshot = useRef("");
  const initialVersion = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadingResources(true);
    setLoadingLiveRules(true);
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
          responseName: rule.title || "", keyword: rule.keyword.replace(/,/g, "، "), matchMode: rule.matchMode,
          initialText: rule.initialText, followupEnabled: rule.followupEnabled,
          followupKeyword: rule.followupKeyword || "ارسال کن",
          requireFollow: rule.requireFollow, followGateText: rule.followGateText || "برای دریافت پاسخ ابتدا پیج را فالو کن.",
          followGateButtonText: rule.followGateButtonText || "بررسی فالو",
          message: normalizeMessages(rule.messages || [])[0] ?? createEmptyMessage(),
        } : emptyDraft();
        // Match the exact form shown on screen when calculating whether the user edited it.
        initialSnapshot.current = snapshot(nextDraft);
        initialVersion.current = rule?.updatedAt || "";
        if (!controller.signal.aborted) {
          setAccount(connected);
          setDraft(nextDraft);
        }
        const query = "?instagramAccountId=" + encodeURIComponent(connected.id);
        // Complete live rules are separate from individual saved DM messages.
        try {
          const available = await fetch("/api/live-automation" + query, {
            cache: "no-store", credentials: "include", signal: controller.signal,
          });
          const rules = await available.json();
          if (!controller.signal.aborted && available.ok && rules?.success &&
            Array.isArray(rules.data)) {
            setLiveRules((rules.data as Rule[]).filter((item) => item.id !== id));
          }
        } catch { if (!controller.signal.aborted) setLiveRules([]); }
        finally { if (!controller.signal.aborted) setLoadingLiveRules(false); }
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
  const anyComment = draft.matchMode === "CONTAINS_ANY" && !draft.keyword.trim();
  const legacySubstring = draft.matchMode === "CONTAINS_ANY" && Boolean(draft.keyword.trim());
  const basicValid = (anyComment || (keywords.length > 0 && keywords.length <= 10)) && draft.initialText.trim().length > 0 &&
    draft.initialText.trim().length <= 1000 && (!draft.requireFollow ||
    (Boolean(draft.followGateText.trim()) && Boolean(draft.followGateButtonText.trim()) && draft.followGateButtonText.trim().length <= 20)) &&
    (!draft.followupEnabled || Boolean(draft.followupKeyword.trim()));
  const canSave = Boolean(account && basicValid && !loadingResources && !saving &&
    (!id || dirty) && (id ? editingView === "edit" : creationMode === "new"));
  const patch = (value: Partial<Draft>) => { setDraft(current => ({ ...current, ...value })); setSaved(false); };
  const MAX_KEYWORDS = 10;
  const addKeyword = () => {
    const additions = keywordDraft.split(/[,،;؛\n]+/).map(item => item.trim()).filter(Boolean);
    if (!additions.length) return;
    const next = [...keywords];
    for (const item of additions) {
      if (next.length >= MAX_KEYWORDS) break;
      if (!next.some(value => value.toLocaleLowerCase("fa-IR") === item.toLocaleLowerCase("fa-IR"))) next.push(item);
    }
    patch({ keyword: next.join(",") });
    setKeywordDraft("");
  };

  async function save() {
    if (!canSave || !account || (id && editingView !== "edit") ||
      (!id && creationMode !== "new")) return;
    setSaving(true);
    setError("");
    let preparedMessage: MessageDraft | null = draft.message;
    if (draft.followupEnabled) {
      preparedMessage = await responseEditorRef.current?.prepareExternalSave() ?? null;
      if (!preparedMessage) {
        setSaving(false);
        return;
      }
    }
    if (introSaveRef.current && !await introSaveRef.current({ ...createEmptyMessage(), text: draft.initialText.trim() })) {
      setSaving(false);
      return;
    }
    const payload = {
      instagramAccountId: account.id,
      title: ("پاسخ لایو - " + (anyComment ? "هر کامنت" : keywords.join("، "))).slice(0,80),
      keyword: draft.keyword, matchMode: draft.matchMode, initialText: draft.initialText,
      followupEnabled: draft.followupEnabled, followupKeyword: draft.followupKeyword,
      requireFollow: draft.requireFollow, followGateText: draft.followGateText,
      followGateButtonText: draft.followGateButtonText,
      message: draft.followupEnabled ? preparedMessage : null, expectedUpdatedAt: initialVersion.current,
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
      <button type="button" onClick={() => setRetry(v => v + 1)} className="min-h-11 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  );

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
      {id ? (
        <section className="space-y-3" aria-label="استفاده از پاسخ‌های قبلی">
          <button type="button" aria-expanded={editingView === "replace"}
            disabled={saving || loadingLiveRules || liveRules.length === 0}
            onClick={() => { setSelectedLiveRuleId(""); setEditingView(value => value === "replace" ? "edit" : "replace"); }}
            className={"daira-response-library__mode flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold " + (editingView === "replace" ? "is-selected" : "")}>
            <BookOpen size={17}/> استفاده از پاسخ‌های قبلی
          </button>
          {editingView === "replace" && <div className="space-y-3">
            <CompleteAutomationPicker kind="LIVE" items={liveRules}
              selected={liveRules.find(rule => rule.id === selectedLiveRuleId) || null}
              onSelect={rule => setSelectedLiveRuleId(rule.id)}
              onChange={() => setSelectedLiveRuleId("")} showcases={showcases} forms={forms}/>
            {selectedLiveRuleId && <button type="button"
              onClick={() => router.push("/dashboard/live-automation/" + encodeURIComponent(selectedLiveRuleId))}
              className="daira-complete-reply__select min-h-12 w-full rounded-xl px-4 text-sm font-bold">مشاهده پاسخ انتخاب‌شده</button>}
          </div>}
        </section>
      ) : (
        <section className="space-y-3">
          <ResponseModeSwitcher value={creationMode} existingAvailable={liveRules.length > 0}
            loading={loadingLiveRules} disabled={saving}
            onChange={(next) => {setCreationMode(next);setSelectedLiveRuleId("");}}/>
          {creationMode === "existing" && <div className="space-y-3">
            <CompleteAutomationPicker kind="LIVE" items={liveRules}
              selected={liveRules.find(rule => rule.id === selectedLiveRuleId) || null}
              onSelect={rule => setSelectedLiveRuleId(rule.id)}
              onChange={() => setSelectedLiveRuleId("")} showcases={showcases} forms={forms}/>
            {selectedLiveRuleId && <button type="button"
              onClick={() => router.push("/dashboard/live-automation/" + encodeURIComponent(selectedLiveRuleId))}
              className="daira-complete-reply__select min-h-12 w-full rounded-xl px-4 text-sm font-bold">مشاهده پاسخ انتخاب‌شده</button>}
          </div>}
        </section>
      )}
      {(id ? editingView === "edit" : creationMode === "new") && (<>
      <section>
        <Guide number={1} title="شرط پاسخ‌دهی به کامنت لایو" hint={anyComment ? "برای هر کامنت متنی در لایو، بدون نیاز به کلمه کلیدی، پاسخ دایرکت ارسال می‌شود." : "وقتی بیننده یکی از عبارت‌های تعیین‌شده را در لایو بنویسد، پاسخ در دایرکت ارسال می‌شود."} />
        <div className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="روش فعال شدن پاسخ لایو">
            <button type="button" aria-pressed={draft.matchMode === "EXACT"}
              onClick={() => { patch({ matchMode: "EXACT" }); setKeywordDraft(""); }}
              className={"min-h-11 rounded-xl border px-3 text-xs font-bold transition " + (draft.matchMode === "EXACT" ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-input-border)] bg-white text-[var(--daira-text-secondary)]")}>
              کلمات کلیدی مشخص
            </button>
            <button type="button" aria-pressed={anyComment}
              onClick={() => { patch({ matchMode: "CONTAINS_ANY", keyword: "" }); setKeywordDraft(""); }}
              className={"min-h-11 rounded-xl border px-3 text-xs font-bold transition " + (anyComment ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary-hover)]" : "border-[var(--daira-input-border)] bg-white text-[var(--daira-text-secondary)]")}>
              هر کامنتی
            </button>
            {legacySubstring && (
              <div className="sm:col-span-2 rounded-xl border border-[var(--daira-input-border)] bg-[var(--daira-surface-hover)] p-3 text-xs leading-6 text-[var(--daira-text-secondary)]">
                تنظیم قدیمی «شامل یکی از عبارت‌ها» فعال است. برای حفظ آن، عبارت‌های زیر قابل ویرایش‌اند؛ یا می‌توانی «هر کامنتی» را انتخاب کنی.
              </div>
            )}
          </div>
          {!anyComment && keywords.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {keywords.map(item => (
                <span key={item} className="daira-keyword-chip inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                  {item}
                  <button type="button" onClick={() => patch({ keyword: keywords.filter(value => value !== item).join(",") })}
                    className="sd-neutral-button text-[var(--daira-text)] hover:text-[var(--daira-error-text)]" aria-label={"حذف " + item}>×</button>
                </span>
              ))}
            </div>
          )}
          {!anyComment && <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="live-keyword" className="block text-xs text-[var(--daira-text)]">حداکثر {MAX_KEYWORDS} کلمه کلیدی</label>
              <span className="text-[11px] text-[var(--daira-text)]">{keywords.length} از {MAX_KEYWORDS}</span>
            </div>
            <div className="daira-keyword-field flex items-center gap-2">
              <input id="live-keyword" value={keywordDraft} onChange={e => setKeywordDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="یک کلمه کلیدی وارد کنید" disabled={keywords.length >= MAX_KEYWORDS}
                className="daira-keyword-input min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)] focus:ring-2 focus:ring-[color:var(--daira-primary)]/10 disabled:bg-[var(--daira-surface-active)]" style={{ fontSize: "16px" }} />
              <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim() || keywords.length >= MAX_KEYWORDS}
                className="min-h-11 shrink-0 rounded-lg bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:bg-[var(--daira-disabled-bg)] disabled:text-[var(--daira-disabled-text)]">افزودن</button>
            </div>
          </div>}
        </div>
      </section>

      <section>
        <Guide number={2} title="متن پاسخ در دایرکت کاربر" hint={anyComment ? "با ارسال هر کامنت متنی در لایو، این پاسخ در دایرکت کاربر ارسال می‌شود." : "پس از ارسال کلمه کلیدی مشخص در لایو، این پاسخ در دایرکت کاربر ارسال می‌شود."} />
        <div className="space-y-2 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
          <label htmlFor="live-intro" className="block text-xs font-semibold text-[var(--daira-input-label)]">متن پاسخ در دایرکت کاربر</label>
          <textarea id="live-intro" rows={4} maxLength={1000} value={draft.initialText} onChange={e => patch({ initialText: e.target.value })}
            placeholder=""
            className="w-full resize-y rounded-xl border border-[var(--daira-input-border)] px-3.5 py-3 text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)]" />
          <p className="text-left text-[11px] text-[var(--daira-text-disabled)]">{new Intl.NumberFormat("fa-IR").format(draft.initialText.length)} / ۱۰۰۰</p>
        </div>
      </section>

      <section>
        <Guide number={3} title="ادامهٔ پاسخ در دایرکت" hint="اختیاری؛ ابتدا بیننده باید خودش به دایرکت پاسخ دهد تا ارسال فرم یا فایل مجاز شود." />
        <div className="space-y-4 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm font-bold text-[var(--daira-heading)]">پاسخ چندمرحله‌ای</span>
            <input type="checkbox" role="switch" className="daira-form-switch shrink-0 -scale-x-100"
              checked={draft.followupEnabled} onChange={e => patch({ followupEnabled: e.target.checked })}/>
          </label>
          {draft.followupEnabled && (
            <div className="space-y-4 border-t border-[var(--daira-neutral-bg)] pt-4">
              <div className="space-y-2">
                <label htmlFor="live-followup-keyword" className="block text-xs font-semibold text-[var(--daira-input-label)]">کلمهٔ ادامهٔ گفتگو</label>
                <input id="live-followup-keyword" maxLength={60} value={draft.followupKeyword} onChange={e => patch({ followupKeyword: e.target.value })}
                  placeholder="مثلاً ارسال کن" className="min-h-12 w-full rounded-xl border border-[var(--daira-input-border)] px-3.5 text-base outline-none focus:border-[var(--daira-primary)]" />
              </div>
              <div className="border-t border-[var(--daira-neutral-bg)] pt-4">
                <PublishingStoryAutomationSetup
                  ref={responseEditorRef}
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
                  hideLibrary
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
        <div className="space-y-3 rounded-2xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <strong className="text-sm text-[var(--daira-heading)]">اجبار به فالو</strong>
            <input type="checkbox" role="switch" className="daira-form-switch shrink-0 -scale-x-100"
              checked={draft.requireFollow} onChange={e => patch({ requireFollow: e.target.checked })}/>
          </label>
          {draft.requireFollow && (
            <div className="space-y-2 border-t border-[var(--daira-neutral-bg)] pt-4">
              <label htmlFor="live-follow-gate" className="block text-xs font-semibold text-[var(--daira-input-label)]">متن درخواست فالو</label>
              <textarea id="live-follow-gate" rows={3} maxLength={640}
                value={draft.followGateText} onChange={e => patch({ followGateText: e.target.value })}
                placeholder="برای دریافت اطلاعات، ابتدا پیج را فالو کن."
                className="w-full resize-y rounded-xl border border-[var(--daira-input-border)] px-3.5 py-3 text-base leading-7 outline-none focus:border-[var(--daira-primary)]" />
              <label htmlFor="live-follow-button" className="block text-xs font-semibold text-[var(--daira-input-label)]">متن دکمه بررسی فالو</label>
              <input id="live-follow-button" value={draft.followGateButtonText} maxLength={20}
                onChange={e => patch({ followGateButtonText: e.target.value })}
                placeholder="بررسی فالو" className="min-h-12 w-full rounded-xl border border-[var(--daira-input-border)] px-3.5 text-base outline-none focus:border-[var(--daira-primary)]" />
            </div>
          )}
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] p-3 text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 text-sm text-[var(--daira-success-text)]"><CheckCircle2 size={16}/> تغییرات ذخیره شد.</p>}
      <button type="button" disabled={!canSave} onClick={() => void save()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
        {saving && <Loader2 size={17} className="animate-spin"/>}
        {saving ? "در حال ذخیره..." : id ? "ذخیره تغییرات" : "ساخت پاسخ خودکار"}
      </button>
      </>)}
    </div>
  );
}
