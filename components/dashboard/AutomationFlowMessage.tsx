"use client";
import { Button } from "@/components/dashboard/DashboardUI"
import { Input } from "@/components/dashboard/DashboardUI"
import { Textarea } from "@/components/dashboard/DashboardUI"
import { Select } from "@/components/dashboard/DashboardUI"

import { Check, ChevronDown, ClipboardList, ImagePlus, MessageSquare, Mic, Plus, Store, Trash2, Upload, Video, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { AutomationTriggerType } from "./AutomationManager";
import type { FormItem, MessageDraft, QuickReplyDraft, Showcase } from "./automation-form-utils";
import { getMessageTypeLabel } from "./automation-form-utils";

type AutomationFlowMessageProps = {
  message: MessageDraft;
  triggerType: AutomationTriggerType;
  index: number;
  total: number;
  showcases: Showcase[];
  forms?: FormItem[];
  loadingResources: boolean;
  instagramAccountId?: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onAddQuickReply: () => void;
  onUpdateQuickReply: (quickReplyId: string, patch: Partial<QuickReplyDraft>) => void;
  onUpdateQuickReplyTree: (
    quickReplyId: string,
    updater: (quickReply: QuickReplyDraft) => QuickReplyDraft
  ) => void;
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

async function readJsonResponse(response: Response, fallbackMessage: string) {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`${fallbackMessage} (پاسخ خالی از سرور)`);
  }
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    throw new Error(`${fallbackMessage} (پاسخ نامعتبر از سرور)`);
  }
}

async function uploadShowcaseImage(file: File): Promise<{ publicUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: formData });
  const result = await readJsonResponse(response, "آپلود تصویر ویترین ناموفق بود.");
  if (!response.ok || !result?.success || typeof result?.data?.publicUrl !== "string" || !result.data.publicUrl.trim()) {
    throw new Error(result?.message || "آپلود تصویر ویترین ناموفق بود.");
  }
  return { publicUrl: result.data.publicUrl };
}

