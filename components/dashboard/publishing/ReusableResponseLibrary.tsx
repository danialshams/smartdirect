"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Eye, Pencil, Plus, Save, X } from "lucide-react";
import GlassModalPresence from "../GlassModalPresence";
import type { MessageDraft, QuickReplyDraft } from "../automation-form-utils";

type Saved = {
  id: string; title: string; updatedAt: string; messageType: MessageDraft["messageType"];
  text: string | null; mediaUrl: string | null; mediaId: string | null;
  showcaseId: string | null; formId: string | null; quickReplies: QuickReplyDraft[] | null;
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
function BranchPreview({ replies, depth = 0 }: { replies: QuickReplyDraft[]; depth?: number }) {
  if (depth > 4) return null;
  return <div className="space-y-2">
    {replies.map((reply, index) => <div key={reply.id || index}
      className="daira-flow-glass space-y-2 rounded-xl p-3">
      <p className="text-xs font-bold text-[var(--daira-heading)]">{reply.title}</p>
      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">{reply.destinationType === "FORM" ? reply.destinationQuestion : reply.destinationType === "TEXT" ? reply.destinationText : typeNames[reply.destinationType as MessageDraft["messageType"]] || "پاسخ"}</p>
      {reply.destinationType === "FORM" && <BranchPreview replies={reply.destinationQuickReplies || []} depth={depth + 1}/>}
    </div>)}
  </div>;
}
function ResponsePreview({ value }: { value: Saved }) {
  return <div className="space-y-3">
    <p className="text-xs font-bold text-[var(--daira-text-secondary)]">نوع پاسخ: {typeNames[value.messageType]}</p>
    {value.text && <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--daira-heading)]">{value.text}</p>}
    {value.messageType === "IMAGE" && value.mediaUrl && <img src={value.mediaUrl} alt="پیش‌نمایش پاسخ" className="max-h-72 w-full rounded-xl object-contain"/>}
    {value.messageType === "VIDEO" && value.mediaUrl && <video src={value.mediaUrl} controls className="max-h-72 w-full rounded-xl"/>}
    {value.messageType === "AUDIO" && value.mediaUrl && <audio src={value.mediaUrl} controls className="w-full"/>}
    {value.messageType === "FORM" && Array.isArray(value.quickReplies) && <BranchPreview replies={value.quickReplies}/>}
    {value.messageType === "SHOWCASE" && value.showcase && <div className="space-y-3">
      <p className="text-xs font-bold text-[var(--daira-heading)]">{value.showcase.title}</p>
      {value.showcase.items.map((item) => <div key={item.id} className="daira-flow-glass flex items-center gap-3 rounded-xl p-3">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover"/>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--daira-heading)]">{item.title}</p>
          {item.description && <p className="mt-1 text-xs leading-5 text-[var(--daira-text-secondary)]">{item.description}</p>}
        </div>
      </div>)}
    </div>}
    {value.messageType === "FORM" && value.form && <div className="space-y-2">
      <p className="text-xs font-bold text-[var(--daira-heading)]">{value.form.title}</p>
      {value.form.fields.map((field) => <p key={field.id} className="daira-flow-glass rounded-lg p-2 text-xs">{field.label}</p>)}
    </div>}
  </div>;
}

