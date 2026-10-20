"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, X, ArrowRight } from "lucide-react";
import { dairaPalette } from "@/lib/design-system/palette";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type QuickReplyDraft, type Showcase, type FormItem } from "./automation-form-utils";
import PublishingStoryAutomationSetup, { type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";
import { defaultLiveRule, normalizeLiveText, parseLiveRule, type LiveRule, type LiveReplyOption } from "@/lib/live-replies/config";

type Account = { id: string; igUsername: string; isConnected: boolean };
type SavedRecord = { id: string; title: string; text: string; messageType: string; quickReplies: unknown };
type EditorData = { id: string; instagramAccountId: string; updatedAt: string; config: LiveRule };
const endpoint = "/api/live-automations";
const inputClass = "w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-3 text-base text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10";
const panelClass = "space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5";
const errorClass = "rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs leading-6 text-[#B91C1C]";
function SectionGuide({ number, title, text }: { number: string; title: string; text?: string }) {
  return (
    <div className="mb-2 flex items-start gap-3 rounded-xl border px-3.5 py-3"
      style={{ background: dairaPalette.guide.background, borderColor: dairaPalette.guide.border }}>
      <Lightbulb size={17} className="mt-1 shrink-0" style={{ color: dairaPalette.guide.icon }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: dairaPalette.guide.icon }}>{number}</span>
          <h2 className="text-sm font-bold text-[#0F172A]">{title}</h2>
        </div>
        {text && <p className="mt-1 text-xs leading-6 text-[#64748B]">{text}</p>}
      </div>
    </div>
  );
}
function toEditorOptions(items: LiveReplyOption[]): QuickReplyDraft[] {
  return items.map((item) => ({
    ...item, nextMessageId: null, destinationQuickReplies: toEditorOptions(item.destinationQuickReplies),
  }));
}
function toEditorMessage(rule: LiveRule): MessageDraft {
  return {
    ...createEmptyMessage(), ...rule.response,
    quickReplies: toEditorOptions(rule.response.quickReplies),
  };
}
export default function LiveAutomationEditor({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [account, setAccount] = useState<Account | null>(null);
  const [draft, setDraft] = useState<LiveRule>(defaultLiveRule);
  const [original, setOriginal] = useState("");
  const [version, setVersion] = useState("");
  const [ready, setReady] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [formTemplates, setFormTemplates] = useState<StoryFormTemplate[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showcaseDraftChanged, setShowcaseDraftChanged] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    const run = async () => {
      try {
        const accountsResponse = await fetch("/api/instagram/accounts", { cache: "no-store", credentials: "include" });
        const accountsData = await accountsResponse.json();
        if (!accountsResponse.ok || !accountsData?.success) throw new Error(accountsData?.error || "دریافت پیج ناموفق بود.");
        const accounts = (Array.isArray(accountsData.accounts) ? accountsData.accounts : []) as Account[];
        let initial = defaultLiveRule();
        let edited: EditorData | null = null;
        if (id) {
          const response = await fetch(endpoint + "/" + encodeURIComponent(id), { cache: "no-store", credentials: "include" });
          const data = await response.json();
          if (!response.ok || !data?.success) throw new Error(data?.error || "پاسخ خودکار لایو پیدا نشد.");
          edited = data.data as EditorData;
          initial = parseLiveRule(edited.config);
        }
        const selected = id ? accounts.find((item) => item.id === edited?.instagramAccountId && item.isConnected)
          : accounts.find((item) => item.isConnected);
        if (!selected) throw new Error("پیج متصل برای پاسخ خودکار لایو پیدا نشد.");
        const query = "?instagramAccountId=" + encodeURIComponent(selected.id);
        const [showcaseResponse, formsResponse, automationResponse, savedResponse] = await Promise.all([
          fetch("/api/showcases" + query, { cache: "no-store", credentials: "include" }),
          fetch("/api/forms" + query, { cache: "no-store", credentials: "include" }),
          fetch("/api/automations" + query, { cache: "no-store", credentials: "include" }),
          fetch("/api/saved-responses" + query, { cache: "no-store", credentials: "include" }),
        ]);
        const [showcaseData, formData, automationData, savedData] = await Promise.all([
          showcaseResponse.json(), formsResponse.json(), automationResponse.json(), savedResponse.json(),
        ]);
        if (!showcaseResponse.ok || !formsResponse.ok || !automationResponse.ok || !savedResponse.ok)
          throw new Error("دریافت فرم‌ها یا ویترین‌های پیج ناموفق بود.");
        const saved = (Array.isArray(savedData?.data) ? savedData.data : []) as SavedRecord[];
        const templates: StoryFormTemplate[] = [];
        for (const item of saved) {
          if (item.messageType !== "FORM" || !item.text) continue;
          const normalized = normalizeMessages([{ ...item, messageType: "FORM" }]);
          if (normalized[0]?.quickReplies.length) {
            templates.push({ id: item.id, title: item.title || "فرم ذخیره‌شده", text: normalized[0].text,
              quickReplies: normalized[0].quickReplies });
          }
        }
        const automations = Array.isArray(automationData?.data) ? automationData.data : [];
        for (const item of automations) {
          for (const message of normalizeMessages(item.messages)) {
            if (message.messageType === "FORM" && message.text.trim() && message.quickReplies.length) {
              templates.push({ id: item.id + ":" + message.id,
                title: "فرم — " + message.text.slice(0, 40),
                text: message.text, quickReplies: message.quickReplies });
            }
          }
        }
        if (!active) return;
        setAccount(selected);
        setDraft(initial);
        setOriginal(JSON.stringify(initial));
        setVersion(edited?.updatedAt || "");
        setShowcases(Array.isArray(showcaseData) ? showcaseData : showcaseData?.data || []);
        setForms(Array.isArray(formData) ? formData : formData?.data || []);
        setFormTemplates(templates);
        setResourcesLoading(false);
        setShowcaseDraftChanged(false);
        setReady(true);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "دریافت اطلاعات ناموفق بود.");
          setReady(true);
          setResourcesLoading(false);
        }
      }
    };
    void run();
    return () => { active = false; };
  }, [id, reload]);

  const message = useMemo(() => toEditorMessage(draft), [draft]);
  const dirty = !isEdit || JSON.stringify(draft) !== original || showcaseDraftChanged;
  const invalid = draft.keywords.length === 0 || !draft.initialText.trim() ||
    (draft.mode === "FOLLOW_UP" && !draft.nextKeyword.trim()) ||
    (draft.requireFollow && !draft.followText.trim());
  const setField = <K extends keyof LiveRule>(key: K, value: LiveRule[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  function addKeyword() {
    const newItems = keywordInput.split(/[,،;؛\n]+/).map(normalizeLiveText).filter(Boolean);
    setKeywordInput("");
    setDraft((prev) => ({
      ...prev, keywords: Array.from(new Set([...prev.keywords, ...newItems])).slice(0, 10),
    }));
  }
  const updateResponse = (patch: Partial<MessageDraft>) => {
    setDraft((prev) => ({
      ...prev,
      response: { ...prev.response, ...patch, quickReplies: patch.quickReplies
        ? patch.quickReplies as LiveReplyOption[] : prev.response.quickReplies },
    }));
  };
  async function save(override?: MessageDraft) {
    if (!account || saving || invalid || !dirty) return;
    const config = {
      ...draft, response: override
        ? { ...draft.response, ...override }
        : draft.response,
    };
    try {
      const validated = parseLiveRule(config);
      setSaving(true);
      setError("");
      const response = await fetch(isEdit ? endpoint + "/" + encodeURIComponent(id || "") : endpoint, {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instagramAccountId: account.id, expectedUpdatedAt: version, config: validated }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body?.error || "ذخیره پاسخ خودکار لایو ناموفق بود.");
      router.push("/dashboard/live-automation");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره پاسخ خودکار لایو ناموفق بود.");
    } finally { setSaving(false); }
  }

  if (!ready) return <LiveAutomationSkeleton mode="editor" />;
  if (!account) return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-4 py-4">
      <div role="alert" className={errorClass}>{error || "پیج متصل پیدا نشد."}</div>
      <button type="button" onClick={() => setReload((x) => x + 1)} className="min-h-11 rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  );
  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 pb-12 pt-2 sm:pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-extrabold text-[#0F172A]">{isEdit ? "ویرایش پاسخ خودکار لایو" : "ایجاد پاسخ خودکار لایو"}</h1>
        <button type="button" onClick={() => router.push("/dashboard/live-automation")}
          aria-label="بازگشت به فهرست" className="sd-neutral-button flex h-10 w-10 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B]">
          <ArrowRight size={18} />
        </button>
      </div>
      <div>
        <SectionGuide number="۱" title="کلمات کلیدی لایو" text="وقتی بیننده یکی از این عبارت‌ها را داخل لایو بنویسد، دایرکت اولیه فرستاده می‌شود." />
        <section className={panelClass}>
          <div className="flex flex-wrap gap-2">
            {draft.keywords.map((keyword) => (
              <span key={keyword} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-3 py-2 text-xs font-bold text-[#1D4ED8]">
                {keyword}
                <button type="button" aria-label={"حذف " + keyword} onClick={() =>
                  setField("keywords", draft.keywords.filter((item) => item !== keyword))}
                  className="sd-neutral-button rounded-full p-0.5"><X size={13} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
              placeholder="مثلاً قیمت، لینک، اطلاعات" aria-label="افزودن کلمات کلیدی"
              className={inputClass} />
            <button type="button" onClick={addKeyword} disabled={!keywordInput.trim() || draft.keywords.length >= 10}
              className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-[#2563EB] px-4 text-xs font-bold text-white disabled:opacity-40">
              <Plus size={16} /> افزودن
            </button>
          </div>
          <div role="radiogroup" aria-label="روش تطبیق کلمه کلیدی" className="grid grid-cols-2 gap-2">
            {([{ id: "EXACT", title: "تطبیق دقیق" }, { id: "CONTAINS_ANY", title: "شامل عبارت" }] as const).map((option) => (
              <button type="button" key={option.id} role="radio" aria-checked={draft.matchMode === option.id}
                onClick={() => setField("matchMode", option.id)}
                className={"sd-neutral-button min-h-11 rounded-xl border px-3 text-xs font-bold " +
                  (draft.matchMode === option.id ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]" : "border-[#E2E8F0] bg-white text-[#475569]")}>
                {option.title}
              </button>
            ))}
          </div>
        </section>
      </div>
      <div>
        <SectionGuide number="۲" title="روش پاسخ‌دهی" />
        <section className={panelClass}>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="نوع پاسخ خودکار لایو">
            {([{ id: "DIRECT", title: "پاسخ مستقیم", subtitle: "یک دایرکت متنی با لینک دلخواه" },
               { id: "FOLLOW_UP", title: "ادامهٔ گفتگو", subtitle: "پس از پاسخ بیننده، فرم یا رسانه ارسال می‌شود" }] as const).map((option) => (
              <button key={option.id} role="radio" aria-checked={draft.mode === option.id} type="button"
                onClick={() => {
                  setDraft((prev) => ({ ...prev, mode: option.id,
                    nextKeyword: option.id === "DIRECT" ? "بررسی فالو" : "ارسال کن" }));
                }}
                className={"sd-neutral-button min-h-[78px] space-y-1 rounded-xl border px-4 py-3 text-right " +
                  (draft.mode === option.id ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white")}>
                <strong className="block text-sm text-[#0F172A]">{option.title}</strong>
                <span className="block text-xs leading-5 text-[#64748B]">{option.subtitle}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label htmlFor="live-initial-text" className="block text-sm font-bold text-[#0F172A]">
              {draft.mode === "DIRECT" ? "متن پاسخ دایرکت" : "متن اولین دایرکت"}
            </label>
            <textarea id="live-initial-text" value={draft.initialText} rows={4} maxLength={1000}
              onChange={(e) => setField("initialText", e.target.value)}
              placeholder={draft.mode === "DIRECT"
                ? "مثلاً سلام! قیمت محصول ۵۰۰ هزار تومان است. مشاهده: https://..."
                : "سلام! برای دریافت جزئیات، همین‌جا بنویس «ارسال کن»."}
              className={inputClass + " resize-y leading-7"} />
            <p className="text-xs leading-6 text-[#64748B]">
              {draft.mode === "DIRECT"
                ? "پیام اول فقط متن است؛ لینک را می‌توان داخل همین متن گذاشت."
                : "این پیام در لایو به‌صورت یک دایرکت متنی ارسال می‌شود. ادامه بعد از پاسخ بیننده اجرا خواهد شد."}
            </p>
          </div>
          {draft.mode === "FOLLOW_UP" && (
            <div className="space-y-2">
              <label htmlFor="live-next-keyword" className="block text-sm font-bold text-[#0F172A]">عبارت شروع ادامهٔ گفتگو</label>
              <input id="live-next-keyword" value={draft.nextKeyword}
                onChange={(e) => setField("nextKeyword", e.target.value)}
                placeholder="مثلاً ارسال کن" maxLength={100} className={inputClass} />
            </div>
          )}
        </section>
      </div>
      <div>
        <SectionGuide number="۳" title="اجبار به فالو" text="اختیاری است؛ فالو پس از پاسخ بیننده در دایرکت بررسی می‌شود." />
        <section className={panelClass}>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <strong className="text-sm text-[#0F172A]">اجبار به فالو</strong>
            <input type="checkbox" role="switch" checked={draft.requireFollow}
              onChange={(e) => setField("requireFollow", e.target.checked)}
              className="daira-form-switch -scale-x-100" />
          </label>
          {draft.requireFollow && (
            <div className="space-y-2">
              <label htmlFor="live-follow-text" className="block text-xs font-semibold text-[#334155]">متن درخواست فالو</label>
              <textarea id="live-follow-text" value={draft.followText} maxLength={640} rows={2}
                onChange={(e) => setField("followText", e.target.value)}
                placeholder="برای دریافت پاسخ، ابتدا پیج ما را فالو کن."
                className={inputClass + " resize-y leading-7"} />
              <p className="text-xs leading-6 text-[#64748B]">
                در پیام اولیه از کاربر درخواست فالو می‌شود. او سپس باید
                «{draft.mode === "DIRECT" ? draft.nextKeyword : draft.nextKeyword}» را در دایرکت بنویسد؛
                پس از تأیید فالو پاسخ اصلی ارسال می‌شود.
              </p>
            </div>
          )}
        </section>
      </div>
      {draft.mode === "FOLLOW_UP" ? (
        <div>
          <SectionGuide number="۴" title="پاسخ پس از پیام بیننده" text="همان انواع پاسخ موجود در استوری: متن، عکس، ویدیو، وویس، ویترین و فرم." />
          <section className={panelClass}>
            <PublishingStoryAutomationSetup
              message={message}
              showcases={showcases}
              forms={forms}
              formTemplates={formTemplates}
              loadingResources={resourcesLoading}
              instagramAccountId={account.id}
              onUpdate={updateResponse}
              keywordValid={draft.keywords.length > 0}
              onContinue={(nextMessage) => save(nextMessage)}
              storyCreateMode
              storyEditMode={isEdit}
              onDraftChange={setShowcaseDraftChanged}
              responseTypeTitle="نوع پاسخ بعدی"
              responseTypeDescription=""
              textPlaceholder="متنی که پس از دریافت عبارت برای بیننده ارسال می‌شود..."
              extraSettings={error ? <div role="alert" className={errorClass}>{error}</div> : undefined}
              showFinalSave
              finalSaveLabel={isEdit ? "ذخیره تغییرات" : "ساخت پاسخ خودکار"}
              finalSaveLoadingLabel="در حال ذخیره..."
              finalSaveDisabled={!dirty || saving || invalid}
            />
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <div role="alert" className={errorClass}>{error}</div>}
          <button type="button" onClick={() => void save()}
            disabled={!dirty || invalid || saving}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "ساخت پاسخ خودکار"}
          </button>
        </div>
      )}
    </div>
  );
}
