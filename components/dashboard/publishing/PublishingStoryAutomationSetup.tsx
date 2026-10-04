"use client";

import { Button, Select } from "@/components/dashboard/DashboardUI";
import { ImagePlus, Mic, Video, Store, ClipboardList, MessageSquareText, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormItem, MessageDraft, Showcase } from "../automation-form-utils";

type Props = {
  message: MessageDraft;
  showcases: Showcase[];
  forms: FormItem[];
  loadingResources: boolean;
  instagramAccountId: string;
  onUpdate: (patch: Partial<MessageDraft>) => void;
};

type ResponseType = "TEXT" | "AUDIO" | "SHOWCASE" | "IMAGE" | "VIDEO" | "FORM";

const options: Array<{ value: ResponseType; label: string; Icon: typeof MessageSquareText }> = [
  { value: "TEXT", label: "متن", Icon: MessageSquareText },
  { value: "AUDIO", label: "وویس", Icon: Mic },
  { value: "SHOWCASE", label: "ویترین", Icon: Store },
  { value: "IMAGE", label: "عکس", Icon: ImagePlus },
  { value: "VIDEO", label: "ویدیو", Icon: Video },
  { value: "FORM", label: "فرم", Icon: ClipboardList },
];

type ShowcaseSlide = { id: string; title: string; description: string; imageUrl: string; previewUrl: string };

function createSlide(): ShowcaseSlide {
  return { id: `slide_${crypto.randomUUID()}`, title: "", description: "", imageUrl: "", previewUrl: "" };
}

