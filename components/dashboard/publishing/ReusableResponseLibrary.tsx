"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Eye, Pencil, X } from "lucide-react";
import ResponseModeSwitcher from "../ResponseModeSwitcher";
import ResponseTemplateDetails from "../ResponseTemplateDetails";
import GlassModalPresence from "../GlassModalPresence";
import { responseFingerprint } from "../automation-response-compare";
import type { MessageDraft, QuickReplyDraft } from "../automation-form-utils";

type Saved = {
  id: string; title: string; updatedAt: string; messageType: MessageDraft["messageType"];
  text: string | null; mediaUrl: string | null; mediaId: string | null;
  showcaseId: string | null; formId: string | null; quickReplies: QuickReplyDraft[] | null;
  usages?: Array<{ messageId: string; automationId: string; automationTitle: string | null;
    triggerType: string; mediaIds: string[]; menuTitles: string[]; icebreakerQuestions: string[];
    messageUpdatedAt: string; automationUpdatedAt: string;
    quickReplyId?: string; nodePath?: Array<string | number>; branchTitle?: string }>;
  showcase?: { title: string; items: Array<{ id: string; title: string; description?: string | null; imageUrl?: string | null }> } | null;
  form?: { title: string; fields: Array<{ id: string; label: string }> } | null;
};
type Props = {
  instagramAccountId: string;
  message: MessageDraft;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  allowedTypes: MessageDraft["messageType"][];
  prefix?: string;
  initialName?: string;
  onNameChange?: (name: string) => void;
  onRegisterSave?: (save: ((draft: MessageDraft) => Promise<boolean>) | null) => void;
  disabled?: boolean;
};
const typeNames: Record<MessageDraft["messageType"], string> = {
  TEXT: "متن", IMAGE: "عکس", VIDEO: "ویدیو", AUDIO: "وویس", FORM: "فرم", SHOWCASE: "ویترین",
};
function usageEditUrl(usage: NonNullable<Saved["usages"]>[number]): string {
  if (usage.menuTitles.length) return "/dashboard/persistent-menu";
  if (usage.icebreakerQuestions.length) return "/dashboard/ice-breaker";
  if (usage.mediaIds.includes("__smartdirect_live_comments_v1__"))
    return "/dashboard/live-automation/" + encodeURIComponent(usage.automationId);
  if (usage.triggerType === "STORY_REPLY_KEYWORD")
    return "/dashboard/story-automation/" + encodeURIComponent(usage.automationId);
  if (usage.triggerType === "COMMENT_KEYWORD")
    return "/dashboard/comment-automation/" + encodeURIComponent(usage.automationId);
  return "/dashboard/direct-automation/" + encodeURIComponent(usage.automationId);
}
function displayName(saved: Saved, prefix: string) {
  const title = saved.title.trim()
    .replace(/^(?:فرم|ویترین|پاسخ خودکار کامنت|پاسخ خودکار استوری|پاسخ خودکار دایرکت)\s*[-—–]?\s*/u, "");
  return (saved.messageType === "FORM" ? "فرم" : saved.messageType === "SHOWCASE" ? "ویترین" : prefix) + " " + title;
}
function cloneTree(replies: QuickReplyDraft[]): QuickReplyDraft[] {
  return replies.map((item) => ({
    ...item,
    id: "quick_reply_" + crypto.randomUUID(),
    payload: "payload_" + crypto.randomUUID(),
    nextMessageId: null,
    destinationQuickReplies: cloneTree(item.destinationQuickReplies || []),
  }));
}
function ResponsePreview({ value }: { value: Saved }) {
  return <div className="space-y-3">
    <ResponseTemplateDetails
      messages={[{
        messageType: value.messageType, text: value.text || "", mediaUrl: value.mediaUrl || "",
        showcaseId: value.showcaseId || "", formId: value.formId || "",
        quickReplies: Array.isArray(value.quickReplies) ? value.quickReplies : [],
      }]}
      showcases={value.showcase && value.showcaseId ? [{ id: value.showcaseId, ...value.showcase }] : []}
      forms={value.form && value.formId ? [{ id: value.formId, ...value.form }] : []}
    />
    <div className="space-y-2 border-t border-[var(--daira-border)] pt-3">
      <p className="text-xs font-bold text-[var(--daira-heading)]">محل‌های استفاده از این پاسخ</p>
      {!value.usages?.length ? <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">هنوز اتصال فعالی برای این پاسخ ثبت نشده است.</p>
        : value.usages.map((usage) => <div key={usage.messageId} className="daira-response-library__preview-branch space-y-1 rounded-xl p-3">
          <p className="text-xs font-bold text-[var(--daira-heading)]">{usage.automationTitle || (
            usage.menuTitles.length ? "منوی دایرکت" : usage.icebreakerQuestions.length ? "پیام شروع گفتگو" :
            usage.triggerType === "STORY_REPLY_KEYWORD" ? "پاسخ استوری" :
            usage.triggerType === "COMMENT_KEYWORD" ? "پاسخ کامنت" : "پاسخ دایرکت")}</p>
          {usage.quickReplyId && <p className="text-xs text-[var(--daira-text-secondary)]">گزینه داخلی فرم: {usage.branchTitle || "پاسخ"}</p>}
          {usage.menuTitles.map((title, index) => <p key={index} className="text-xs text-[var(--daira-text-secondary)]">گزینه منو: {title}</p>)}
          {usage.icebreakerQuestions.map((question, index) => <p key={index} className="text-xs text-[var(--daira-text-secondary)]">شروع گفتگو: {question}</p>)}
          {usage.mediaIds.length > 0 && <p className="text-xs text-[var(--daira-text-secondary)]">متصل به {new Intl.NumberFormat("fa-IR").format(usage.mediaIds.length)} محتوا</p>}
          <a href={usageEditUrl(usage)} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-bold text-[var(--daira-primary)] hover:underline">
            ویرایش این محل استفاده
          </a>
        </div>)
      }
    </div>
  </div>;
}

