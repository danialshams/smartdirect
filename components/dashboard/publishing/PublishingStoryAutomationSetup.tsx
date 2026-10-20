"use client";

import { Button, Select } from "@/components/dashboard/DashboardUI";
import { Check, ChevronDown, CircleCheck, ImagePlus, Loader2, Mic, RotateCcw, Video, Store, ClipboardList, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { FormItem, MessageDraft, QuickReplyDraft, Showcase } from "../automation-form-utils";
import VoiceRecorder from "../VoiceRecorder";
import { requestStorageCleanupByPublicUrl, useStorageUploadLease } from "./useStorageUploadLease";
import { createEmptyQuickReply } from "../automation-form-utils";
import StoryReplyFormEditor from "./StoryReplyFormEditor";
import StoryShowcaseSlidesEditor from "./StoryShowcaseSlidesEditor";

export type PublishingStoryAutomationSetupHandle = { saveAndContinue: () => Promise<boolean>; deleteAndReset: () => Promise<boolean> };

type Props = {
  message: MessageDraft;
  showcases: Showcase[];
  forms: FormItem[];
  formTemplates?: StoryFormTemplate[];
  loadingResources: boolean;
  instagramAccountId: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
  onSavedChange?: (saved: boolean) => void;
  keywordValid: boolean;
  onContinue: (message?: MessageDraft) => void | Promise<unknown>;
  disabled?: boolean;
  hideVideo?: boolean;
  hideForm?: boolean;
  textOnly?: boolean;
  /** New story auto-reply creator: isolate its streamlined UI from other consumers. */
  storyCreateMode?: boolean;
  extraSettings?: ReactNode;
  finalActions?: ReactNode;
  responseTypeTitle?: string;
  responseTypeDescription?: string;
  textPlaceholder?: string;
  showFinalSave?: boolean;
  finalSaveLabel?: string;
  usePublishingSaveLabel?: boolean;
  finalSaveLoadingLabel?: string;
  finalSaveDisabled?: boolean;
};

export type StoryFormTemplate = { id: string; title: string; text: string; quickReplies: QuickReplyDraft[] };
type ResponseType = "TEXT" | "AUDIO" | "SHOWCASE" | "IMAGE" | "VIDEO" | "FORM";

const options: Array<{ value: ResponseType; label: string; description: string; Icon: typeof MessageSquareText }> = [
  { value: "TEXT", label: "متن", description: "ارسال پیام متنی", Icon: MessageSquareText },
  { value: "IMAGE", label: "عکس", description: "ارسال تصویر", Icon: ImagePlus },
  { value: "VIDEO", label: "ویدیو", description: "ارسال ویدیو", Icon: Video },
  { value: "AUDIO", label: "وویس", description: "ارسال پیام صوتی", Icon: Mic },
  { value: "SHOWCASE", label: "ویترین", description: "معرفی محصولات", Icon: Store },
  { value: "FORM", label: "فرم", description: "سؤال و گزینه‌های پاسخ", Icon: ClipboardList },
];

type ShowcaseSlide = {
  id: string; title: string; description: string; imageUrl: string; previewUrl: string;
  price: string; originalPrice: string; linkUrl: string; buttonText: string; isActive: boolean;
};
type StoredShowcaseItem = {
  id?: string; title?: string; description?: string | null; imageUrl?: string | null;
  price?: string | number | null; originalPrice?: string | number | null;
  linkUrl?: string | null; buttonText?: string | null; isActive?: boolean;
};
function slideFromItem(item: StoredShowcaseItem): ShowcaseSlide {
  return {
    id: typeof item.id === "string" ? item.id : `slide_${crypto.randomUUID()}`,
    title: item.title || "", description: item.description || "",
    imageUrl: item.imageUrl || "", previewUrl: item.imageUrl || "",
    price: item.price == null ? "" : String(item.price),
    originalPrice: item.originalPrice == null ? "" : String(item.originalPrice),
    linkUrl: item.linkUrl || "", buttonText: item.buttonText || "",
    isActive: item.isActive !== false,
  };
}
function comparableSlides(slides: ShowcaseSlide[]): string {
  return JSON.stringify(slides.map(({ title, description, imageUrl, price, originalPrice, linkUrl, buttonText, isActive }) =>
    ({ title, description, imageUrl, price, originalPrice, linkUrl, buttonText, isActive })));
}
function cloneFormTree(replies: QuickReplyDraft[]): QuickReplyDraft[] {
  return replies.map((reply) => ({
    ...reply,
    id: `quick_reply_${crypto.randomUUID()}`,
    payload: `payload_${crypto.randomUUID()}`,
    nextMessageId: null,
    destinationQuickReplies: cloneFormTree(reply.destinationQuickReplies || []),
  }));
}

function createSlide(): ShowcaseSlide {
  return { id: `slide_${crypto.randomUUID()}`, title: "", description: "", imageUrl: "", previewUrl: "", price: "", originalPrice: "", linkUrl: "", buttonText: "", isActive: true };
}

const PublishingStoryAutomationSetup = forwardRef<PublishingStoryAutomationSetupHandle, Props>(function PublishingStoryAutomationSetup({ message, showcases, forms, formTemplates = [], loadingResources, instagramAccountId, onUpdate, onSavedChange, keywordValid, onContinue, disabled, hideVideo = false, hideForm = false, textOnly = false, storyCreateMode = false, extraSettings, finalActions, responseTypeTitle = "نوع پاسخ خودکار", responseTypeDescription = "نوع پاسخی را که می‌خواهید برای این محتوا ارسال شود انتخاب کنید.", textPlaceholder = "متنی که به‌عنوان پاسخ پیام شروع گفتگو برای کاربر ارسال می‌شود...", showFinalSave = false, finalSaveLabel = "ساخت پیام شروع گفتگو", usePublishingSaveLabel = false, finalSaveLoadingLabel = "در حال ساخت پیام شروع گفتگو...", finalSaveDisabled = false }: Props, ref) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [slides, setSlides] = useState<ShowcaseSlide[]>([createSlide()]);
  useStorageUploadLease([message.mediaUrl, ...slides.map((slide) => slide.imageUrl)]);
  const [savingShowcase, setSavingShowcase] = useState(false);
  const [showcaseSaved, setShowcaseSaved] = useState(Boolean(message.showcaseId));
  const [showcaseSource, setShowcaseSource] = useState<"new" | "existing">("new");
  const [selectedShowcaseId, setSelectedShowcaseId] = useState("");
  const [formSource, setFormSource] = useState<"new" | "existing">("new");
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState("");
  const newFormDraftRef = useRef<{ text: string; quickReplies: QuickReplyDraft[] } | null>(null);
  const [formSaved, setFormSaved] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formUploadsInFlight, setFormUploadsInFlight] = useState(0);
  const [finalSaving, setFinalSaving] = useState(false);
  const saveShowcaseLockRef = useRef(false);
  const [slideUploadProgress, setSlideUploadProgress] = useState<Record<string, number>>({});
  const [slideUploading, setSlideUploading] = useState<Record<string, boolean>>({});
  const [slideRetryFiles, setSlideRetryFiles] = useState<Record<string, File | null>>({});
  const unsavedDraftsRef = useRef<Partial<Record<ResponseType, Partial<MessageDraft>>>>({});
  const unsavedSlidesRef = useRef<Partial<Record<ResponseType, ShowcaseSlide[]>>>({});
  const storyShowcaseDraftRef = useRef<ShowcaseSlide[] | null>(null);
  const savedShowcaseCopyRef = useRef<{ signature: string; id: string } | null>(null);

  const responseType = (textOnly || (hideVideo && message.messageType === "VIDEO") || (hideForm && message.messageType === "FORM") ? "TEXT" : message.messageType) as ResponseType;
  const resolvedFinalSaveLabel = usePublishingSaveLabel ? `ذخیره ${responseType === "FORM" ? "فرم" : responseType === "SHOWCASE" ? "ویترین" : responseType === "TEXT" ? "متن" : responseType === "IMAGE" ? "عکس" : responseType === "VIDEO" ? "فیلم" : "وویس"} و ادامه` : finalSaveLabel;

  useEffect(() => { setShowcaseSaved(Boolean(message.showcaseId)); }, [message.showcaseId]);

  function selectType(value: ResponseType) {
    if (value === responseType) return;
    setError("");
    setFormSaved(false);
    unsavedDraftsRef.current[responseType] = { text: message.text, mediaUrl: message.mediaUrl, mediaId: message.mediaId, showcaseId: message.showcaseId, formId: message.formId, quickReplies: message.quickReplies };
    unsavedSlidesRef.current[responseType] = slides;
    const draft = unsavedDraftsRef.current[value];
    const targetSlides = unsavedSlidesRef.current[value];
    if (targetSlides) setSlides(targetSlides);
    else if (value === "SHOWCASE") setSlides([createSlide()]);
    onUpdate({
      messageType: value,
      text: draft?.text ?? "",
      mediaUrl: ["IMAGE", "VIDEO", "AUDIO"].includes(value) ? (draft?.mediaUrl ?? "") : "",
      mediaId: ["IMAGE", "VIDEO", "AUDIO"].includes(value) ? (draft?.mediaId ?? "") : "",
      showcaseId: value === "SHOWCASE" ? (draft?.showcaseId ?? "") : "",
      formId: value === "FORM" ? (draft?.formId ?? "") : "",
      quickReplies: value === "FORM" ? (draft?.quickReplies ?? (storyCreateMode ? [createEmptyQuickReply(), createEmptyQuickReply()] : [])) : [],
    });
  }

  async function uploadMedia(file?: File): Promise<boolean> {
    if (!file) return false;
    setError("");
    setUploading(true);
    setProgress(0);
    setRetryFile(file);

    const uploadSucceeded = await new Promise<boolean>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      xhr.open("POST", "/api/instagram/publishing/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error("آپلود فایل ناموفق بود."));
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300 || !result?.success || typeof result?.data?.publicUrl !== "string") {
            reject(new Error(result?.message || "آپلود فایل ناموفق بود."));
            return;
          }
          setProgress(100);
          if (message.mediaUrl && message.mediaUrl !== result.data.publicUrl) {
            void requestStorageCleanupByPublicUrl(message.mediaUrl).catch(() => undefined);
          }
          onUpdate({ mediaUrl: result.data.publicUrl, mediaId: "" });
          setRetryFile(null);
          resolve(true);
        } catch {
          reject(new Error("پاسخ نامعتبر از سرور دریافت شد."));
        }
      };
      xhr.send(formData);
    }).catch((uploadError) => {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
      return false;
    }).finally(() => setUploading(false));
    return uploadSucceeded;
  }

  useEffect(() => {
    // The story editor handles source selection explicitly. The legacy
    // publishing editors still hydrate their selected showcase from props.
    if (storyCreateMode) return;
    const existing = showcases.find((item) => item.id === message.showcaseId);
    if (Array.isArray(existing?.items) && existing.items.length > 0) {
      setSlides((existing.items as StoredShowcaseItem[]).map(slideFromItem));
    }
  }, [message.showcaseId, showcases, storyCreateMode]);

  function patchSlide(id: string, patch: Partial<ShowcaseSlide>) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...patch } : slide));
  }

  async function uploadSlideImage(id: string, file?: File) {
    if (!file) return;
    setError("");
    setSlideRetryFiles((current) => ({ ...current, [id]: file }));
    setSlideUploadProgress((current) => ({ ...current, [id]: 0 }));
    setSlideUploading((current) => ({ ...current, [id]: true }));
    // Keep the previous image usable if replacement upload fails.
    const previousImageUrl = slides.find((slide) => slide.id === id)?.imageUrl;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const data = new FormData();
      data.append("file", file);
      xhr.open("POST", "/api/instagram/publishing/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setSlideUploadProgress((current) => ({ ...current, [id]: Math.round((event.loaded / event.total) * 100) }));
        }
      };
      xhr.onerror = () => reject(new Error("آپلود تصویر ناموفق بود."));
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300 || !result?.success || typeof result?.data?.publicUrl !== "string") {
            reject(new Error(result?.message || "آپلود تصویر ناموفق بود."));
            return;
          }
          setSlideUploadProgress((current) => ({ ...current, [id]: 100 }));
          patchSlide(id, { imageUrl: result.data.publicUrl, previewUrl: result.data.publicUrl });
          if (previousImageUrl && previousImageUrl !== result.data.publicUrl)
            releaseDraftImage(previousImageUrl);
          setSlideRetryFiles((current) => ({ ...current, [id]: null }));
          resolve();
        } catch {
          reject(new Error("پاسخ نامعتبر از سرور دریافت شد."));
        }
      };
      xhr.send(data);
    }).catch((uploadError) => {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود تصویر ناموفق بود.");
    }).finally(() => {
      setSlideUploading((current) => ({ ...current, [id]: false }));
    });
  }

  const MAX_SHOWCASE_ITEMS = 10;
  const hasValidSlide = slides.length > 0 && slides.every((slide) => slide.imageUrl.trim() && slide.title.trim() && slide.description.trim());
  const completedSlides = slides.filter((slide) => slide.imageUrl.trim() && slide.title.trim() && slide.description.trim()).length;
  const slideUploadInProgress = Object.values(slideUploading).some(Boolean);
  const selectedShowcase = showcases.find((item) => item.id === (storyCreateMode ? selectedShowcaseId : message.showcaseId));
  const originalSlides = selectedShowcase && Array.isArray(selectedShowcase.items)
    ? (selectedShowcase.items as StoredShowcaseItem[]).map(slideFromItem) : [];
  const existingShowcaseEdited = Boolean(storyCreateMode && showcaseSource === "existing" && selectedShowcase &&
    comparableSlides(slides) !== comparableSlides(originalSlides));
  const storyShowcaseReady = storyCreateMode && showcaseSource === "existing"
    ? Boolean(selectedShowcase && slides.length > 0 && (existingShowcaseEdited ? hasValidSlide : true))
    : (Boolean(message.showcaseId) || hasValidSlide);
  function releaseDraftImage(url: string) {
    if (!url) return;
    // Editing an existing card must not delete images referenced by its
    // original showcase or by other automations.
    if (originalSlides.some((item) => item.imageUrl === url)) return;
    void requestStorageCleanupByPublicUrl(url).catch(() => undefined);
  }

  async function deleteShowcase() {
    if (!message.showcaseId) return;
    setSavingShowcase(true);
    setError("");
    try {
      const response = await fetch(`/api/showcases/${message.showcaseId}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "حذف ویترین ناموفق بود.");
      onUpdate({ showcaseId: "" });
      setShowcaseSaved(false);
      setSlides([createSlide()]);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "حذف ویترین ناموفق بود.");
    } finally {
      setSavingShowcase(false);
    }
  }

  async function saveShowcase(): Promise<string | null> {
    const signature = comparableSlides(slides);
    if (storyCreateMode && savedShowcaseCopyRef.current?.signature === signature)
      return savedShowcaseCopyRef.current.id;
    if (saveShowcaseLockRef.current || savingShowcase || slideUploadInProgress) return null;
    saveShowcaseLockRef.current = true;
    if (!hasValidSlide) {
      setError("برای ساخت ویترین، حداقل یک اسلاید کامل با تصویر، تیتر و توضیحات بسازید.");
      saveShowcaseLockRef.current = false;
      return null;
    }
    if (!instagramAccountId) { setError("اکانت فعال Instagram پیدا نشد."); saveShowcaseLockRef.current = false; return null; }
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      if (!slide?.imageUrl.trim()) { setError(`تصویر اسلاید ${index + 1} را آپلود کنید.`); saveShowcaseLockRef.current = false; return null; }
      if (!slide.title.trim()) { setError(`تیتر اسلاید ${index + 1} را وارد کنید.`); saveShowcaseLockRef.current = false; return null; }
    }
    setSavingShowcase(true);
    setError("");
    let createdShowcaseId: string | null = null;
    try {
      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId,
          title: existingShowcaseEdited && selectedShowcase
            ? `کپی ویرایش‌شدهٔ ${selectedShowcase.title}`
            : `ویترین ${new Date().toLocaleDateString("fa-IR")}`,
          description: existingShowcaseEdited ? selectedShowcase?.description || null : null,
          isActive: true,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;
      if (typeof created?.id !== "string") throw new Error("شناسه ویترین ساخته‌شده نامعتبر است.");
      createdShowcaseId = created.id;
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index];
        const itemResponse = await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: slide.title.trim(), description: slide.description.trim() || null,
            imageUrl: slide.imageUrl.trim(), order: index, isActive: slide.isActive,
            price: slide.price || null, originalPrice: slide.originalPrice || null,
            linkUrl: slide.linkUrl.trim() || null, buttonText: slide.buttonText.trim() || null,
          }),
        });
        const itemResult = await itemResponse.json().catch(() => null);
        if (!itemResponse.ok || itemResult?.error) throw new Error(itemResult?.error || itemResult?.message || `ساخت اسلاید ${index + 1} ناموفق بود.`);
      }
      setSlides((current) => current.map((slide) => ({ ...slide })));
      savedShowcaseCopyRef.current = { signature, id: created.id };
      onUpdate({ showcaseId: created.id });
      setShowcaseSaved(true);
      return created.id as string;
    } catch (saveError) {
      if (createdShowcaseId) {
        try {
          const cleanupResponse = await fetch(`/api/showcases/${createdShowcaseId}`, { method: "DELETE" });
          if (!cleanupResponse.ok) console.warn("Incomplete showcase cleanup failed:", cleanupResponse.status);
        } catch (cleanupError) {
          console.warn("Incomplete showcase cleanup failed:", cleanupError);
        }
      }
      setError(saveError instanceof Error ? saveError.message : "ساخت ویترین ناموفق بود.");
      return null;
    } finally {
      saveShowcaseLockRef.current = false;
      setSavingShowcase(false);
    }
  }

  useImperativeHandle(ref, () => ({
    async saveAndContinue() {
      if (!keywordValid || uploading || slideUploadInProgress || formUploadsInFlight > 0 || savingShowcase || formSaving) return false;
      if (responseType === "TEXT") {
        if (!message.text.trim()) return false;
        onUpdate({ text: message.text.trim() });
      }
      if (["IMAGE", "VIDEO", "AUDIO"].includes(responseType) && !message.mediaUrl) return false;
      if (responseType === "SHOWCASE" &&
          (!message.showcaseId || (storyCreateMode && showcaseSource === "existing" && existingShowcaseEdited))) {
        const ok = await saveShowcase();
        if (!ok) return false;
      }
      if (responseType === "FORM") {
        if (!isValidStoryForm(message.text, message.quickReplies)) return false;
        setFormSaving(true);
        onUpdate({ text: message.text.trim(), quickReplies: message.quickReplies });
        setFormSaved(true);
        setFormSaving(false);
      }
      unsavedDraftsRef.current = {};
      unsavedSlidesRef.current = {};
      onSavedChange?.(true);
      onContinue();
      return true;
    },
    async deleteAndReset() {
      if (savingShowcase || formSaving || uploading || slideUploadInProgress || formUploadsInFlight > 0) return false;
      setError("");
      try {
        if (message.showcaseId) {
          const response = await fetch(`/api/showcases/${message.showcaseId}`, { method: "DELETE" });
          const result = await response.json().catch(() => null);
          if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "حذف ویترین ناموفق بود.");
        }
        unsavedDraftsRef.current = {};
        unsavedSlidesRef.current = {};
        onUpdate({ messageType: "TEXT", text: "", mediaUrl: "", mediaId: "", showcaseId: "", formId: "", quickReplies: [] });
        setShowcaseSaved(false);
        setFormSaved(false);
        setSlides([createSlide()]);
        onSavedChange?.(false);
        return true;
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "حذف پاسخ ناموفق بود.");
        return false;
      }
    },
  }), [keywordValid, uploading, slideUploadInProgress, formUploadsInFlight, savingShowcase, formSaving, responseType, message, showcaseSaved, onUpdate, onContinue, onSavedChange]);

  async function uploadFormMedia(file?: File): Promise<string> {
    if (!file) return "";
    setFormUploadsInFlight((value) => value + 1);
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || typeof result?.data?.publicUrl !== "string")
        throw new Error(result?.message || "آپلود فایل ناموفق بود.");
      return result.data.publicUrl as string;
    } finally {
      setFormUploadsInFlight((value) => Math.max(0, value - 1));
    }
  }

  const mediaAccept =
    responseType === "IMAGE" ? "image/*" :
    responseType === "VIDEO" ? "video/*" :
    "audio/*";

  return (
    <div className={["space-y-5", disabled ? "pointer-events-none opacity-60" : ""].join(" ")}>
      {!textOnly && (
        <>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">{responseTypeTitle}</p>
            {responseTypeDescription && <p className="mt-1 text-[11px] leading-5 text-[#64748B]">{responseTypeDescription}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="group" aria-label={storyCreateMode ? "انتخاب نوع پاسخ استوری" : "انتخاب نوع پاسخ"}>
            {options.filter(({ value }) => !((hideVideo && value === "VIDEO") || (hideForm && value === "FORM"))).map(({ value, label, Icon }) => {
              const active = responseType === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectType(value)}
                  className={[
                    "sd-neutral-button group flex min-h-[64px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30",
                    active ? "border-[#2563EB] bg-[#EFF6FF] ring-1 ring-[#2563EB]/15" : "border-[#E2E8F0] bg-white hover:border-[#93B5FC] hover:bg-[#F8FAFC]",
                  ].join(" ")}
                >
                  <span className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#475569]"].join(" ")}>
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={["block text-[13px] font-bold", active ? "text-[#1D4ED8]" : "text-[#0F172A]"].join(" ")}>{label}</span>
                  </span>
                  <span aria-hidden="true" className={["flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border", active ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#CBD5E1] bg-white"].join(" ")}>
                    {active && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {responseType === "TEXT" && (
        <div>
          <label className="mb-2 block text-sm font-bold text-[#0F172A]">متن پاسخ</label>
          <textarea
            value={message.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            rows={5}
            maxLength={2000}
            inputMode="text"
            autoCapitalize="sentences"
            spellCheck
            className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none placeholder:text-[11px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
            placeholder={textPlaceholder}
            style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}
          />
        </div>
      )}

      {(responseType === "IMAGE" || responseType === "VIDEO" || responseType === "AUDIO") && (
        <div className="space-y-3">
          <label className="block text-sm font-bold text-[#0F172A]">
            {responseType === "IMAGE" ? "آپلود عکس" : responseType === "VIDEO" ? "آپلود ویدیو" : "آپلود وویس"}
          </label>
          {message.mediaUrl && !uploading ? (
            <div className="space-y-2">
              <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-white text-center transition hover:border-[#93C5FD] hover:bg-[#EFF6FF]">
                {responseType === "IMAGE" ? <img src={message.mediaUrl} alt="" className="h-56 w-full object-cover" /> : responseType === "VIDEO" ? <video src={message.mediaUrl} controls className="max-h-64 w-full bg-black object-contain" /> : <div className="w-full px-3 py-4"><audio src={message.mediaUrl} controls className="w-full" /></div>}
                <input type="file" accept={mediaAccept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadMedia(file); }} />
              </label>
              <div className="flex justify-center"><button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(message.mediaUrl).catch(() => undefined); onUpdate({ mediaUrl: "", mediaId: "" }); }} className="sd-destructive-button text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C]">حذف {responseType === "IMAGE" ? "عکس" : responseType === "VIDEO" ? "ویدیو" : "وویس"}</button></div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={["flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-[#F8FAFC] px-4 text-center transition", uploading ? "pointer-events-none opacity-60" : "hover:border-[#93C5FD] hover:bg-[#EFF6FF]"].join(" ")}>
                {uploading ? (
                  <div className="flex w-full flex-col items-center justify-center px-6">
                    <div className="mb-2 text-[10px] font-semibold text-[#2563EB]">{progress}٪</div>
                    <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#E2E8F0]"><div className="h-full rounded-full bg-[#2563EB] transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>
                  </div>
                ) : (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">{responseType === "IMAGE" ? <ImagePlus size={21}/> : responseType === "VIDEO" ? <Video size={21}/> : <Mic size={21}/>}</span>
                    <span className="mt-3 text-xs font-bold text-[#0F172A]">انتخاب فایل از دستگاه</span>
                    <span className="mt-1 text-[10px] text-[#64748B]">فایل را از دستگاه انتخاب کن</span>
                  </>
                )}
                <input type="file" accept={mediaAccept} disabled={uploading} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadMedia(file); }} />
              </label>
              {retryFile && !uploading && error && <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3"><div className="flex items-center justify-between text-[11px] font-bold text-[#B91C1C]"><span>آپلود ناموفق بود</span><span>{progress}٪</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#FEE2E2]"><div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${Math.max(3, progress)}%` }} /></div><button type="button" onClick={() => void uploadMedia(retryFile)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-3 py-2 text-[11px] font-bold text-white"><RotateCcw size={14}/>تلاش دوباره</button></div>}
{responseType === "AUDIO" && (
                <>
                  <div className="text-center text-[10px] font-semibold text-[#94A3B8]">یا</div>
                  <VoiceRecorder disabled={uploading} onRecorded={uploadMedia} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {responseType === "SHOWCASE" && (
        storyCreateMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1" role="group" aria-label="روش انتخاب ویترین">
                {(["new", "existing"] as const).map((value) => (
                  <button key={value} type="button" aria-pressed={showcaseSource === value}
                    onClick={() => {
                      if (value === showcaseSource) return;
                      if (value === "existing") storyShowcaseDraftRef.current = slides;
                      if (value === "new") {
                        setSlides(storyShowcaseDraftRef.current || [createSlide()]);
                        onUpdate({ showcaseId: "" });
                      }
                      setShowcaseSource(value);
                    }}
                    className={["sd-neutral-button min-h-10 rounded-lg px-2 text-xs font-bold transition", showcaseSource === value ? "bg-white text-[#1D4ED8] shadow-sm" : "bg-transparent text-[#64748B] hover:text-[#0F172A]"].join(" ")}>
                    {value === "new" ? "ساخت ویترین جدید" : "استفاده از ویترین‌های قبلی"}
                  </button>
                ))}
            </div>
            {showcaseSource === "existing" && (
              <div className="space-y-2">
                <select id="story-existing-showcase" aria-label="انتخاب ویترین قبلی" value={selectedShowcaseId} disabled={loadingResources}
                  onChange={(event) => {
                    const id = event.target.value;
                    setSelectedShowcaseId(id);
                    const chosen = showcases.find((item) => item.id === id);
                    setSlides(chosen && Array.isArray(chosen.items)
                      ? (chosen.items as StoredShowcaseItem[]).map(slideFromItem) : []);
                    onUpdate({ showcaseId: id });
                    setError("");
                  }}
                  className="w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]">
                  <option value="">یک ویترین انتخاب کن</option>
                  {showcases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                {!loadingResources && showcases.length === 0 && <p className="text-xs text-[#64748B]">هنوز ویترینی نداری.</p>}
                {existingShowcaseEdited && <p className="text-xs text-[#64748B]">تغییرات در یک نسخهٔ جدید ذخیره می‌شوند.</p>}
              </div>
            )}
            {(showcaseSource === "new" || selectedShowcase) && (
              <StoryShowcaseSlidesEditor
                slides={slides}
                completed={completedSlides}
                maxSlides={MAX_SHOWCASE_ITEMS}
                uploading={slideUploading}
                uploadProgress={slideUploadProgress}
                retryFiles={slideRetryFiles}
                disabled={savingShowcase || Boolean(disabled)}
                onPatch={patchSlide}
                onRemove={(id) => {
                  const existing = slides.find((item) => item.id === id);
                  if (existing) releaseDraftImage(existing.imageUrl);
                  setSlides((current) => current.filter((item) => item.id !== id));
                }}
                onAdd={() => setSlides((current) => current.length < MAX_SHOWCASE_ITEMS ? [...current, createSlide()] : current)}
                onUpload={(id, file) => { void uploadSlideImage(id, file); }}
              />
            )}
          </div>
        ) : (
          <div className={["space-y-5 transition-opacity duration-200", showcaseSaved ? "opacity-55" : ""].join(" ")}>
            <div>
              <p className="text-sm font-bold text-[#0F172A]">ویترین</p>
              <p className="mt-1 text-[11px] leading-5 text-[#64748B]">اسلایدهای ویترین را با تصویر، تیتر و توضیحات بساز.</p>
            </div>
            <div className="space-y-4">
              {slides.map((slide, index) => (
                <div key={slide.id} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
                  <p className="text-center text-lg font-extrabold text-[#0F172A]">اسلاید {index + 1}</p>
                  <label className="relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center hover:border-[#93C5FD] hover:bg-[#EFF6FF]">
                    {slideUploading[slide.id] ? (
                      <div className="flex w-full flex-col items-center justify-center px-6">
                        <div className="mb-2 text-[10px] font-semibold text-[#2563EB]">
                          {slideUploadProgress[slide.id] ?? 0}٪
                        </div>
                        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#E2E8F0]">
                          <div className="h-full rounded-full bg-[#2563EB] transition-[width] duration-150 ease-out" style={{ width: `${slideUploadProgress[slide.id] ?? 0}%` }} />
                        </div>
                      </div>
                    ) : slide.previewUrl ? (
                      <img src={slide.previewUrl} alt="" className="h-44 w-full object-cover" />
                    ) : slideRetryFiles[slide.id] ? (
                      <div className="flex w-full flex-col items-center justify-center px-6">
                        <span className="mb-2 text-[10px] font-bold text-[#B91C1C]">آپلود ناموفق بود — {slideUploadProgress[slide.id] ?? 0}٪</span>
                        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#FEE2E2]"><div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${Math.max(3, Math.min(100, slideUploadProgress[slide.id] ?? 0))}%` }} /></div>
                        <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void uploadSlideImage(slide.id, slideRetryFiles[slide.id] ?? undefined); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-2 text-[11px] font-bold text-white">
                          <RotateCcw size={14}/>تلاش دوباره
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><ImagePlus size={21}/></span>
                        <span className="mt-3 text-xs font-bold text-[#0F172A]">آپلود عکس اسلاید {index + 1}</span>
                        <span className="mt-1 text-[10px] text-[#64748B]">برای انتخاب تصویر کلیک کن</span>
                      </>
                    )}
                    <input type="file" accept="image/*" disabled={slideUploading[slide.id] || savingShowcase || Boolean(message.showcaseId)} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadSlideImage(slide.id, file); }} />
                  </label>
                  {slide.previewUrl && !slideUploading[slide.id] && (
                    <div className="flex justify-center">
                      <button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(slide.imageUrl).catch(() => undefined); patchSlide(slide.id, { imageUrl: "", previewUrl: "" }); }} className="sd-destructive-button text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C]">
                        حذف عکس
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#0F172A]">تیتر اسلاید {index + 1}</label>
                    <input value={slide.title} onChange={(event) => patchSlide(slide.id, { title: event.target.value })} placeholder="تیتر اسلاید را وارد کن..." className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[#0F172A]">توضیحات اسلاید {index + 1}</label>
                    <textarea value={slide.description} onChange={(event) => patchSlide(slide.id, { description: event.target.value })} rows={4} maxLength={1000} placeholder="توضیحات اسلاید را وارد کن..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                  </div>
                  {!message.showcaseId && slides.length > 1 && (
                    <div className="text-center">
                      <button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(slide.imageUrl).catch(() => undefined); setSlides((current) => current.filter((item) => item.id !== slide.id)); }} className="sd-destructive-button text-xs font-semibold text-[#DC2626] transition hover:text-[#B91C1C]">
                        حذف اسلاید
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-1">
              {!message.showcaseId && slides.length < MAX_SHOWCASE_ITEMS && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (slides.length >= MAX_SHOWCASE_ITEMS) return;
                      setSlides((current) => current.length >= MAX_SHOWCASE_ITEMS ? current : [...current, createSlide()]);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[#2563EB] transition hover:text-[#1D4ED8]"
                    dir="ltr"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span dir="rtl">افزودن اسلاید</span>
                  </button>
                </div>
              )}
  
              {message.showcaseId && (
                <div className="space-y-2">
                  <p className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs font-semibold text-[#166534]">
                    ویترین ساخته شد و با پاسخ متصل شد.
                  </p>
                  <button
                    type="button"
                    disabled={savingShowcase}
                    onClick={() => void deleteShowcase()}
                    className="sd-destructive-button text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C] disabled:opacity-50"
                  >
                    حذف ویترین
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {responseType === "FORM" && (
        <div className={["space-y-4 transition-opacity duration-200", formSaved ? "opacity-55" : ""].join(" ")}>
        {storyCreateMode ? (
          <div className="space-y-4">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1" role="group" aria-label="ساخت یا استفاده مجدد از فرم">
                  {(["new", "existing"] as const).map((value) => (
                    <button key={value} type="button" aria-pressed={formSource === value}
                      onClick={() => {
                        if (value === formSource) return;
                        if (value === "existing") newFormDraftRef.current = {
                          text: message.text, quickReplies: message.quickReplies,
                        };
                        if (value === "new") {
                          const restored = newFormDraftRef.current;
                          onUpdate({
                            text: restored?.text ?? "",
                            quickReplies: restored?.quickReplies ?? [createEmptyQuickReply(), createEmptyQuickReply()],
                            formId: "",
                          });
                        } else {
                          onUpdate({ text: "", quickReplies: [createEmptyQuickReply(), createEmptyQuickReply()], formId: "" });
                        }
                        setFormSource(value);
                        setSelectedFormTemplateId("");
                        setFormSaved(false);
                      }}
                      className={["sd-neutral-button min-h-10 rounded-lg px-2 text-xs font-bold transition", formSource === value ? "bg-white text-[#1D4ED8] shadow-sm" : "bg-transparent text-[#64748B] hover:text-[#0F172A]"].join(" ")}>
                      {value === "new" ? "فرم جدید" : "استفاده از فرم‌های قبلی"}
                    </button>
                  ))}
                </div>
                {formSource === "existing" && (
                  <div className="space-y-2">
                    <select id="story-previous-form" aria-label="انتخاب فرم قبلی" value={selectedFormTemplateId}
                      onChange={(event) => {
                        const id = event.target.value;
                        const template = formTemplates.find((item) => item.id === id);
                        setSelectedFormTemplateId(id);
                        onUpdate({
                          text: template?.text || "",
                          quickReplies: template ? cloneFormTree(template.quickReplies) : [createEmptyQuickReply(), createEmptyQuickReply()],
                          formId: "",
                        });
                        setFormSaved(false);
                      }}
                      className="w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-base text-[#0F172A] outline-none focus:border-[#2563EB]">
                      <option value="">یک فرم قبلی را انتخاب کن</option>
                      {formTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                    {!loadingResources && formTemplates.length === 0 && <p className="text-xs text-[#64748B]">هنوز فرم ذخیره‌شده‌ای نداری.</p>}
                    {selectedFormTemplateId && <p className="text-xs text-[#64748B]">فرم قبلی بدون تغییر می‌ماند.</p>}
                  </div>
                )}
              </div>
            {(formSource === "new" || selectedFormTemplateId) && (
              <StoryReplyFormEditor
                message={message}
                instagramAccountId={instagramAccountId}
                showcases={showcases}
                loadingResources={loadingResources}
                onUpdate={onUpdate}
                onUploadMedia={uploadFormMedia}
              />
            )}
          </div>
        ) : (
          <StoryFormBuilder
            message={message}
            showcases={showcases}
            forms={forms}
            loadingResources={loadingResources}
            hideVideo={hideVideo}
            hideForm={hideForm}
            onUpdate={onUpdate}
            onUploadMedia={uploadFormMedia}
          />
        )}
        <div className="space-y-2 pt-2">
          {formSaved && <div className="space-y-2"><p className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs font-semibold text-[#166534]">فرم ذخیره شده است.</p><button type="button" onClick={() => { setFormSaved(false); onUpdate({ text: "", quickReplies: [] }); }} className="sd-destructive-button text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C]">حذف فرم</button></div>}
        </div>
        </div>
      )}

      {extraSettings}

      {showFinalSave && (
        <div className={finalActions ? "space-y-3 border-t border-[#E2E8F0] pt-4" : usePublishingSaveLabel ? "border-t border-[#E2E8F0] pt-4" : ""}>
        <button
          type="button"
          disabled={disabled || finalSaveDisabled || finalSaving || !keywordValid || uploading || slideUploadInProgress || formUploadsInFlight > 0 || savingShowcase || formSaving ||
            (responseType === "TEXT" && !message.text.trim()) ||
            (["IMAGE", "VIDEO", "AUDIO"].includes(responseType) && !message.mediaUrl.trim()) ||
            (responseType === "SHOWCASE" && !storyShowcaseReady) ||
            (responseType === "FORM" && !isValidStoryForm(message.text, message.quickReplies))}
          onClick={async () => {
            setError("");
            setFinalSaving(true);
            try {
              let messageToSave: MessageDraft = {
                ...message,
                text: message.text.trim(),
              };

              if (responseType === "SHOWCASE" &&
                (!message.showcaseId || (storyCreateMode && showcaseSource === "existing" && existingShowcaseEdited))) {
                const showcaseId = await saveShowcase();
                if (!showcaseId) return;
                messageToSave = { ...messageToSave, showcaseId };
              }

              onUpdate(messageToSave);
              await onContinue(messageToSave);
            } finally {
              setFinalSaving(false);
            }
          }}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {finalSaving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={17} className="animate-spin" />
              {finalSaveLoadingLabel}
            </span>
          ) : (
            resolvedFinalSaveLabel
          )}
        </button>
        {finalActions}
        </div>
      )}

      {error && <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#B91C1C]">{error}</p>}
    </div>
  );
});

export default PublishingStoryAutomationSetup;

type StoryFormBuilderProps = { message: MessageDraft; showcases: Showcase[]; forms: FormItem[]; loadingResources: boolean; hideVideo?: boolean; hideForm?: boolean; onUpdate: (patch: Partial<MessageDraft>) => void; onUploadMedia: (file?: File) => Promise<string>; };
const FORM_MAX_OPTIONS = 13;
const FORM_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
function isValidStoryForm(question: string, replies: QuickReplyDraft[]): boolean { const options = replies.filter((reply) => !reply.isExit); return Boolean(question.trim()) && options.length >= 2 && options.every((reply) => Boolean(reply.title.trim()) && Boolean(reply.destinationType) && (reply.destinationType !== "TEXT" || Boolean(reply.destinationText.trim())) && (reply.destinationType !== "SHOWCASE" || Boolean(reply.destinationShowcaseId)) && (!FORM_MEDIA_TYPES.includes(reply.destinationType as typeof FORM_MEDIA_TYPES[number]) || Boolean(reply.destinationMediaUrl)) && (reply.destinationType !== "FORM" || isValidStoryForm(reply.destinationQuestion, reply.destinationQuickReplies))); }

function StoryFormBuilder({ message, showcases, forms, loadingResources, hideVideo = false, hideForm = false, onUpdate, onUploadMedia }: StoryFormBuilderProps) {
  return <FormBranchEditor title="فرم" question={message.text} replies={message.quickReplies} showcases={showcases} forms={forms} loadingResources={loadingResources}
    onChange={(patch) => { onUpdate({ ...(patch.question !== undefined ? { text: patch.question } : {}), ...(patch.replies !== undefined ? { quickReplies: patch.replies } : {}) }); }}
    onUploadMedia={onUploadMedia} hideVideo={hideVideo} hideForm={hideForm} />;
}

type BranchProps = { title: string; question: string; replies: QuickReplyDraft[]; showcases: Showcase[]; forms: FormItem[]; loadingResources: boolean; onChange: (patch: { question?: string; replies?: QuickReplyDraft[] }) => void; onUploadMedia: (file?: File) => Promise<string>; level?: number; hideVideo?: boolean; hideForm?: boolean; };

function FormBranchEditor({ title, question, replies, showcases, forms, loadingResources, onChange, onUploadMedia, level = 0, hideVideo = false, hideForm = false }: BranchProps) {
  const optionReplies = replies.filter((reply) => !reply.isExit);
  const updateReply = (id: string, patch: Partial<QuickReplyDraft>) => onChange({ replies: replies.map((reply) => reply.id === id ? { ...reply, ...patch } : reply) });
  const removeReply = (id: string) => onChange({ replies: replies.filter((reply) => reply.id !== id) });
  const addReply = () => {
    if (replies.length < FORM_MAX_OPTIONS) onChange({ replies: [...replies, createEmptyQuickReply()] });
  };

  return (
    <div className={["space-y-4", level > 0 ? "rounded-2xl border border-[#DBEAFE] bg-[#F8FAFC] p-3.5" : ""].join(" ")}>
      <div>
        <p className="text-right text-lg font-extrabold text-[#0F172A]">{level > 0 ? "فرم مقصد" : "فرم"}</p>
        <p className="mt-1 text-[11px] leading-5 text-[#64748B]">متن ورودی فرم را بنویس و برای هر گزینه مشخص کن کاربر به کدام پاسخ هدایت شود.</p>
      </div>

      <div>
        <label className="mb-2 block text-center text-lg font-extrabold text-[#0F172A]">متن ورودی</label>
        <textarea value={question} onChange={(e) => onChange({ question: e.target.value })} rows={4} maxLength={2000} placeholder="متن اولیه فرم را وارد کن..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{fontSize:"16px",lineHeight:1.75,WebkitTextSizeAdjust:"100%"}} />
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-right">
            <p className="text-right text-lg font-extrabold text-[#0F172A]">گزینه‌ها</p>
            <p className="mt-1 text-right text-[10px] text-[#64748B]">حداکثر ۱۳ گزینه در هر مرحله.</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#2563EB]">{optionReplies.length} / {FORM_MAX_OPTIONS - (replies.some((reply) => reply.isExit) ? 1 : 0)}</span>
        </div>

        <div className="mt-3 space-y-3">
          {optionReplies.map((reply, index) => (
            <FormOptionEditor key={reply.id} reply={reply} index={index} showcases={showcases} forms={forms} loadingResources={loadingResources} hideVideo={hideVideo} hideForm={hideForm} onChange={(patch) => updateReply(reply.id, patch)} onRemove={() => removeReply(reply.id)} onUploadMedia={onUploadMedia} />
          ))}
        </div>

        <button type="button" disabled={optionReplies.length >= FORM_MAX_OPTIONS} onClick={addReply} className="mx-auto mt-3 flex items-center justify-center gap-2 text-sm font-bold text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40">
          <span>افزودن گزینه</span><Plus size={16} strokeWidth={2.5}/>
        </button>
      </div>
    </div>
  );
}
function FormOptionEditor({ reply, index, showcases, forms, loadingResources, hideVideo = false, hideForm = false, onChange, onRemove, onUploadMedia }: { reply: QuickReplyDraft; index: number; showcases: Showcase[]; forms: FormItem[]; loadingResources: boolean; hideVideo?: boolean; hideForm?: boolean; onChange: (patch: Partial<QuickReplyDraft>) => void; onRemove: () => void; onUploadMedia: (file?: File) => Promise<string>; }) {
  const [uploading, setUploading] = useState(false);
  useStorageUploadLease([reply.destinationMediaUrl]);
  const destinationType = reply.destinationType;
  async function upload(type: typeof FORM_MEDIA_TYPES[number], file?: File) { if (!file) return; setUploading(true); try { const url = await onUploadMedia(file); if (reply.destinationMediaUrl && reply.destinationMediaUrl !== url) void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined); onChange({destinationType:type,destinationMediaUrl:url,destinationMediaId:""}); } finally { setUploading(false); } }
  function selectDestination(value: QuickReplyDraft["destinationType"]) { if (reply.destinationMediaUrl && !FORM_MEDIA_TYPES.includes(value as typeof FORM_MEDIA_TYPES[number])) void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined); onChange({destinationType:value,destinationText:value==="TEXT"?reply.destinationText:"",destinationFormId:value==="FORM"?reply.destinationFormId:"",destinationShowcaseId:value==="SHOWCASE"?reply.destinationShowcaseId:"",destinationMediaUrl:FORM_MEDIA_TYPES.includes(value as typeof FORM_MEDIA_TYPES[number])?reply.destinationMediaUrl:"",destinationMediaId:FORM_MEDIA_TYPES.includes(value as typeof FORM_MEDIA_TYPES[number])?reply.destinationMediaId:"",destinationQuestion:value==="FORM"?reply.destinationQuestion:"",destinationQuickReplies:value==="FORM"?(reply.destinationQuickReplies.length?reply.destinationQuickReplies:[createEmptyQuickReply()]):[]}); }
  return <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5">
    <div className="relative flex items-center justify-center"><p className="text-center text-lg font-extrabold text-[#0F172A]">گزینه {index+1}</p><button type="button" onClick={onRemove} className="sd-destructive-button absolute left-0 text-[11px] font-bold text-[#DC2626]">حذف</button></div>
    <input value={reply.title} maxLength={20} onChange={(e)=>onChange({title:e.target.value})} placeholder="نام گزینه را وارد کن..." className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{fontSize:"16px",WebkitTextSizeAdjust:"100%"}} />
    <div><label className="mb-2 block text-xs font-bold text-[#0F172A]">کاربر هدایت شود به:</label><Select value={destinationType ?? ""} onChange={(e)=>selectDestination((e.target.value||null) as QuickReplyDraft["destinationType"])} className="!w-full [&_.MuiSelect-select]:!py-3.5 [&_.MuiSelect-select]:!text-base [&_.MuiNativeSelect-icon]:!top-1/2 [&_.MuiNativeSelect-icon]:!-translate-y-1/2"><option value="">انتخاب مقصد</option><option value="TEXT">متن</option><option value="AUDIO">وویس</option><option value="IMAGE">عکس</option>{!hideVideo && <option value="VIDEO">فیلم</option>}<option value="SHOWCASE">ویترین</option>{!hideForm && <option value="FORM">فرم جدید</option>}</Select></div>
    {destinationType==="TEXT" && <textarea value={reply.destinationText} onChange={(e)=>onChange({destinationText:e.target.value})} rows={4} maxLength={2000} placeholder="متن پاسخ این گزینه..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{fontSize:"16px",lineHeight:1.75,WebkitTextSizeAdjust:"100%"}} />}
    {destinationType==="SHOWCASE" && <Select value={reply.destinationShowcaseId} disabled={loadingResources} onChange={(e)=>onChange({destinationShowcaseId:e.target.value})} className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm outline-none"><option value="">{loadingResources?"در حال دریافت ویترین‌ها...":"ویترین را انتخاب کن"}</option>{showcases.map((s)=><option key={s.id} value={s.id}>{s.title}</option>)}</Select>}
    {destinationType==="FORM" && !hideForm && <FormBranchEditor title="فرم مقصد" question={reply.destinationQuestion} replies={reply.destinationQuickReplies} showcases={showcases} forms={forms} loadingResources={loadingResources} onChange={(patch)=>onChange({...(patch.question!==undefined?{destinationQuestion:patch.question}:{}),...(patch.replies!==undefined?{destinationQuickReplies:patch.replies}:{})})} onUploadMedia={onUploadMedia} level={1} hideVideo={hideVideo} hideForm={hideForm} />}
    {FORM_MEDIA_TYPES.includes(destinationType as typeof FORM_MEDIA_TYPES[number]) && (
      <>
        <label className={["flex min-h-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-[#F8FAFC] text-center",uploading?"pointer-events-none opacity-60":"hover:border-[#93C5FD] hover:bg-[#EFF6FF]"].join(" ")}>
          <span className="text-xs font-bold text-[#2563EB]">{uploading?"در حال آپلود...":reply.destinationMediaUrl?"تعویض فایل":"انتخاب فایل از دستگاه"}</span>
          <input type="file" accept={destinationType==="IMAGE"?"image/*":destinationType==="VIDEO"?"video/*":"audio/*"} disabled={uploading} className="hidden" onChange={(e)=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";void upload(destinationType as typeof FORM_MEDIA_TYPES[number],file)}} />
        </label>
        {destinationType === "AUDIO" && (
          <>
            <div className="text-center text-[10px] font-semibold text-[#94A3B8]">یا</div>
            <VoiceRecorder disabled={uploading} onRecorded={(file) => upload("AUDIO", file)} />
          </>
        )}
        {reply.destinationMediaUrl && (
          <div className="overflow-hidden rounded-xl border border-[#BBF7D0] bg-white">
            {destinationType === "IMAGE" ? (
              <img src={reply.destinationMediaUrl} alt="" className="h-44 w-full object-cover" />
            ) : destinationType === "VIDEO" ? (
              <video src={reply.destinationMediaUrl} controls className="max-h-56 w-full bg-black object-contain" />
            ) : (
              <audio src={reply.destinationMediaUrl} controls className="w-full px-3 py-3" />
            )}
            <div className="flex justify-center border-t border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2.5">
              <button type="button" onClick={() => { void requestStorageCleanupByPublicUrl(reply.destinationMediaUrl).catch(() => undefined); onChange({destinationMediaUrl:"",destinationMediaId:""}); }} className="sd-destructive-button text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C]">
                حذف {destinationType === "IMAGE" ? "عکس" : destinationType === "VIDEO" ? "ویدیو" : "وویس"}
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>;
}