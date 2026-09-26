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
  forms?: FormItem[];
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
  forms,
  loadingResources,
  instagramAccountId,
  onUpdate,
  onAddQuickReply,
  onUpdateQuickReply,
  onRemoveQuickReply,
  onShowcaseCreated,
  onFormCreated,
}: AutomationFlowMessageProps) {
  const availableForms = forms ?? [];
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

  function updateNestedReply(replies: QuickReplyDraft[], replyId: string, patch: Partial<QuickReplyDraft>): QuickReplyDraft[] {
    return replies.map((reply) => {
      if (reply.id === replyId) return { ...reply, ...patch };
      if (reply.destinationQuickReplies.length) {
        return { ...reply, destinationQuickReplies: updateNestedReply(reply.destinationQuickReplies, replyId, patch) };
      }
      return reply;
    });
  }

  function updateNestedRootReply(replyId: string, patch: Partial<QuickReplyDraft>) {
    const target = message.quickReplies.find((reply) => reply.id === replyId);
    if (target) {
      onUpdateQuickReply(replyId, patch);
      return;
    }
    onUpdate({
      quickReplies: message.quickReplies.map((reply) => ({
        ...reply,
        destinationQuickReplies: updateNestedReply(reply.destinationQuickReplies, replyId, patch),
      })),
    });
  }

  function updateNestedTree(rootReplyId: string, replies: QuickReplyDraft[]) {
    onUpdateQuickReply(rootReplyId, { destinationQuickReplies: replies });
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
        <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <div>
            <p className="text-sm font-bold text-foreground">فرم</p>
            
          </div>
          <Textarea
            value={message.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            rows={3}
            placeholder="سؤال را بنویسید..."
            className="w-full resize-none rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm leading-7 outline-none focus:border-ring"
          />
          <BranchAnswerEditor
            replies={message.quickReplies}
            showcases={showcases}
            onChange={(replies) => onUpdate({ quickReplies: replies })}
          />
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
            <div><p className="text-sm font-bold text-foreground">ویترین</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">محتوای تصویری پاسخ.</p></div>
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

      {false && <div />}

    </div>
  );
}


function createBranchAnswerDraft(): QuickReplyDraft {
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

async function uploadBranchMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.publicUrl) {
    throw new Error(result?.message || "آپلود فایل ناموفق بود.");
  }
  return result.data.publicUrl as string;
}

function BranchAnswerEditor({
  replies,
  showcases,
  onChange,
  depth = 0,
}: {
  replies: QuickReplyDraft[];
  showcases: Showcase[];
  onChange: (replies: QuickReplyDraft[]) => void;
  depth?: number;
}) {
  function updateReply(id: string, patch: Partial<QuickReplyDraft>) {
    onChange(replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply));
  }

  function removeReply(id: string) {
    onChange(replies.filter((reply) => reply.id !== id));
  }

  function addReply() {
    if (replies.length >= 13) return;
    onChange([...replies, createBranchAnswerDraft()]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground">{depth === 0 ? "جواب‌ها" : "جواب‌های سؤال بعدی"}</p>
        <Button type="button" onClick={addReply} disabled={replies.length >= 13} className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground disabled:opacity-40">
          <Plus size={13} />افزودن جواب
        </Button>
      </div>

      {replies.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 bg-background px-3 py-4 text-center text-[11px] text-muted-foreground">
          حداقل یک جواب اضافه کنید.
        </div>
      )}

      {replies.map((reply, index) => (
        <div key={reply.id} className="space-y-3 rounded-xl border border-border/70 bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground">جواب {index + 1}</span>
            <Button type="button" onClick={() => removeReply(reply.id)} className="flex h-7 w-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:text-red-600" aria-label="حذف جواب"><Trash2 size={14} /></Button>
          </div>

          <Input
            value={reply.title}
            maxLength={20}
            onChange={(event) => updateReply(reply.id, { title: event.target.value })}
            placeholder="متن جواب"
            className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm"
          />

          <div className="relative">
            <Select
              value={reply.destinationType ?? ""}
              onChange={(event) => updateReply(reply.id, {
                destinationType: (event.target.value || null) as QuickReplyDraft["destinationType"],
                destinationText: "",
                destinationShowcaseId: "",
                destinationMediaUrl: "",
                destinationMediaId: "",
                destinationQuestion: "",
                destinationQuickReplies: [],
              })}
              className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-xs"
            >
              <option value="">مقصد این جواب را انتخاب کنید</option>
              <option value="TEXT">متن</option>
              <option value="FORM">فرم / سؤال بعدی</option>
              <option value="SHOWCASE">ویترین</option>
              <option value="IMAGE">عکس</option>
              <option value="VIDEO">ویدیو</option>
              <option value="AUDIO">وویس</option>
            </Select>
            <ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          {reply.destinationType === "TEXT" && (
            <Textarea
              value={reply.destinationText}
              onChange={(event) => updateReply(reply.id, { destinationText: event.target.value })}
              rows={3}
              placeholder="متن پاسخ را وارد کنید..."
              className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6"
            />
          )}

          {reply.destinationType === "SHOWCASE" && (
            <div className="relative">
              <Select
                value={reply.destinationShowcaseId}
                onChange={(event) => updateReply(reply.id, { destinationShowcaseId: event.target.value })}
                className="w-full appearance-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-xs"
              >
                <option value="">ویترین را انتخاب کنید</option>
                {showcases.map((showcase) => <option key={showcase.id} value={showcase.id}>{showcase.title}</option>)}
              </Select>
              <ChevronDown size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          )}

          {["IMAGE", "VIDEO", "AUDIO"].includes(reply.destinationType ?? "") && (
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs font-semibold">
              {reply.destinationMediaUrl ? "فایل انتخاب شده؛ برای تغییر کلیک کنید." : "فایل مقصد را انتخاب کنید"}
              <span className="text-[10px] font-normal text-muted-foreground">عکس، ویدیو یا وویس</span>
              <Input
                type="file"
                accept={reply.destinationType === "IMAGE" ? "image/*" : reply.destinationType === "VIDEO" ? "video/*" : "audio/*"}
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadBranchMedia(file);
                    updateReply(reply.id, { destinationMediaUrl: url, destinationMediaId: "" });
                  } catch {
                    // Validation on submit will surface a missing destination file.
                  }
                }}
              />
            </label>
          )}

          {reply.destinationType === "FORM" && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
              <Textarea
                value={reply.destinationQuestion}
                onChange={(event) => updateReply(reply.id, { destinationQuestion: event.target.value })}
                rows={2}
                placeholder="سؤال بعدی را وارد کنید..."
                className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6"
              />
              <BranchAnswerEditor
                replies={reply.destinationQuickReplies}
                showcases={showcases}
                depth={depth + 1}
                onChange={(children) => updateReply(reply.id, { destinationQuickReplies: children })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