export default function ReusableResponseLibrary({ instagramAccountId, message, onUpdate, allowedTypes, prefix = "پاسخ", initialName = "", onNameChange, onRegisterSave, disabled = false }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const nameFieldId = useId();
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName);
  useEffect(() => { setName(initialName); }, [initialName]);
  const [editingId, setEditingId] = useState("");
  const [reusedOriginal, setReusedOriginal] = useState<{id:string; fingerprint:string} | null>(null);
  const [preview, setPreview] = useState<Saved | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeSelected, setScopeSelected] = useState<Record<string, string[] | null>>({});
  const [scopeMedia, setScopeMedia] = useState<Record<string, {
    caption?: string; media_type?: string; media_product_type?: string;
    thumbnail_url?: string | null; media_url?: string | null;
  }>>({});
  const [error, setError] = useState("");
  const filtered = useMemo(() => items.filter((item) => allowedTypes.includes(item.messageType)), [items, allowedTypes.join(",")]);

  useEffect(() => {
    // Nested branching forms may render dozens of pickers; only fetch when browsing.
    if (!instagramAccountId || mode !== "existing") return;
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/saved-responses?instagramAccountId=" + encodeURIComponent(instagramAccountId), { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok || !result?.success) throw Error(result?.error || "دریافت پاسخ‌ها ناموفق بود."); return result.data as Saved[]; })
      .then((data) => { if (!controller.signal.aborted) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "دریافت پاسخ‌ها ناموفق بود."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [instagramAccountId, mode]);

  useEffect(() => {
    const sourceId = message.savedResponseId;
    if (!instagramAccountId || !sourceId) return;
    const controller = new AbortController();
    fetch("/api/saved-responses/" + encodeURIComponent(sourceId), {
      cache: "no-store", credentials: "include", signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success || !result.data) throw Error("پاسخ ذخیره‌شده در دسترس نیست.");
      return result.data as Saved;
    }).then((saved) => {
      if (controller.signal.aborted) return;
      setItems((current) => current.some((item) => item.id === saved.id) ? current : [saved, ...current]);
      setName((previous) => previous.trim() ? previous : saved.title);
      setReusedOriginal({ id: saved.id, fingerprint: responseFingerprint(message) });
    }).catch(() => {
      // The message remains usable even if an old template was removed.
    });
    return () => controller.abort();
  }, [instagramAccountId, message.savedResponseId]);

  useEffect(() => {
    if (!scopeOpen || !instagramAccountId) return;
    const controller = new AbortController();
    const query = "?instagramAccountId=" + encodeURIComponent(instagramAccountId);
    void Promise.allSettled(["/api/instagram/media", "/api/instagram/stories"].map(async (path) => {
      const response = await fetch(path + query, { cache: "no-store", credentials: "include", signal: controller.signal });
      const payload = await response.json();
      return response.ok && payload?.success && Array.isArray(payload.data) ? payload.data as Array<{
        id: string; caption?: string; media_type?: string; media_product_type?: string;
        thumbnail_url?: string | null; media_url?: string | null;
      }> : [];
    })).then((results) => {
      if (controller.signal.aborted) return;
      const previews: typeof scopeMedia = {};
      for (const result of results) if (result.status === "fulfilled")
        for (const item of result.value) if (item.id) previews[item.id] = item;
      setScopeMedia(previews);
    });
    return () => controller.abort();
  }, [scopeOpen, instagramAccountId]);

  function loadResponse(item: Saved, edit = false) {
    const applied: Partial<MessageDraft> = {
      savedResponseId: item.id,
      messageType: item.messageType, text: item.text || "",
      mediaUrl: item.mediaUrl || "", mediaId: item.mediaId || "",
      showcaseId: item.showcaseId || "", formId: item.formId || "",
      quickReplies: cloneTree(Array.isArray(item.quickReplies) ? item.quickReplies : []),
    };
    onUpdate(applied);
    setReusedOriginal(edit ? null : { id: item.id, fingerprint: responseFingerprint({ ...message, ...applied } as MessageDraft) });
    setPreview(null);
    setMode("new");
    setEditingId(edit ? item.id : "");
    setName(item.title);
    onNameChange?.(item.title);
    setError("");
  }
  // Editing the body of a reused response creates an independent draft;
  // the original saved template and other active uses remain untouched.
  useEffect(() => {
    if (reusedOriginal && message.savedResponseId === reusedOriginal.id
        && responseFingerprint(message) !== reusedOriginal.fingerprint) {
      setReusedOriginal(null);
      onUpdate({ savedResponseId: null });
    }
  }, [message, reusedOriginal, onUpdate]);

  type Selection = { messageId: string; mediaIds: string[];
    quickReplyId?: string; nodePath?: Array<string | number>;
    expectedMessageUpdatedAt: string; expectedAutomationUpdatedAt: string };
  function selectedScopes(): Selection[] {
    const source = items.find((item) => item.id === editingId);
    return (source?.usages || []).flatMap((usage) => {
      const choice = scopeSelected[usage.messageId];
      if (choice === undefined || (Array.isArray(choice) && !choice.length)) return [];
      return [{ messageId: usage.messageId, mediaIds: choice || [],
        ...(usage.quickReplyId ? { quickReplyId: usage.quickReplyId, nodePath: usage.nodePath || [] } : {}),
        expectedMessageUpdatedAt: usage.messageUpdatedAt,
        expectedAutomationUpdatedAt: usage.automationUpdatedAt }];
    });
  }
  function chooseScopes(item: Saved) {
    const selected: Record<string, string[] | null> = {};
    for (const usage of item.usages || [])
      selected[usage.messageId] = usage.mediaIds.length ? [...usage.mediaIds] : null;
    setScopeSelected(selected);
    setScopeOpen(true);
  }

  async function saveToLibrary(override?: MessageDraft, approved?: Selection[]): Promise<boolean> {
    // Primary form saves mark the parent disabled while assembling the payload.
    if (saving || (disabled && !override)) return false;
    const draft = override || message;
    const title = name.trim();
    if (!editingId && reusedOriginal && responseFingerprint(draft) === reusedOriginal.fingerprint && title === items.find((item) => item.id === reusedOriginal.id)?.title) return true;
    if (!title || title.length > 80) { setError("نام پاسخ را وارد کن (حداکثر ۸۰ نویسه)."); return false; }
    if (!allowedTypes.includes(draft.messageType)) { setError("این نوع پاسخ در این بخش پشتیبانی نمی‌شود."); return false; }
    const original = items.find((item) => item.id === editingId);
    if (!override && !approved && original?.usages?.length) {
      chooseScopes(original);
      return false;
    }
    if (editingId && !original) { setError("پاسخ قبلی پیدا نشد. فهرست را تازه‌سازی کن."); return false; }
    // The parent editor must never silently edit a shared template.
    // Explicit edits go through the scope dialog; parent autosave forks a copy.
    const manualEdit = Boolean(editingId && !override);
    if (override && original && responseFingerprint(draft) === responseFingerprint({
      ...draft, messageType: original.messageType,
      text: original.text || "", mediaUrl: original.mediaUrl || "", mediaId: original.mediaId || "",
      showcaseId: original.showcaseId || "", formId: original.formId || "",
      quickReplies: Array.isArray(original.quickReplies) ? original.quickReplies : [],
    }) && title === original.title) {
      override.savedResponseId = original.id;
      return true;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(approved
        ? "/api/saved-responses/" + encodeURIComponent(editingId) + "/apply"
        : manualEdit ? "/api/saved-responses/" + encodeURIComponent(editingId)
        : "/api/saved-responses", {
        method: approved || manualEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId, title, messageType: draft.messageType,
          text: draft.text || null, mediaUrl: draft.mediaUrl || null,
          mediaId: draft.mediaId || null, showcaseId: draft.showcaseId || null,
          formId: draft.formId || null, quickReplies: draft.quickReplies || [],
          ...(manualEdit || approved ? { expectedUpdatedAt: original?.updatedAt } : {}),
          ...(approved ? {
            selections: approved,
            expectedUsages: (original?.usages || []).map((usage) => ({
              messageId: usage.messageId,
              ...(usage.quickReplyId ? { quickReplyId: usage.quickReplyId, nodePath: usage.nodePath } : {}),
              messageUpdatedAt: usage.messageUpdatedAt,
              automationUpdatedAt: usage.automationUpdatedAt,
            })),
          } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success || (approved ? !result.data : !result.data?.id))
        throw Error(result?.error || "ذخیره پاسخ ناموفق بود.");
      const saved = approved ? result.data.template as Saved : result.data as Saved;
      setScopeOpen(false);
      // The parent save receives this same prepared draft. Set its source before persisting.
      if (override) override.savedResponseId = saved.id;
      onUpdate({ savedResponseId: saved.id });
      setItems((current) => [{ ...saved, usages: original?.usages || [] }, ...current.filter((item) => item.id !== saved.id)]);
      if (approved) {
        // Refresh real relations (including forked comment media) after a committed edit.
        void fetch("/api/saved-responses?instagramAccountId=" + encodeURIComponent(instagramAccountId), {
          cache: "no-store", credentials: "include",
        }).then((r) => r.json()).then((data) => {
          if (data?.success && Array.isArray(data.data)) setItems(data.data);
        }).catch(() => undefined);
      }
      setEditingId(saved.id);
      setReusedOriginal(null);
      setName(saved.title);
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره پاسخ ناموفق بود.");
      return false;
    } finally { setSaving(false); }
  }

  // The surrounding automation editor can persist a named response as part of its normal save.
  useEffect(() => {
    onRegisterSave?.(saveToLibrary);
    return () => onRegisterSave?.(null);
  });

  return <section dir="rtl" className="daira-response-library mb-5 space-y-4" aria-label="کتابخانه پاسخ‌ها">
    <ResponseModeSwitcher value={mode} onChange={(next) => { setMode(next); setError(""); }} disabled={disabled || saving} />
    {mode === "new" ? <div className="daira-response-library__panel space-y-4 rounded-2xl border p-4 sm:p-5">
      <label htmlFor={nameFieldId} className="block text-xs font-bold text-[var(--daira-heading)]">{message.messageType === "FORM" ? "نام فرم" : message.messageType === "SHOWCASE" ? "نام ویترین" : "نام پاسخ"}</label>
      <input id={nameFieldId} type="text" value={name} maxLength={80} onChange={(event) => { setName(event.target.value); onNameChange?.(event.target.value); }}
        placeholder="مثلاً کفش" disabled={disabled || saving}
        className="daira-response-library__input block min-h-12 w-full rounded-xl border px-3.5 py-3 text-base text-[var(--daira-heading)] outline-none" style={{fontSize:"16px"}}/>
      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">{message.messageType === "FORM" ? "نامی برای فرم" : message.messageType === "SHOWCASE" ? "نامی برای ویترین" : "نامی برای پاسخ"} انتخاب کن تا بعداً بتوانی دوباره از آن استفاده کنی.</p>
      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">این پاسخ با دکمه اصلی ذخیره یا ایجاد پاسخ، به‌صورت خودکار در پاسخ‌های قبلی ثبت می‌شود.</p>
      {editingId && <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">ویرایش کتابخانه فقط قالب ذخیره‌شده را تغییر می‌دهد؛ تنظیمات پاسخ‌های فعال به صورت خودکار بازنویسی نمی‌شوند.</p>}
      {editingId && <button type="button" onClick={() => {setEditingId("");setName("");}} className="ml-2 text-xs text-[var(--daira-text-secondary)]">انصراف از ویرایش پاسخ ذخیره‌شده</button>}
    </div> : <div className="daira-response-library__panel space-y-3 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--daira-heading)]">پاسخ‌های ذخیره‌شده</h3>
        <span className="daira-response-library__count rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--daira-text-secondary)]">{new Intl.NumberFormat("fa-IR").format(filtered.length)} پاسخ</span>
      </div>
      {loading ? <div role="status" className="daira-skeleton__bar h-14 w-full rounded-xl"/> : filtered.length === 0 ?
        <p className="py-4 text-center text-xs text-[var(--daira-text-secondary)]">پاسخ سازگاری ذخیره نشده است.</p> :
        <div className="max-h-72 space-y-2.5 overflow-y-auto py-1">
          {filtered.map((item) => {
            const expanded = preview?.id === item.id;
            return <div key={item.id} className="daira-response-library__item overflow-hidden rounded-xl border">
              <div className="flex min-h-[76px] items-center gap-3 p-3">
                <button type="button" onClick={() => loadResponse(item)}
                  className="min-w-0 flex-1 text-right" aria-label={"انتخاب " + item.title}>
                  <p className="truncate text-xs font-bold text-[var(--daira-heading)]">{displayName(item, prefix)}</p>
                  <p className="mt-1 text-[11px] text-[var(--daira-text-secondary)]">{typeNames[item.messageType]} · {new Intl.NumberFormat("fa-IR").format(item.usages?.length || 0)} استفاده ثبت‌شده</p>
                </button>
                <button type="button" aria-expanded={expanded} aria-controls={"response-detail-" + item.id}
                  onClick={() => setPreview((current) => current?.id === item.id ? null : item)}
                  aria-label={(expanded ? "بستن پیش‌نمایش " : "مشاهده ") + item.title}
                  className="daira-response-library__eye flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  <Eye size={18} aria-hidden="true"/>
                </button>
              </div>
              <div id={"response-detail-" + item.id} aria-hidden={!expanded} inert={!expanded}
                className={"daira-response-library__expander grid " + (expanded ? "is-expanded" : "")}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-3 border-t border-[var(--daira-glass-rim)] p-3 sm:p-4">
                    <ResponsePreview value={item} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => loadResponse(item)}
                        className="daira-response-library__action min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold">استفاده از پاسخ</button>
                      <button type="button" onClick={() => loadResponse(item, true)}
                        className="daira-response-library__action min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold">ویرایش پاسخ</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>;
          })}
        </div>}
    </div>}
    {error && <p role="alert" className="text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
    <GlassModalPresence open={scopeOpen} onEscape={() => { if (!saving) setScopeOpen(false); }}>
      <div dir="rtl" className="daira-glass-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setScopeOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="saved-scope-title" className="daira-glass-dialog daira-response-library__dialog flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[26px]">
          <div className="daira-glass-dialog__header flex items-center justify-between border-b p-4">
            <h3 id="saved-scope-title" className="text-sm font-extrabold text-[var(--daira-heading)]">اعمال ویرایش پاسخ مشترک</h3>
            <button type="button" aria-label="بستن" disabled={saving} onClick={() => setScopeOpen(false)} className="daira-glass-dialog__close rounded-lg p-2"><X size={18}/></button>
          </div>
          <p className="px-4 pt-3 text-xs leading-6 text-[var(--daira-text-secondary)]">
            مشخص کن تغییرات برای کدام محتوا یا محل استفاده اعمال شود. موارد تیک‌نخورده بدون تغییر باقی می‌مانند.
          </p>
          <div className="space-y-3 overflow-y-auto p-4">
            {(items.find((item) => item.id === editingId)?.usages || []).map((usage) => (
              <div key={usage.messageId} className="daira-response-library__scope-item space-y-2 rounded-xl border p-3">
                <p className="text-xs font-bold text-[var(--daira-heading)]">{usage.automationTitle ||
                  (usage.menuTitles.length ? "منوی دایرکت" : usage.icebreakerQuestions.length ? "پیام شروع گفتگو" :
                   usage.triggerType === "COMMENT_KEYWORD" ? "پاسخ کامنت" : "پاسخ دایرکت")}</p>
                {usage.quickReplyId && <p className="text-xs text-[var(--daira-text-secondary)]">
                  <span className="font-bold">شاخه فرم</span> — {usage.branchTitle || "پاسخ داخلی"}
                </p>}
                {usage.menuTitles.map((label, i) => <p key={i} className="text-xs text-[var(--daira-text-secondary)]">گزینه منو: {label}</p>)}
                {usage.icebreakerQuestions.map((label, i) => <p key={i} className="text-xs text-[var(--daira-text-secondary)]">شروع گفتگو: {label}</p>)}
                {usage.mediaIds.length ? usage.mediaIds.map((id) => (
                  <label key={id} className="daira-response-library__check-row flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-2.5">
                    <input type="checkbox" disabled={saving} className="h-5 w-5 accent-[var(--daira-primary)]"
                      checked={scopeSelected[usage.messageId]?.includes(id) ?? false}
                      onChange={(event) => setScopeSelected((current) => {
                        const old = current[usage.messageId] || [];
                        const next = event.target.checked ? [...old, id] : old.filter((item) => item !== id);
                        return { ...current, [usage.messageId]: next };
                      })}/>
                    {(scopeMedia[id]?.thumbnail_url || scopeMedia[id]?.media_url) &&
                      <img src={scopeMedia[id]?.thumbnail_url || scopeMedia[id]?.media_url || ""} alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"/>}
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--daira-heading)]">
                      {id === "__smartdirect_live_comments_v1__" ? "پاسخ لایو" :
                        scopeMedia[id]?.caption?.trim() || (scopeMedia[id]?.media_product_type === "REELS" ? "ریلز" : "محتوا " + id)}
                    </span>
                  </label>
                )) : (
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-[var(--daira-surface-hover)] p-2">
                    <input type="checkbox" disabled={saving} className="h-5 w-5 accent-[var(--daira-primary)]"
                      checked={Object.prototype.hasOwnProperty.call(scopeSelected, usage.messageId) && scopeSelected[usage.messageId] === null}
                      onChange={(event) => setScopeSelected((current) => {
                        const next = { ...current };
                        if (event.target.checked) next[usage.messageId] = null; else delete next[usage.messageId];
                        return next;
                      })}/>
                    <span className="text-xs text-[var(--daira-heading)]">اعمال برای این محل استفاده</span>
                  </label>
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="px-4 text-xs text-[var(--daira-error-text)]">{error}</p>}
          <div className="daira-glass-dialog__footer flex gap-2 border-t p-4">
            <button type="button" disabled={saving} onClick={() => setScopeOpen(false)} className="daira-glass-dialog__secondary min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold">انصراف</button>
            <button type="button" disabled={saving || selectedScopes().length === 0} onClick={() => void saveToLibrary(undefined, selectedScopes())}
              className="daira-glass-dialog__primary min-h-11 flex-1 rounded-xl px-3 text-xs font-bold disabled:opacity-50">
              {saving ? "در حال ذخیره..." : "اعمال برای " + new Intl.NumberFormat("fa-IR").format(selectedScopes().reduce((total, item) => total + (item.mediaIds.length || 1), 0)) + " مورد"}
            </button>
          </div>
        </div>
      </div>
    </GlassModalPresence>
  </section>;
}