export default function PublishingStoryAutomationSetup({ message, showcases, forms, loadingResources, instagramAccountId, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [slides, setSlides] = useState<ShowcaseSlide[]>([createSlide()]);
  const [savingShowcase, setSavingShowcase] = useState(false);
  const saveShowcaseLockRef = useRef(false);
  const [slideUploadProgress, setSlideUploadProgress] = useState<Record<string, number>>({});
  const [slideUploading, setSlideUploading] = useState<Record<string, boolean>>({});

  const responseType = message.messageType as ResponseType;

  function selectType(value: ResponseType) {
    setError("");
    onUpdate({
      messageType: value,
      text: value === "TEXT" ? message.text : "",
      mediaUrl: value === "IMAGE" || value === "VIDEO" || value === "AUDIO" ? message.mediaUrl : "",
      mediaId: value === "IMAGE" || value === "VIDEO" || value === "AUDIO" ? message.mediaId : "",
      showcaseId: value === "SHOWCASE" ? message.showcaseId : "",
      formId: value === "FORM" ? message.formId : "",
    });
  }

  async function uploadMedia(file?: File) {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgress(0);

    await new Promise<void>((resolve, reject) => {
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
          onUpdate({ mediaUrl: result.data.publicUrl, mediaId: "" });
          resolve();
        } catch {
          reject(new Error("پاسخ نامعتبر از سرور دریافت شد."));
        }
      };
      xhr.send(formData);
    }).catch((uploadError) => {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود فایل ناموفق بود.");
    }).finally(() => setUploading(false));
  }

  useEffect(() => {
    const existing = showcases.find((item) => item.id === message.showcaseId);
    const items = Array.isArray(existing?.items) ? existing.items : [];
    if (items.length > 0) {
      setSlides(items.map((item: any) => ({
        id: typeof item?.id === "string" ? item.id : `slide_${crypto.randomUUID()}`,
        title: typeof item?.title === "string" ? item.title : "",
        description: typeof item?.description === "string" ? item.description : "",
        imageUrl: typeof item?.imageUrl === "string" ? item.imageUrl : "",
        previewUrl: typeof item?.imageUrl === "string" ? item.imageUrl : "",
      })));
    }
  }, [message.showcaseId, showcases]);

  function patchSlide(id: string, patch: Partial<ShowcaseSlide>) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...patch } : slide));
  }

  async function uploadSlideImage(id: string, file?: File) {
    if (!file) return;
    setError("");
    setSlideUploadProgress((current) => ({ ...current, [id]: 0 }));
    setSlideUploading((current) => ({ ...current, [id]: true }));
    // Never show the previous image while a replacement upload is running.
    patchSlide(id, { imageUrl: "", previewUrl: "" });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const data = new FormData();
      data.append("file", file);
      xhr.open("POST", "/api/instagram/publishing/upload");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setSlideUploadProgress((current) => ({
            ...current,
            [id]: Math.round((event.loaded / event.total) * 100),
          }));
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

  const hasValidSlide = slides.length > 0 && slides.every((slide) => slide.imageUrl.trim() && slide.title.trim());

  async function deleteShowcase() {
    if (!message.showcaseId) return;
    setSavingShowcase(true);
    setError("");
    try {
      const response = await fetch(`/api/showcases/${message.showcaseId}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "حذف ویترین ناموفق بود.");
      onUpdate({ showcaseId: "" });
      setSlides([createSlide()]);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "حذف ویترین ناموفق بود.");
    } finally {
      setSavingShowcase(false);
    }
  }

  async function saveShowcase() {
    if (saveShowcaseLockRef.current || savingShowcase) return;
    saveShowcaseLockRef.current = true;
    if (!hasValidSlide) {
      setError("برای ساخت ویترین، حداقل یک اسلاید کامل با تصویر و تیتر بسازید.");
      saveShowcaseLockRef.current = false;
      return;
    }
    if (!instagramAccountId) { setError("اکانت فعال Instagram پیدا نشد."); saveShowcaseLockRef.current = false; return; }
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      if (!slide?.imageUrl.trim()) { setError(`تصویر اسلاید ${index + 1} را آپلود کنید.`); saveShowcaseLockRef.current = false; return; }
      if (!slide.title.trim()) { setError(`تیتر اسلاید ${index + 1} را وارد کنید.`); saveShowcaseLockRef.current = false; return; }
    }
    setSavingShowcase(true);
    setError("");
    try {
      const response = await fetch("/api/showcases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId, title: `ویترین ${new Date().toLocaleDateString("fa-IR")}`, description: null, isActive: true }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.error) throw new Error(result?.error || result?.message || "ساخت ویترین ناموفق بود.");
      const created = result.data ?? result;
      for (let index = 0; index < slides.length; index += 1) {
        const slide = slides[index];
        const itemResponse = await fetch(`/api/showcases/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: slide.title.trim(), description: slide.description.trim() || null, imageUrl: slide.imageUrl.trim(), order: index, isActive: true }),
        });
        const itemResult = await itemResponse.json().catch(() => null);
        if (!itemResponse.ok || itemResult?.error) throw new Error(itemResult?.error || itemResult?.message || `ساخت اسلاید ${index + 1} ناموفق بود.`);
      }
      setSlides((current) => current.map((slide) => ({ ...slide })));
      onUpdate({ showcaseId: created.id });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ساخت ویترین ناموفق بود.");
    } finally {
      saveShowcaseLockRef.current = false;
      setSavingShowcase(false);
    }
  }

  const mediaAccept =
    responseType === "IMAGE" ? "image/*" :
    responseType === "VIDEO" ? "video/*" :
    "audio/*";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-[#0F172A]">نوع پاسخ ارسالی</p>
        <p className="mt-1 text-[11px] leading-5 text-[#64748B]">نوع پاسخی را که می‌خواهی برای Reply استوری ارسال شود انتخاب کن.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {options.map(({ value, label, Icon }) => {
          const active = responseType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => selectType(value)}
              className={[
                "flex min-h-20 items-center gap-2.5 rounded-xl border px-3 py-3 text-right transition",
                active ? "border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/10" : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#BFDBFE] hover:bg-white",
              ].join(" ")}
            >
              <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-[#DBEAFE] text-[#2563EB]" : "bg-white text-[#64748B]"].join(" ")}>
                <Icon size={17} />
              </span>
              <span className="text-xs font-bold text-[#0F172A]">{label}</span>
            </button>
          );
        })}
      </div>

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
            className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none placeholder:text-[10px] placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
            placeholder="متنی که در پاسخ Reply استوری در دایرکت برای کاربر ارسال می‌شود..."
            style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}
          />
        </div>
      )}

      {(responseType === "IMAGE" || responseType === "VIDEO" || responseType === "AUDIO") && (
        <div className="space-y-3">
          <label className="block text-sm font-bold text-[#0F172A]">
            {responseType === "IMAGE" ? "آپلود عکس" : responseType === "VIDEO" ? "آپلود ویدیو" : "آپلود وویس"}
          </label>
          <label className={["flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-[#F8FAFC] px-4 text-center transition", uploading ? "pointer-events-none opacity-60" : "hover:border-[#93C5FD] hover:bg-[#EFF6FF]"].join(" ")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              {responseType === "IMAGE" ? <ImagePlus size={21}/> : responseType === "VIDEO" ? <Video size={21}/> : <Mic size={21}/>}
            </span>
            <span className="mt-3 text-xs font-bold text-[#0F172A]">{uploading ? "در حال آپلود..." : "انتخاب فایل"}</span>
            <span className="mt-1 text-[10px] text-[#64748B]">فایل را از دستگاه انتخاب کن</span>
            <input type="file" accept={mediaAccept} disabled={uploading} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadMedia(file); }} />
          </label>
          {uploading && (
            <div className="rounded-xl border border-[#DBEAFE] bg-[#F8FAFC] p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#2563EB]">
                <span>پیشرفت آپلود</span><span>{progress}٪</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div className="h-full rounded-full bg-[#2563EB] transition-[width] duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {message.mediaUrl && !uploading && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3">
              <span className="truncate text-[10px] text-[#166534]" dir="ltr">{message.mediaUrl}</span>
              <span className="shrink-0 text-[11px] font-bold text-[#16A34A]">آماده ارسال</span>
            </div>
          )}
        </div>
      )}

      {responseType === "SHOWCASE" && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-[#0F172A]">ویترین</p>
            <p className="mt-1 text-[11px] leading-5 text-[#64748B]">اسلایدهای ویترین را با تصویر، تیتر و توضیحات بساز.</p>
          </div>
          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div key={slide.id} className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-center text-sm font-bold text-[#0F172A]">اسلاید {index + 1}</p>
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
                  ) : (
                    <>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><ImagePlus size={21}/></span>
                      <span className="mt-3 text-xs font-bold text-[#0F172A]">آپلود عکس اسلاید {index + 1}</span>
                      <span className="mt-1 text-[10px] text-[#64748B]">برای انتخاب تصویر کلیک کن</span>
                    </>
                  )}
                  <input type="file" accept="image/*" disabled={slideUploading[slide.id] || savingShowcase || Boolean(message.showcaseId)} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadSlideImage(slide.id, file); }} />
                </label>
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
                    <button type="button" onClick={() => setSlides((current) => current.filter((item) => item.id !== slide.id))} className="text-xs font-semibold text-[#DC2626] transition hover:text-[#B91C1C]">
                      حذف اسلاید
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-3 pt-1">
            {!message.showcaseId && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setSlides((current) => [...current, createSlide()])}
                  className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-[#2563EB] transition hover:text-[#1D4ED8]"
                  dir="ltr"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  <span dir="rtl">افزودن اسلاید</span>
                </button>
              </div>
            )}

            {!message.showcaseId && (
              <button
                type="button"
                disabled={savingShowcase || !hasValidSlide || Object.values(slideUploading).some(Boolean)}
                aria-disabled={savingShowcase || !hasValidSlide || Object.values(slideUploading).some(Boolean)}
                onClick={() => {
                  if (savingShowcase || saveShowcaseLockRef.current || !hasValidSlide || Object.values(slideUploading).some(Boolean)) return;
                  void saveShowcase();
                }}
                className={[
                  "w-full rounded-xl py-2.5 text-xs font-bold text-white transition-opacity duration-150 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
                  savingShowcase
                    ? "bg-[#2563EB] !text-white !shadow-none !cursor-wait !pointer-events-none opacity-50"
                    : "bg-[#2563EB] hover:bg-[#1D4ED8]"
                ].join(" ")}
              >
                {savingShowcase ? "در حال ساخت و اتصال ویترین..." : "ساخت و اتصال ویترین"}
              </button>
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
                  className="text-xs font-bold text-[#DC2626] transition hover:text-[#B91C1C] disabled:opacity-50"
                >
                  حذف ویترین ساخته‌شده
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {responseType === "FORM" && (
        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#0F172A]">انتخاب فرم</label>
            <Select
              value={message.formId}
              disabled={loadingResources}
              onChange={(event) => onUpdate({ formId: event.target.value })}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm outline-none"
            >
              <option value="">{loadingResources ? "در حال دریافت فرم‌ها..." : "فرم را انتخاب کن"}</option>
              {forms.map((form: any) => <option key={form.id} value={form.id}>{form.title || form.name || "فرم بدون عنوان"}</option>)}
            </Select>
          </div>
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-[10px] leading-5 text-[#64748B]">
            ساختار فرم و شاخه‌های تو‌در‌تو از همان منطق فرم موجود استفاده می‌کند؛ اینجا فقط فرم پاسخ را انتخاب می‌کنیم.
          </p>
        </div>
      )}

      {error && <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#B91C1C]">{error}</p>}
    </div>
  );
}
