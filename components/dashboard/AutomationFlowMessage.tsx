"use client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"

import { ChevronDown, ClipboardList, ImagePlus, MessageSquare, Mic, Plus, Store, Trash2, Upload, Video, X, type LucideIcon } from "lucide-react";
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
      const created = result.data ?? result;
      for (let i = 0; i < showcaseItems.length; i += 1) {
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
            onClick={() => onUpdate({ messageType: value })}
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
            instagramAccountId={instagramAccountId}
            showcases={showcases}
            onChange={(replies) => onUpdate({ quickReplies: replies })}
            onUpdateReply={onUpdateQuickReplyTree}
            allowRichDestinations={triggerType === "STORY_REPLY_KEYWORD"}
          />
        </div>
      )}

      {(message.messageType === "IMAGE" || message.messageType === "VIDEO" || message.messageType === "AUDIO") && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-5 text-center text-xs font-semibold text-foreground transition hover:bg-muted/40">
            {message.messageType === "IMAGE" ? <ImagePlus size={24} className="text-primary" /> : message.messageType === "VIDEO" ? <Video size={24} className="text-primary" /> : <Mic size={24} className="text-primary" />}
            {mediaUploading ? "در حال آپلود..." : message.mediaUrl ? "انتخاب فایل دیگر" : "انتخاب فایل"}
            <span className="text-[10px] font-normal text-muted-foreground">فایل را از دستگاه انتخاب کنید.</span>
            <Input type="file" accept={message.messageType === "IMAGE" ? "image/jpeg,image/png,image/webp" : message.messageType === "VIDEO" ? "video/mp4,video/quicktime" : "audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/x-wav,audio/m4a,.mp3,.m4a,.aac,.wav"} className="hidden" disabled={mediaUploading} onChange={(event) => void handleMessageMedia(event.target.files?.[0])} />
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
                  <Input
                    value={item.title}
                    onChange={(event) => updateShowcaseItem(item.id, { title: event.target.value })}
                    onBlur={() => void persistExistingShowcaseItem(item)}
                    placeholder="نام اسلاید"
                    className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
                    disabled={showcaseItemSaving.includes(item.id)}
                  />
                  <Textarea
                    value={item.description}
                    onChange={(event) => updateShowcaseItem(item.id, { description: event.target.value })}
                    onBlur={() => void persistExistingShowcaseItem(item)}
                    rows={3}
                    placeholder="توضیح اسلاید"
                    className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-ring"
                    disabled={showcaseItemSaving.includes(item.id)}
                  />
                  {showcaseItemSaving.includes(item.id) && (
                    <p className="text-[10px] text-muted-foreground">در حال ذخیره تغییرات...</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {showcaseError && <p className="text-xs text-red-600">{showcaseError}</p>}
          {message.showcaseId && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-6 text-emerald-800"><span className="font-bold">ویترین متصل شد:</span> {showcases.find((item) => item.id === message.showcaseId)?.title || "ویترین ساخته‌شده"}</div>}
          <Button type="button" disabled={showcaseSaving || loadingResources || showcaseUploadingItems.length > 0 || Boolean(message.showcaseId)} onClick={() => void createShowcase()} className="w-full rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-white disabled:opacity-50">{showcaseUploadingItems.length > 0 ? "در حال آپلود تصویر..." : showcaseSaving ? "در حال ساخت ویترین..." : message.showcaseId ? "ویترین متصل است" : "ساخت و اتصال ویترین"}</Button>
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

async function uploadBranchMedia(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/instagram/publishing/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const result = xhr.response;
      if (xhr.status < 200 || xhr.status >= 300 || !result?.success || !result?.data?.publicUrl) {
        reject(new Error(result?.message || "آپلود فایل ناموفق بود."));
        return;
      }
      onProgress?.(100);
      resolve(result.data.publicUrl as string);
    };

    xhr.onerror = () => reject(new Error("ارتباط با سرور برای آپلود فایل برقرار نشد."));
    xhr.onabort = () => reject(new Error("آپلود فایل لغو شد."));
    xhr.send(formData);
  });
}

function BranchShowcaseCreator({
  instagramAccountId,
  showcaseId,
  showcases,
  onCreated,
}: {
  instagramAccountId?: string;
  showcaseId: string;
  showcases?: Showcase[];
  onCreated: (showcaseId: string) => void;
}) {
  const [items, setItems] = useState<ShowcaseItemDraft[]>([newShowcaseItem()]);
  const [saving, setSaving] = useState(false);
  const [itemSaving, setItemSaving] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!showcaseId) {
      setItems([newShowcaseItem()]);
      return;
    }
    const showcase = (showcases ?? []).find((item) => item.id === showcaseId);
    const rawItems = Array.isArray(showcase?.items) ? showcase.items : [];
    setItems(rawItems.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item) => ({
      id: typeof item.id === "string" ? item.id : `showcase_item_${crypto.randomUUID()}`,
      title: typeof item.title === "string" ? item.title : "",
      description: typeof item.description === "string" ? item.description : "",
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
      previewUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
    })));
  }, [showcaseId, showcases]);

  async function saveExistingItem(item: ShowcaseItemDraft, patch: Partial<ShowcaseItemDraft> = {}) {
    if (!showcaseId || item.id.startsWith("showcase_item_")) return;
    const next = { ...item, ...patch };
    if (!next.title.trim()) { setError("نام اسلاید نمی‌تواند خالی باشد."); return; }
    setItemSaving((current) => current.includes(item.id) ? current : [...current, item.id]);
    try {
      setError("");
      const response = await fetch(`/api/showcases/${encodeURIComponent(showcaseId)}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemId: item.id, title: next.title.trim(), description: next.description.trim() || null, imageUrl: next.imageUrl.trim() || null }),
      });
      const result = await readJsonResponse(response, "ذخیره تغییرات اسلاید ناموفق بود.");
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ذخیره تغییرات اسلاید ناموفق بود.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "ذخیره تغییرات اسلاید ناموفق بود.");
    } finally {
      setItemSaving((current) => current.filter((itemId) => itemId !== item.id));
    }
  }

  async function uploadImage(id: string, file?: File) {
    if (!file) return;
    try {
      setError("");
      const previewUrl = URL.createObjectURL(file);
      setItems((current) => current.map((item) => item.id === id ? { ...item, previewUrl } : item));
      const uploaded = await uploadShowcaseImage(file);
      setItems((current) => current.map((item) => item.id === id ? { ...item, imageUrl: uploaded.publicUrl, previewUrl: uploaded.publicUrl } : item));
      const currentItem = items.find((item) => item.id === id);
      if (showcaseId && currentItem && !id.startsWith("showcase_item_")) await saveExistingItem(currentItem, { imageUrl: uploaded.publicUrl, previewUrl: uploaded.publicUrl });
    } catch (error) {
      setError(error instanceof Error ? error.message : "آپلود تصویر ناموفق بود.");
    }
  }

  async function createInlineShowcase() {
    try {
      if (!instagramAccountId) throw new Error("اکانت Instagram انتخاب نشده است.");
      for (let i = 0; i < items.length; i += 1) {
        if (!items[i].title.trim()) throw new Error(`نام اسلاید ${i + 1} را وارد کنید.`);
        if (!items[i].imageUrl.trim()) throw new Error(`تصویر اسلاید ${i + 1} را آپلود کنید.`);
      }
      setSaving(true);
      setError("");

      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId,
          title: `ویترین ${new Date().toLocaleDateString("fa-IR")}`,
          description: null,
          isActive: true,
        }),
      });
      const result = await readJsonResponse(response, "ساخت ویترین ناموفق بود.");
      if (!response.ok || result?.error) {
        throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      }

      const created = result.data ?? result;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const itemResponse = await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title.trim(),
            description: item.description.trim() || null,
            imageUrl: item.imageUrl.trim(),
            order: i,
            isActive: true,
          }),
        });
        const itemResult = await readJsonResponse(itemResponse, `ساخت اسلاید ${i + 1} ناموفق بود.`);
        if (!itemResponse.ok || itemResult?.error) {
          throw new Error(itemResult?.error || itemResult?.message || `ساخت اسلاید ${i + 1} ناموفق بود.`);
        }
      }

      onCreated(created.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "ساخت ویترین ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
      {showcaseId ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            ویترین متصل است. تصویر، نام و توضیح هر اسلاید قابل ویرایش است.
          </div>
          {items.map((item, itemIndex) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="mb-2.5 flex items-center justify-between"><span className="text-[11px] font-bold text-muted-foreground">اسلاید {itemIndex + 1}</span>{itemSaving.includes(item.id) && <span className="text-[10px] text-muted-foreground">در حال ذخیره...</span>}</div>
              <div className="grid gap-3 sm:grid-cols-[112px_1fr]">
                <label className="flex min-h-[112px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
                  {item.previewUrl ? <img src={item.previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground"><ImagePlus size={22} />تصویر</span>}
                  <Input type="file" accept="image/*" className="hidden" onChange={(event) => void uploadImage(item.id, event.target.files?.[0])} />
                </label>
                <div className="space-y-2.5">
                  <Input value={item.title} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} onBlur={() => void saveExistingItem(item)} placeholder="نام اسلاید" className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:border-ring" disabled={itemSaving.includes(item.id)} />
                  <Textarea value={item.description} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} onBlur={() => void saveExistingItem(item)} rows={3} placeholder="توضیح اسلاید" className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-ring" disabled={itemSaving.includes(item.id)} />
                </div>
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-foreground">ساخت ویترین</p>
              <p className="mt-1 text-[10px] leading-5 text-muted-foreground">ویترین همین‌جا ساخته می‌شود و نیازی به انتخاب ویترین قبلی نیست.</p>
            </div>
            <Button
              type="button"
              onClick={() => setItems((current) => [...current, newShowcaseItem()])}
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground"
            >
              <Plus size={13} />اسلاید
            </Button>
          </div>

          {items.map((item, itemIndex) => (
            <div key={item.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">اسلاید {itemIndex + 1}</span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg p-0 text-muted-foreground hover:text-red-600"
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[112px_1fr]">
                <label className="flex min-h-[112px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground">
                      <ImagePlus size={22} />تصویر
                    </span>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void uploadImage(item.id, event.target.files?.[0])}
                  />
                </label>
                <div className="space-y-2.5">
                  <Input
                    value={item.title}
                    onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))}
                    placeholder="نام اسلاید"
                    className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
                  />
                  <Textarea
                    value={item.description}
                    onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))}
                    rows={3}
                    placeholder="توضیح اسلاید"
                    className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-ring"
                  />
                </div>
              </div>
            </div>
          ))}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button
            type="button"
            disabled={saving}
            onClick={() => void createInlineShowcase()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "در حال ساخت ویترین..." : "ساخت و اتصال ویترین"}
          </Button>
        </>
      )}
    </div>
  );
}

function BranchAnswerEditor({
  replies,
  instagramAccountId,
  showcases,
  onChange,
  onUpdateReply,
  allowRichDestinations = true,
  depth = 0,
}: {
  replies: QuickReplyDraft[];
  instagramAccountId?: string;
  showcases?: Showcase[];
  onChange: (replies: QuickReplyDraft[]) => void;
  onUpdateReply: (
    replyId: string,
    updater: (reply: QuickReplyDraft) => QuickReplyDraft
  ) => void;
  allowRichDestinations?: boolean;
  depth?: number;
}) {
  function updateReply(id: string, patch: Partial<QuickReplyDraft>) {
    onUpdateReply(id, (reply) => ({ ...reply, ...patch }));
  }

  function removeReply(id: string) {
    onChange(replies.filter((reply) => reply.id !== id));
  }

  function addReply() {
    if (replies.length >= 13) return;
    onChange([...replies, createBranchAnswerDraft()]);
  }

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  const destinationOptions = allowRichDestinations
    ? [
        ["TEXT", "متن"],
        ["FORM", "فرم / سؤال بعدی"],
        ["SHOWCASE", "ویترین"],
        ["IMAGE", "عکس"],
        ["VIDEO", "ویدیو"],
        ["AUDIO", "وویس"],
      ]
    : [["TEXT", "متن"]];

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
              {destinationOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
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

          {allowRichDestinations && reply.destinationType === "SHOWCASE" && (
            <BranchShowcaseCreator
              instagramAccountId={instagramAccountId}
              showcaseId={reply.destinationShowcaseId}
              showcases={showcases}
              onCreated={(showcaseId) => updateReply(reply.id, { destinationShowcaseId: showcaseId })}
            />
          )}

          {allowRichDestinations && error && ["IMAGE", "VIDEO", "AUDIO"].includes(reply.destinationType ?? "") && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {allowRichDestinations && ["IMAGE", "VIDEO", "AUDIO"].includes(reply.destinationType ?? "") && (
            <label className={["flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs font-semibold", uploading ? "pointer-events-none opacity-70" : ""].join(" ")}>
              {uploading ? `در حال آپلود... ${uploadProgress}٪` : reply.destinationMediaUrl ? "فایل انتخاب شده؛ برای تغییر کلیک کنید." : "فایل مقصد را انتخاب کنید"}
              <span className="text-[10px] font-normal text-muted-foreground">{reply.destinationType === "AUDIO" ? "فقط فایل صوتی (وویس)" : reply.destinationType === "VIDEO" ? "فقط فایل ویدیویی" : "فقط فایل تصویری"}</span>
              {uploading && (
                <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <Input
                type="file"
                accept={reply.destinationType === "IMAGE" ? "image/*" : reply.destinationType === "VIDEO" ? "video/*" : "audio/*"}
                className="hidden"
                disabled={uploading}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  try {
                    setError("");
                    setUploading(true);
                    setUploadProgress(0);
                    const url = await uploadBranchMedia(file, setUploadProgress);
                    onUpdateReply(reply.id, (current) => ({ ...current, destinationMediaUrl: url, destinationMediaId: "" }));
                  } catch (uploadError) {
                    setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          )}

          {allowRichDestinations && reply.destinationType === "FORM" && (
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
                instagramAccountId={instagramAccountId}
                depth={depth + 1}
                showcases={showcases}
                onChange={(children) =>
                  updateReply(reply.id, { destinationQuickReplies: children })
                }
                onUpdateReply={onUpdateReply}
                allowRichDestinations={allowRichDestinations}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