export default function AutomationFlowMessage({
  message,
  triggerType,
  index,
  total,
  showcases,
  forms,
  loadingResources,
  instagramAccountId,
  onUpdate,
  onAddQuickReply,
  onUpdateQuickReply,
  onUpdateQuickReplyTree,
  onRemoveQuickReply,
  onShowcaseCreated,
  onFormCreated,
}: AutomationFlowMessageProps) {
  const availableForms = forms ?? [];
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItemDraft[]>([newShowcaseItem()]);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseItemSaving, setShowcaseItemSaving] = useState<string[]>([]);

  useEffect(() => {
    if (message.messageType !== "SHOWCASE" || !message.showcaseId) {
      setShowcaseItems([newShowcaseItem()]);
      return;
    }

    const showcase = (showcases ?? []).find((item) => item.id === message.showcaseId);
    const rawItems = Array.isArray(showcase?.items) ? showcase.items : [];

    if (rawItems.length > 0) {
      setShowcaseItems(
        rawItems
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : `showcase_item_${crypto.randomUUID()}`,
            title: typeof item.title === "string" ? item.title : "",
            description: typeof item.description === "string" ? item.description : "",
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
            previewUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
          })),
      );
    } else {
      setShowcaseItems([]);
    }
  }, [message.messageType, message.showcaseId, showcases]);
  const [showcaseError, setShowcaseError] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [showcaseUploadingItems, setShowcaseUploadingItems] = useState<string[]>([]);


  const isForm = message.messageType === "FORM";
  const canAddReply = message.quickReplies.length < 13;

  function updateShowcaseItem(id: string, patch: Partial<ShowcaseItemDraft>) {
    setShowcaseItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function persistExistingShowcaseItem(item: ShowcaseItemDraft, patch: Partial<ShowcaseItemDraft> = {}) {
    if (!message.showcaseId || !item.id || item.id.startsWith("showcase_item_")) return;

    const next = { ...item, ...patch };
    if (!next.title.trim()) {
      setShowcaseError("نام اسلاید نمی‌تواند خالی باشد.");
      return;
    }

    setShowcaseItemSaving((current) => current.includes(item.id) ? current : [...current, item.id]);
    try {
      setShowcaseError("");
      const response = await fetch(`/api/showcases/${encodeURIComponent(message.showcaseId)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          itemId: item.id,
          title: next.title.trim(),
          description: next.description.trim() || null,
          imageUrl: next.imageUrl.trim() || null,
        }),
      });
      const result = await readJsonResponse(response, "ذخیره تغییرات اسلاید ناموفق بود.");
      if (!response.ok || result?.error) {
        throw new Error(result?.error || result?.message || "ذخیره تغییرات اسلاید ناموفق بود.");
      }
      updateShowcaseItem(item.id, {
        title: next.title,
        description: next.description,
        imageUrl: next.imageUrl,
        previewUrl: next.previewUrl,
      });
    } catch (error) {
      setShowcaseError(error instanceof Error ? error.message : "ذخیره تغییرات اسلاید ناموفق بود.");
    } finally {
      setShowcaseItemSaving((current) => current.filter((itemId) => itemId !== item.id));
    }
  }

  async function handleShowcaseImage(id: string, file?: File) {
    if (!file) return;
    setShowcaseUploadingItems((current) => current.includes(id) ? current : [...current, id]);
    try {
      setShowcaseError("");
      const localUrl = URL.createObjectURL(file);
      updateShowcaseItem(id, { previewUrl: localUrl, imageUrl: "" });
      const uploaded = await uploadShowcaseImage(file);
      updateShowcaseItem(id, { imageUrl: uploaded.publicUrl, previewUrl: uploaded.publicUrl });

      if (message.showcaseId && !id.startsWith("showcase_item_")) {
        const currentItem = showcaseItems.find((item) => item.id === id);
        if (currentItem) {
          await persistExistingShowcaseItem(currentItem, {
            imageUrl: uploaded.publicUrl,
            previewUrl: uploaded.publicUrl,
          });
        }
      }
    } catch (error) {
      updateShowcaseItem(id, { imageUrl: "" });
      setShowcaseError(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود.");
    } finally {
      setShowcaseUploadingItems((current) => current.filter((itemId) => itemId !== id));
    }
  }

  async function handleMessageMedia(file?: File) {
    if (!file) return;
    try {
      setMediaUploading(true);
      setShowcaseError("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: formData });
      const result = await readJsonResponse(response, "آپلود فایل ناموفق بود.");
      if (!response.ok || !result?.success || typeof result?.data?.publicUrl !== "string" || !result.data.publicUrl.trim()) {
        throw new Error(result?.message || "آپلود فایل ناموفق بود.");
      }
      onUpdate({ mediaUrl: result.data.publicUrl, mediaId: "" });
    } catch (error) {
      setShowcaseError(error instanceof Error ? error.message : "آپلود فایل ناموفق بود.");
    } finally {
      setMediaUploading(false);
    }
  }

  function createBranchAnswer(): QuickReplyDraft {
    return {
      id: "branch_" + crypto.randomUUID(),
      title: "",
      payload: "payload_" + crypto.randomUUID(),
      nextMessageId: null,
      destinationType: null,
      destinationText: "",
      destinationFormId: "",
      destinationShowcaseId: "",
      destinationMediaUrl: "",
      destinationMediaId: "",
      destinationQuestion: "",
      destinationQuickReplies: [],
    };
  }


  async function createShowcase() {
    try {
      if (!instagramAccountId) throw new Error("اکانت Instagram انتخاب نشده است.");
      if (!showcaseItems.length) throw new Error("حداقل یک اسلاید اضافه کنید.");
      if (showcaseUploadingItems.length > 0) throw new Error("لطفاً صبر کنید تا آپلود تصویر اسلاید کامل شود.");
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
      const result = await readJsonResponse(response, "ساخت ویترین ناموفق بود.");
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;      for (let i = 0; i < showcaseItems.length; i += 1) {
        const item = showcaseItems[i];
        await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.title.trim(), description: item.description.trim() || null, imageUrl: item.imageUrl.trim(), order: i, isActive: true }),
        }).then(async (itemResponse) => {
          const itemResult = await readJsonResponse(itemResponse, `ساخت اسلاید ${i + 1} ناموفق بود.`);
          if (!itemResponse.ok || itemResult?.error) throw new Error(itemResult?.error || itemResult?.message || `ساخت اسلاید ${i + 1} ناموفق بود.`);
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

  const messageTypeOptions: Array<{
    value: MessageDraft["messageType"];
    label: string;
    Icon: LucideIcon;
  }> = [
    { value: "TEXT", label: "متن", Icon: MessageSquare },
    ...(triggerType === "STORY_REPLY_KEYWORD" || triggerType === "DM"
      ? [
          { value: "IMAGE" as const, label: "عکس", Icon: ImagePlus },
          { value: "VIDEO" as const, label: "ویدیو", Icon: Video },
          { value: "AUDIO" as const, label: "وویس", Icon: Mic },
          { value: "SHOWCASE" as const, label: "ویترین", Icon: Store },
          { value: "FORM" as const, label: "فرم / سوال", Icon: ClipboardList },
        ]
      : []),
  ];

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <div>
          <p className="text-sm font-bold text-[#0F172A]">نوع پاسخ</p>
          <p className="mt-1 text-xs leading-6 text-[#64748B]">
            پاسخ را مثل یک بلوک انتخاب کن؛ بعد تنظیمات همان بلوک در بخش زیر باز می‌شود.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {messageTypeOptions.map(({ value, label, Icon }) => {
            const selected = message.messageType === value;
            const descriptions: Record<string, string> = {
              TEXT: "پیام متنی",
              IMAGE: "ارسال تصویر",
              VIDEO: "ارسال ویدیو",
              AUDIO: "ارسال وویس",
              SHOWCASE: "چند اسلاید تصویری",
              FORM: "سؤال و مسیر بعدی",
            };

            return (
              <Button
                key={value}
                type="button"
                onClick={() => onUpdate({ messageType: value })}
                className={[
                  "group relative min-h-[116px] rounded-2xl border bg-white p-4 text-right transition-all",
                  selected
                    ? "border-[#7C3AED] shadow-[0_0_0_2px_rgba(124,58,237,0.10)]"
                    : "border-[#E2E8F0] hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-sm",
                ].join(" ")}
              >
                {selected && (
                  <span className="absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
                <span
                  className={[
                    "flex h-11 w-11 items-center justify-center rounded-xl border",
                    selected
                      ? "border-[#DDD6FE] bg-[#F5F3FF] text-[#7C3AED]"
                      : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
                  ].join(" ")}
                >
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="mt-5 block text-sm font-bold text-[#0F172A]">{label}</span>
                <span className="mt-1 block text-[10px] leading-5 text-[#64748B]">{descriptions[value]}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[#E2E8F0] bg-[#FAFAFC] p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#7C3AED] shadow-sm ring-1 ring-[#E2E8F0]">
            {message.messageType === "TEXT" ? <MessageSquare size={18} /> :
              message.messageType === "IMAGE" ? <ImagePlus size={18} /> :
              message.messageType === "VIDEO" ? <Video size={18} /> :
              message.messageType === "AUDIO" ? <Mic size={18} /> :
              message.messageType === "SHOWCASE" ? <Store size={18} /> : <ClipboardList size={18} />}
          </span>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">
              {message.messageType === "TEXT" ? "متن پاسخ" :
                message.messageType === "IMAGE" ? "تصویر پاسخ" :
                message.messageType === "VIDEO" ? "ویدیوی پاسخ" :
                message.messageType === "AUDIO" ? "وویس پاسخ" :
                message.messageType === "SHOWCASE" ? "ویترین پاسخ" : "فرم پاسخ"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">محتوای این پاسخ را تنظیم کن.</p>
          </div>
        </div>

        {message.messageType === "TEXT" && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
            <label className="mb-2 block text-xs font-bold text-[#334155]">متن پیام</label>
            <Textarea
              value={message.text}
              onChange={(event) => onUpdate({ text: event.target.value })}
              rows={7}
              placeholder="پیام خودکار را اینجا بنویس..."
              className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-sm leading-7 text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10"
            />
            <p className="mt-2 text-[10px] text-[#94A3B8]">پیام کوتاه و واضح، معمولاً خوانایی بهتری دارد.</p>
          </div>
        )}

        {isForm && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#334155]">سؤال</p>
                  <p className="mt-1 text-[10px] text-[#64748B]">سؤال اصلی را بنویس؛ گزینه‌ها مسیر ادامه گفتگو را تعیین می‌کنند.</p>
                </div>
                <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[10px] font-semibold text-[#7C3AED]">مرحله ۱</span>
              </div>
              <Textarea
                value={message.text}
                onChange={(event) => onUpdate({ text: event.target.value })}
                rows={3}
                placeholder="مثلاً: کدام سرویس برای شما مناسب‌تر است؟"
                className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#FAFAFC] px-4 py-3 text-sm leading-7 text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-[#7C3AED]/10"
              />
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
              <BranchAnswerEditor
                replies={message.quickReplies}
                instagramAccountId={instagramAccountId}
                showcases={showcases}
                onChange={(replies) => onUpdate({ quickReplies: replies })}
                onUpdateReply={onUpdateQuickReplyTree}
                allowRichDestinations={triggerType === "STORY_REPLY_KEYWORD" || triggerType === "DM"}
              />
            </div>
          </div>
        )}

        {(message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#FAFAFC] px-5 py-8 text-center transition hover:border-[#7C3AED] hover:bg-[#F5F3FF]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#7C3AED] shadow-sm ring-1 ring-[#E2E8F0]">
                {message.messageType === "IMAGE" ? <ImagePlus size={22} /> : message.messageType === "VIDEO" ? <Video size={22} /> : <Mic size={22} />}
              </span>
              <span className="mt-4 text-sm font-bold text-[#0F172A]">
                {mediaUploading ? "در حال آپلود..." : message.mediaUrl ? "انتخاب فایل دیگر" : "فایل را انتخاب کن"}
              </span>
              <span className="mt-1 text-[10px] leading-5 text-[#64748B]">برای تغییر فایل، همین بخش را انتخاب کن.</span>
              <Input
                type="file"
                accept={message.messageType === "IMAGE" ? "image/jpeg,image/png,image/webp" : message.messageType === "VIDEO" ? "video/mp4,video/quicktime" : "audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,audio/m4a,.mp3,.m4a,.aac,.wav"}
                className="hidden"
                disabled={mediaUploading}
                onChange={(event) => void handleMessageMedia(event.target.files?.[0])}
              />
            </label>
            {message.mediaUrl && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
                <Check size={16} className="shrink-0 text-[#16A34A]" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#166534]">فایل آماده ارسال است</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#64748B]" dir="ltr">{message.mediaUrl}</p>
                </div>
              </div>
            )}
            {showcaseError && <p className="mt-3 text-xs text-[#DC2626]">{showcaseError}</p>}
          </div>
        )}

        {message.messageType === "SHOWCASE" && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#334155]">اسلایدهای ویترین</p>
                <p className="mt-1 text-[10px] leading-5 text-[#64748B]">هر اسلاید تصویر، عنوان و توضیح خودش را دارد.</p>
              </div>
              <Button
                type="button"
                onClick={() => setShowcaseItems((current) => [...current, newShowcaseItem()])}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold text-[#334155] shadow-sm hover:bg-[#F8FAFC]"
              >
                <Plus size={13} /> اسلاید
              </Button>
            </div>
            <div className="space-y-3">
              {showcaseItems.map((item, itemIndex) => (
                <div key={item.id} className="rounded-2xl border border-[#E2E8F0] bg-[#FAFAFC] p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-[#7C3AED] ring-1 ring-[#E2E8F0]">{itemIndex + 1}</span>
                      <span className="text-xs font-bold text-[#334155]">اسلاید {itemIndex + 1}</span>
                    </div>
                    {showcaseItems.length > 1 && (
                      <Button type="button" onClick={() => setShowcaseItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex h-8 w-8 items-center justify-center rounded-lg p-0 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626]">
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[144px_1fr]">
                    <label className="flex min-h-[144px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#CBD5E1] bg-white transition hover:border-[#7C3AED]">
                      {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-[10px] text-[#64748B]"><ImagePlus size={22} />انتخاب تصویر</span>}
                      <Input type="file" accept="image/*" className="hidden" onChange={(event) => void handleShowcaseImage(item.id, event.target.files?.[0])} />
                    </label>
                    <div className="space-y-3">
                      <Input value={item.title} onChange={(event) => updateShowcaseItem(item.id, { title: event.target.value })} onBlur={() => void persistExistingShowcaseItem(item)} placeholder="عنوان اسلاید" className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm text-[#0F172A] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10" disabled={showcaseItemSaving.includes(item.id)} />
                      <Textarea value={item.description} onChange={(event) => updateShowcaseItem(item.id, { description: event.target.value })} onBlur={() => void persistExistingShowcaseItem(item)} rows={3} placeholder="توضیح کوتاه (اختیاری)" className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm leading-6 text-[#0F172A] outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/10" disabled={showcaseItemSaving.includes(item.id)} />
                      {showcaseItemSaving.includes(item.id) && <p className="text-[10px] text-[#64748B]">در حال ذخیره تغییرات...</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {showcaseError && <p className="mt-3 text-xs text-[#DC2626]">{showcaseError}</p>}
            {message.showcaseId && <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs text-[#166534]"><Check size={15} /> <span><span className="font-bold">ویترین متصل است.</span> {showcases.find((item) => item.id === message.showcaseId)?.title || "ویترین ساخته‌شده"}</span></div>}
            <Button type="button" disabled={showcaseSaving || loadingResources || showcaseUploadingItems.length > 0 || Boolean(message.showcaseId)} onClick={() => void createShowcase()} className="mt-4 w-full rounded-xl bg-[#7C3AED] px-4 py-3 text-xs font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50">
              {showcaseUploadingItems.length > 0 ? "در حال آپلود تصویر..." : showcaseSaving ? "در حال ساخت ویترین..." : message.showcaseId ? "ویترین متصل است" : "ساخت و اتصال ویترین"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}}