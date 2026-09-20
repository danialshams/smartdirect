"use client";

import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { FormItem, MessageDraft, QuickReplyDraft, Showcase } from "./automation-form-utils";
import { getMessageTypeLabel } from "./automation-form-utils";

type AutomationFlowMessageProps = {
  message: MessageDraft;
  index: number;
  total: number;
  messageOptions: { id: string; label: string }[];
  showcases: Showcase[];
  forms: FormItem[];
  loadingResources: boolean;
  instagramAccountId?: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddQuickReply: () => void;
  onUpdateQuickReply: (quickReplyId: string, patch: Partial<QuickReplyDraft>) => void;
  onRemoveQuickReply: (quickReplyId: string) => void;
  onShowcaseCreated?: (showcase: Showcase) => void;
  onFormCreated?: (form: FormItem) => void;
};

type ShowcaseItemDraft = { id: string; title: string; description: string; imageUrl: string; previewUrl: string };

const newShowcaseItem = (): ShowcaseItemDraft => ({
  id: `showcase_item_${crypto.randomUUID()}`,
  title: "",
  description: "",
  imageUrl: "",
  previewUrl: "",
});

async function uploadShowcaseImage(file: File): Promise<{ publicUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.publicUrl) {
    throw new Error(result?.message || "آپلود تصویر ویترین ناموفق بود.");
  }
  return { publicUrl: result.data.publicUrl };
}