export default function ReusableResponseLibrary({ instagramAccountId, message, onUpdate, allowedTypes, prefix = "پاسخ", initialName = "", onNameChange, onRegisterSave, disabled = false }: Props) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initialName);
  useEffect(() => { setName(initialName); }, [initialName]);
  const [editingId, setEditingId] = useState("");
  const [preview, setPreview] = useState<Saved | null>(null);
  const [error, setError] = useState("");
  const filtered = useMemo(() => items.filter((item) => allowedTypes.includes(item.messageType)), [items, allowedTypes.join(",")]);

  useEffect(() => {
    if (!instagramAccountId) return;
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/saved-responses?instagramAccountId=" + encodeURIComponent(instagramAccountId), { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok || !result?.success) throw Error(result?.error || "دریافت پاسخ‌ها ناموفق بود."); return result.data as Saved[]; })
      .then((data) => { if (!controller.signal.aborted) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "دریافت پاسخ‌ها ناموفق بود."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [instagramAccountId]);

  function loadResponse(item: Saved, edit = false) {
    onUpdate({
      messageType: item.messageType, text: item.text || "",
      mediaUrl: item.mediaUrl || "", mediaId: item.mediaId || "",
      showcaseId: item.showcaseId || "", formId: item.formId || "",
      quickReplies: cloneTree(Array.isArray(item.quickReplies) ? item.quickReplies : []),
    });
    setPreview(null);
    setMode("new");
    setEditingId(edit ? item.id : "");
    setName(edit ? item.title : "");
    onNameChange?.(edit ? item.title : "");
    setError("");
  }
  async function saveToLibrary(override?: MessageDraft): Promise<boolean> {
    if (saving || disabled) return false;
    const draft = override || message;
    const title = name.trim();
    if (override && !title) return true;
    if (!title || title.length > 80) { setError("نام پاسخ را وارد کن (حداکثر ۸۰ نویسه)."); return false; }
    if (!allowedTypes.includes(draft.messageType)) { setError("این نوع پاسخ در این بخش پشتیبانی نمی‌شود."); return false; }
    const original = items.find((item) => item.id === editingId);
    if (editingId && !original) { setError("پاسخ قبلی پیدا نشد. فهرست را تازه‌سازی کن."); return false; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editingId ? "/api/saved-responses/" + encodeURIComponent(editingId) : "/api/saved-responses", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId, title, messageType: draft.messageType,
          text: draft.text || null, mediaUrl: draft.mediaUrl || null,
          mediaId: draft.mediaId || null, showcaseId: draft.showcaseId || null,
          formId: draft.formId || null, quickReplies: draft.quickReplies || [],
          ...(original ? { expectedUpdatedAt: original.updatedAt } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success || !result.data?.id) throw Error(result?.error || "ذخیره پاسخ ناموفق بود.");
      const saved = result.data as Saved;
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setEditingId(saved.id);
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

  return <section dir="rtl" className="space-y-3" aria-label="کتابخانه پاسخ‌ها">
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="روش ساخت پاسخ">
      {([{ value: "new", label: "ساخت پاسخ جدید", Icon: Plus }, { value: "existing", label: "استفاده از پاسخ قبلی", Icon: BookOpen }] as const).map(({ value, label, Icon }) =>
        <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); setError(""); }}
          className={"daira-flow-glass flex min-h-14 items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold " + (mode === value ? "!border-[var(--daira-primary)] !bg-[var(--daira-outline-hover-bg)] text-[var(--daira-primary)]" : "text-[var(--daira-heading)]")}>
          <span>{label}</span><Icon size={16}/>
        </button>)}
    </div>
    {mode === "new" ? <div className="daira-flow-glass space-y-3 rounded-xl p-3">
      <label htmlFor="reusable-response-name" className="block text-xs font-bold text-[var(--daira-heading)]">{message.messageType === "FORM" ? "نام فرم" : message.messageType === "SHOWCASE" ? "نام ویترین" : "نام پاسخ"}</label>
      <input id="reusable-response-name" type="text" value={name} maxLength={80} onChange={(event) => { setName(event.target.value); onNameChange?.(event.target.value); }}
        placeholder="مثلاً کفش" disabled={disabled || saving}
        className="w-full rounded-xl border border-[var(--daira-input-border)] bg-[var(--daira-surface)] px-3 py-3 text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-input-focus)]" style={{fontSize:"16px"}}/>
      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">{message.messageType === "FORM" ? "نامی برای فرم" : message.messageType === "SHOWCASE" ? "نامی برای ویترین" : "نامی برای پاسخ"} انتخاب کن تا بعداً بتوانی دوباره از آن استفاده کنی.</p>
      <button type="button" onClick={() => void saveToLibrary()} disabled={saving || disabled || !name.trim()}
        className="daira-glass-dialog__primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-50">
        <span>{saving ? "در حال ذخیره..." : editingId ? "ذخیره ویرایش پاسخ" : "ذخیره در پاسخ‌های قبلی"}</span><Save size={16}/>
      </button>
      {editingId && <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">ویرایش کتابخانه فقط قالب ذخیره‌شده را تغییر می‌دهد؛ تنظیمات پاسخ‌های فعال به صورت خودکار بازنویسی نمی‌شوند.</p>}
      {editingId && <button type="button" onClick={() => {setEditingId("");setName("");}} className="ml-2 text-xs text-[var(--daira-text-secondary)]">انصراف از ویرایش پاسخ ذخیره‌شده</button>}
    </div> : <div className="daira-flow-glass space-y-2 rounded-xl p-3">
      {loading ? <div role="status" className="daira-skeleton__bar h-14 w-full rounded-xl"/> : filtered.length === 0 ?
        <p className="py-4 text-center text-xs text-[var(--daira-text-secondary)]">پاسخ سازگاری ذخیره نشده است.</p> :
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {filtered.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-[var(--daira-glass-rim)] bg-[var(--daira-glass-raised)] p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[var(--daira-heading)]">{displayName(item, prefix)}</p>
              <p className="mt-1 text-[11px] text-[var(--daira-text-secondary)]">{typeNames[item.messageType]}</p>
            </div>
            <button type="button" onClick={() => setPreview(item)} aria-label={"مشاهده " + item.title} className="daira-glass-dialog__secondary rounded-lg border p-2"><Eye size={16}/></button>
            <button type="button" onClick={() => loadResponse(item)} aria-label={"استفاده از " + item.title} className="daira-glass-dialog__primary rounded-lg p-2"><Check size={16}/></button>
          </div>)}
        </div>}
    </div>}
    {error && <p role="alert" className="text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
    <GlassModalPresence open={Boolean(preview)} onEscape={() => setPreview(null)}>
      <div className="daira-glass-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
        <div role="dialog" aria-modal="true" aria-label="مشاهده پاسخ ذخیره‌شده" className="daira-glass-dialog flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[26px]" dir="rtl">
          <div className="daira-glass-dialog__header flex items-center justify-between border-b p-4">
            <h3 className="text-sm font-extrabold text-[var(--daira-heading)]">{preview ? displayName(preview, prefix) : ""}</h3>
            <button type="button" onClick={() => setPreview(null)} className="daira-glass-dialog__close rounded-lg p-2" aria-label="بستن"><X size={18}/></button>
          </div>
          <div className="overflow-y-auto p-4">{preview && <ResponsePreview value={preview}/>}</div>
          <div className="daira-glass-dialog__footer flex gap-2 border-t p-4">
            <button type="button" disabled={!preview} onClick={() => { if (preview) loadResponse(preview, true); }} className="daira-glass-dialog__secondary flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold"><span>ویرایش پاسخ</span><Pencil size={15}/></button>
            <button type="button" disabled={!preview} onClick={() => { if (preview) loadResponse(preview); }} className="daira-glass-dialog__primary flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold"><span>استفاده از پاسخ</span><Check size={15}/></button>
          </div>
        </div>
      </div>
    </GlassModalPresence>
  </section>;
}
