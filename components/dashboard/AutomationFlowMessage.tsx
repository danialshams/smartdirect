"use client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"

import { ChevronDown, ClipboardList, ImagePlus, MessageSquare, Mic, Plus, Store, Trash2, Upload, Video, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { AutomationTriggerType } from "./AutomationManager";
import type { FormItem, MessageDraft, QuickReplyDraft, Showcase } from "./automation-form-utils";
import { getMessageTypeLabel } from "./automation-form-utils";

type AutomationFlowMessageProps = {
  message: MessageDraft;
  triggerType: AutomationTriggerType;
  index: number;
  total: number;
  showcases: Showcase[];
  forms: FormItem[];
  loadingResources: boolean;
  instagramAccountId?: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
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
  triggerType,
  index,
  total,
  showcases,
  loadingResources,
  instagramAccountId,
  onUpdate,
  onAddQuickReply,
  onUpdateQuickReply,
  onRemoveQuickReply,
  onShowcaseCreated,
  onFormCreated,
}: AutomationFlowMessageProps) {
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItemDraft[]>([newShowcaseItem()]);
  const [showcaseSaving, setShowcaseSaving] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);

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

  async function handleMessageMedia(file?: File) {
    if (!file) return;
    try {
      setMediaUploading(true);
      setShowcaseError("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result?.success || !result?.data?.publicUrl) {
        throw new Error(result?.message || "آپلود فایل ناموفق بود.");
      }
      onUpdate({ mediaUrl: result.data.publicUrl, mediaId: "" });
    } catch (error) {
      setShowcaseError(error instanceof Error ? error.message : "آپلود فایل ناموفق بود.");
    } finally {
      setMediaUploading(false);
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

  const messageTypeOptions: Array<{
    value: MessageDraft["messageType"];
    label: string;
    Icon: LucideIcon;
  }> = [
    { value: "TEXT", label: "متن", Icon: MessageSquare },
    ...(triggerType === "STORY_REPLY_KEYWORD"
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
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">نوع پیام</p>
        <p className="mt-1 text-[11px] text-muted-foreground">نوع پاسخی که کاربر دریافت می‌کند را انتخاب کنید.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {messageTypeOptions.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            onClick={() => onUpdate({ messageType: value, text: "", mediaUrl: "", mediaId: "", showcaseId: "", formId: "" })}
            className={[
              "flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-xs font-semibold transition",
              message.messageType === value
                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                : "border-border/70 bg-background text-muted-foreground hover:bg-muted",
            ].join(" ")}
          >
            <Icon size={20} />
            {label}
          </Button>
        ))}
      </div>

      {message.messageType === "TEXT" && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">متن پاسخ</label>
          <Textarea value={message.text} onChange={(event) => onUpdate({ text: event.target.value })} rows={5} placeholder="متن پاسخ را وارد کنید..." className="w-full resize-none rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm leading-7 outline-none focus:border-ring" />
        </div>
      )}

      {isForm && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <div className="flex items-center gap-2"><MessageSquare size={16} className="text-primary" /><span className="text-sm font-bold text-foreground">سوال فرم</span></div>
          <Textarea value={message.text} onChange={(event) => onUpdate({ text: event.target.value })} rows={3} placeholder="مثلاً: کدام رنگ را می‌پسندید؟" className="w-full resize-none rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm leading-7 outline-none focus:border-ring" />
          <p className="text-[11px] leading-6 text-muted-foreground">برای هر جواب یک دکمه بسازید و مقصد بعدی آن را مشخص کنید.</p>
        </div>
      )}

      {(message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-center text-xs font-semibold text-foreground transition hover:bg-muted/40">
            {message.messageType === "IMAGE" ? <ImagePlus size={24} className="text-primary" /> : message.messageType === "VIDEO" ? <Video size={24} className="text-primary" /> : <Mic size={24} className="text-primary" />}
            {mediaUploading ? "در حال آپلود..." : message.mediaUrl ? "انتخاب فایل دیگر" : "انتخاب فایل"}
            <span className="text-[10px] font-normal text-muted-foreground">فایل را از دستگاه انتخاب کنید.</span>
            <Input type="file" accept={message.messageType === "IMAGE" ? "image/jpeg,image/png,image/webp" : message.messageType === "VIDEO" ? "video/mp4,video/quicktime" : "audio/*"} className="hidden" disabled={mediaUploading} onChange={(event) => void handleMessageMedia(event.target.files?.[0])} />
          </label>
          {message.mediaUrl && <p className="truncate rounded-lg bg-background px-3 py-2 text-[10px] text-muted-foreground" dir="ltr">{message.mediaUrl}</p>}
          {showcaseError && <p className="text-xs text-red-600">{showcaseError}</p>}
        </div>
      )}

      {message.messageType === "SHOWCASE" && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-sm font-bold text-foreground">ویترین</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">اسلایدهای تصویری که کاربر در Instagram ورق می‌زند.</p></div>
            <Button type="button" onClick={() => setShowcaseItems((current) => [...current, newShowcaseItem()])} className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-2 text-[11px] font-semibold text-foreground"><Plus size={13} />اسلاید</Button>
          </div>
          {showcaseItems.map((item, itemIndex) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold text-muted-foreground">اسلاید {itemIndex + 1}</span>{showcaseItems.length > 1 && <Button type="button" onClick={() => setShowcaseItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex h-7 w-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:text-red-600"><X size={14} /></Button>}</div>
              <div className="grid gap-3 sm:grid-cols-[112px_1fr]">
                <label className="flex min-h-[112px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground"><ImagePlus size={22} />تصویر</span>}
                  <Input type="file" accept="image/*" className="hidden" onChange={(event) => void handleShowcaseImage(item.id, event.target.files?.[0])} />
                </label>
                <div className="space-y-2.5">
                  <Input value={item.title} onChange={(event) => updateShowcaseItem(item.id, { title: event.target.value })} placeholder="نام اسلاید" className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:border-ring" />
                  <Textarea value={item.description} onChange={(event) => updateShowcaseItem(item.id, { description: event.target.value })} rows={3} placeholder="توضیح اسلاید" className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-ring" />
                </div>
              </div>
            </div>
          ))}
          {showcaseError && <p className="text-xs text-red-600">{showcaseError}</p>}
          {message.showcaseId && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-6 text-emerald-800"><span className="font-bold">ویترین متصل شد:</span> {showcases.find((item) => item.id === message.showcaseId)?.title || "ویترین ساخته‌شده"}</div>}
          <Button type="button" disabled={showcaseSaving || loadingResources || Boolean(message.showcaseId)} onClick={() => void createShowcase()} className="w-full rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{showcaseSaving ? "در حال ساخت ویترین..." : message.showcaseId ? "ویترین متصل است" : "ساخت و اتصال ویترین"}</Button>
        </div>
      )}

      {isForm && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-foreground">پاسخ‌های فرم</p>
              <p className="mt-1 text-[10px] leading-5 text-muted-foreground">برای هر جواب، مقصد بعدی را انتخاب کنید. مقصد می‌تواند متن، فرم یا ویترین باشد.</p>
            </div>
            {canAddReply && <Button type="button" onClick={onAddQuickReply} className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground"><Plus size={13} />افزودن پاسخ</Button>}
          </div>
          {message.quickReplies.map((answer, answerIndex) => (
            <div key={answer.id} className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <Input value={answer.title} onChange={(event) => onUpdateQuickReply(answer.id, { title: event.target.value })} placeholder={"جواب " + (answerIndex + 1)} maxLength={20} className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:border-ring" />
                <div className="relative">
                  <Select value={answer.destinationType ?? ""} onChange={(event) => onUpdateQuickReply(answer.id, { destinationType: (event.target.value || null) as QuickReplyDraft["destinationType"], destinationText: "", destinationFormId: "", destinationShowcaseId: "", nextMessageId: null })} className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2.5 pl-8 text-xs outline-none focus:border-ring">
                    <option value="">نوع مقصد پاسخ را انتخاب کنید</option>
                    <option value="TEXT">متن</option>
                    <option value="FORM">فرم</option>
                    <option value="SHOWCASE">ویترین</option>
                  </Select>
                  <ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
                <Button type="button" onClick={() => onRemoveQuickReply(answer.id)} className="rounded-xl border border-border/70 bg-background px-3 text-muted-foreground hover:text-red-600" aria-label="حذف پاسخ"><Trash2 size={15} /></Button>
              </div>
              {answer.destinationType === "TEXT" && <Textarea value={answer.destinationText} onChange={(event) => onUpdateQuickReply(answer.id, { destinationText: event.target.value })} rows={3} placeholder="متن مقصد را وارد کنید." className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-ring" />}
              {answer.destinationType === "FORM" && <div className="relative"><Select value={answer.destinationFormId} onChange={(event) => onUpdateQuickReply(answer.id, { destinationFormId: event.target.value })} className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2.5 pl-8 text-xs outline-none focus:border-ring"><option value="">فرم مقصد را انتخاب کنید</option>{forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}</Select><ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>}
              {answer.destinationType === "SHOWCASE" && <div className="relative"><Select value={answer.destinationShowcaseId} onChange={(event) => onUpdateQuickReply(answer.id, { destinationShowcaseId: event.target.value })} className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2.5 pl-8 text-xs outline-none focus:border-ring"><option value="">ویترین مقصد را انتخاب کنید</option>{showcases.map((showcase) => <option key={showcase.id} value={showcase.id}>{showcase.title}</option>)}</Select><ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>}
            </div>
          ))}
          {message.quickReplies.length === 0 && <Button type="button" onClick={onAddQuickReply} className="w-full rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs font-semibold text-muted-foreground hover:bg-background">+ اولین پاسخ فرم</Button>}
        </div>
      )}
    </div>
  );
}