export default function AutomationFlowMessage({
  message,
  index,
  total,
  messageOptions,
  showcases,
  loadingResources,
  instagramAccountId,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddQuickReply,
  onUpdateQuickReply,
  onRemoveQuickReply,
  onShowcaseCreated,
  onFormCreated,
}: AutomationFlowMessageProps) {
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItemDraft[]>([newShowcaseItem()]);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");

  const isForm = message.messageType === "FORM";
  const canAddReply = message.quickReplies.length < 13;

  function updateShowcaseItem(id: string, patch: Partial<ShowcaseItemDraft>) {
    setShowcaseItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function handleShowcaseImage(id: string, file?: File) {
    if (!file) return;
    try {
      setShowcaseError("");
      const localUrl = URL.createObjectURL(file);
      updateShowcaseItem(id, { previewUrl: localUrl });
      const uploaded = await uploadShowcaseImage(file);
      updateShowcaseItem(id, { imageUrl: uploaded.publicUrl, previewUrl: uploaded.publicUrl });
    } catch (error) {
      setShowcaseError(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود.");
    }
  }

  async function createShowcase() {
    try {
      if (!instagramAccountId) throw new Error("اکانت Instagram انتخاب نشده است.");
      if (!showcaseItems.length) throw new Error("حداقل یک اسلاید اضافه کنید.");
      for (let i = 0; i < showcaseItems.length; i += 1) {
        const item = showcaseItems[i];
        if (!item?.title.trim()) throw new Error(`نام اسلاید ${i + 1} را وارد کنید.`);
        if (!item?.imageUrl.trim()) throw new Error(`تصویر اسلاید ${i + 1} را آپلود کنید.`);
      }
      setShowcaseSaving(true);
      setShowcaseError("");
      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId, title: `ویترین ${new Date().toLocaleDateString("fa-IR")}`, description: null, isActive: true }),
      });
      const result = await response.json();
      if (!response.ok || result?.error) throw new Error(result?.error || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;
      for (let i = 0; i < showcaseItems.length; i += 1) {
        const item = showcaseItems[i];
        await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title.trim(), description: item.description.trim() || null, imageUrl: item.imageUrl.trim(), order: i, isActive: true }),
        }).then(async (itemResponse) => {
          const itemResult = await itemResponse.json();
          if (!itemResponse.ok || itemResult?.error) throw new Error(itemResult?.error || `ساخت اسلاید ${i + 1} ناموفق بود.`);
        });
      }
      onUpdate({ showcaseId: created.id });
      onShowcaseCreated?.({ ...created, items: showcaseItems });
    } catch (error) {
      setShowcaseError(error instanceof Error ? error.message : "ساخت ویترین ناموفق بود.");
    } finally {
      setShowcaseSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">پیام {index + 1}</p>
          <p className="mt-1 text-[11px] text-slate-400">{getMessageTypeLabel(message.messageType)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={onMoveUp} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="جابجایی به بالا"><ArrowUp size={16} /></button>
          <button type="button" disabled={index === total - 1} onClick={onMoveDown} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="جابجایی به پایین"><ArrowDown size={16} /></button>
          <button type="button" disabled={total === 1} onClick={onRemove} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="حذف پیام"><Trash2 size={16} /></button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">نوع پیام</label>
        <div className="relative">
          <select value={message.messageType} onChange={(event) => onUpdate({ messageType: event.target.value as MessageDraft["messageType"], text: "", mediaUrl: "", mediaId: "", showcaseId: "", formId: "" })} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm outline-none focus:border-slate-400">
            <option value="TEXT">متن</option>
            <option value="IMAGE">تصویر</option>
            <option value="VIDEO">ویدیو</option>
            <option value="AUDIO">صوت</option>
            <option value="SHOWCASE">ویترین</option>
            <option value="FORM">فرم / سوال</option>
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {message.messageType === "TEXT" && (
        <textarea value={message.text} onChange={(event) => onUpdate({ text: event.target.value })} rows={4} placeholder="متن پاسخ را وارد کنید..." className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-slate-400" />
      )}

      {isForm && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MessageSquare size={16} /> سوال فرم</div>
          <textarea value={message.text} onChange={(event) => onUpdate({ text: event.target.value })} rows={3} placeholder="مثلاً: کدام رنگ را می‌پسندید؟" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-slate-400" />
          <p className="text-[11px] leading-6 text-slate-500">هر جواب یک دکمه است. برای هر دکمه مقصد را انتخاب کنید؛ مقصد می‌تواند متن، سوال بعدی، ویترین، عکس، ویدیو یا صوت باشد.</p>
        </div>
      )}

      {(message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") && (
        <div className="space-y-3">
          <input value={message.mediaUrl} onChange={(event) => onUpdate({ mediaUrl: event.target.value })} placeholder="Media URL" dir="ltr" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
          <input value={message.mediaId} onChange={(event) => onUpdate({ mediaId: event.target.value })} placeholder="Media ID" dir="ltr" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400" />
        </div>
      )}

      {message.messageType === "SHOWCASE" && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-bold text-slate-800">ویترین اسلایدی</p><p className="mt-1 text-[11px] text-slate-500">هر اسلاید فقط تصویر، نام و توضیح دارد و کاربر در Instagram آن را با دست ورق می‌زند.</p></div>
            <button type="button" onClick={() => setShowcaseItems((current) => [...current, newShowcaseItem()])} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><Plus size={14} /> اسلاید</button>
          </div>
          {showcaseItems.map((item, itemIndex) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-600">اسلاید {itemIndex + 1}</span>{showcaseItems.length > 1 && <button type="button" onClick={() => setShowcaseItems((current) => current.filter((entry) => entry.id !== item.id))} className="text-slate-400 hover:text-red-600"><X size={15} /></button>}</div>
              <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                <label className="flex min-h-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-[11px] text-slate-400"><ImagePlus size={24} />آپلود تصویر</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleShowcaseImage(item.id, event.target.files?.[0])} />
                </label>
                <div className="space-y-3">
                  <input value={item.title} onChange={(event) => updateShowcaseItem(item.id, { title: event.target.value })} placeholder="نام اسلاید" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                  <textarea value={item.description} onChange={(event) => updateShowcaseItem(item.id, { description: event.target.value })} rows={3} placeholder="توضیح اسلاید" className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
            </div>
          ))}
          {showcaseError && <p className="text-xs text-red-600">{showcaseError}</p>}
          {message.showcaseId && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-6 text-emerald-800">
            <span className="font-bold">ویترین متصل شد:</span> {showcases.find((item) => item.id === message.showcaseId)?.title || "ویترین ساخته‌شده"}
            <span className="block text-[10px] text-emerald-700">شناسه ویترین: {message.showcaseId}</span>
          </div>}
          <button type="button" disabled={showcaseSaving || loadingResources || Boolean(message.showcaseId)} onClick={() => void createShowcase()} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{showcaseSaving ? "در حال ساخت ویترین..." : message.showcaseId ? "ویترین متصل است" : "ساخت و اتصال ویترین"}</button>
        </div>
      )}

      {(message.quickReplies.length > 0 || isForm) && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-slate-700">{isForm ? "جواب‌های فرم" : "Quick Reply"}</p><p className="mt-1 text-[10px] text-slate-400">با انتخاب هر جواب، مسیر بعدی تعیین می‌شود.</p></div>{canAddReply && <button type="button" onClick={onAddQuickReply} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"><Plus size={13} /> افزودن جواب</button>}</div>
          {message.quickReplies.map((quickReply, quickReplyIndex) => (
            <div key={quickReply.id} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input value={quickReply.title} onChange={(event) => onUpdateQuickReply(quickReply.id, { title: event.target.value })} placeholder={`جواب ${quickReplyIndex + 1}`} maxLength={20} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400" />
              <div className="relative"><select value={quickReply.nextMessageId ?? ""} onChange={(event) => onUpdateQuickReply(quickReply.id, { nextMessageId: event.target.value || null })} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-8 text-xs outline-none focus:border-slate-400"><option value="">مقصد جواب را انتخاب کنید</option>{messageOptions.filter((option) => option.id !== message.id).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" /></div>
              <button type="button" onClick={() => onRemoveQuickReply(quickReply.id)} className="rounded-xl border border-slate-200 bg-white px-3 text-slate-400 hover:text-red-600" aria-label="حذف جواب"><Trash2 size={15} /></button>
            </div>
          ))}
          {isForm && message.quickReplies.length === 0 && <button type="button" onClick={onAddQuickReply} className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-3 text-xs font-semibold text-slate-500 hover:bg-white">+ اولین جواب فرم را اضافه کنید</button>}
        </div>
      )}

      {message.messageType !== "FORM" && message.quickReplies.length === 0 && <button type="button" disabled={!canAddReply} onClick={onAddQuickReply} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 disabled:opacity-40"><Plus size={14} /> افزودن Quick Reply</button>}
    </div>
  );
}
