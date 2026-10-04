"use client";

import { Select, Textarea } from "@/components/dashboard/DashboardUI";
import { ImagePlus, Mic, Video, Store, ClipboardList, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
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
    const previewUrl = URL.createObjectURL(file);
    patchSlide(id, { previewUrl });
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await fetch("/api/instagram/publishing/upload", { method: "POST", body: data });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || typeof result?.data?.publicUrl !== "string") throw new Error(result?.message || "آپلود تصویر ناموفق بود.");
      patchSlide(id, { imageUrl: result.data.publicUrl, previewUrl: result.data.publicUrl });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "آپلود تصویر ناموفق بود.");
    }
  }

  async function saveShowcase() {
    if (!instagramAccountId) { setError("اکانت فعال Instagram پیدا نشد."); return; }
    for (let index = 0; index < slides.length; index += 1) {
      const slide = slides[index];
      if (!slide?.imageUrl.trim()) { setError(`تصویر اسلاید ${index + 1} را آپلود کنید.`); return; }
      if (!slide.title.trim()) { setError(`تیتر اسلاید ${index + 1} را وارد کنید.`); return; }
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
      onUpdate({ showcaseId: created.id });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ساخت ویترین ناموفق بود.");
    } finally {
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
          <Textarea
            value={message.text}
            onChange={(event) => onUpdate({ text: event.target.value })}
            rows={5}
            maxLength={2000}
            className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
            placeholder="متنی که در پاسخ Reply استوری ارسال می‌شود بنویس..."
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
                <p className="text-sm font-bold text-[#0F172A]">اسلاید {index + 1}</p>
                <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-center hover:border-[#93C5FD] hover:bg-[#EFF6FF]">
                  {slide.previewUrl ? <img src={slide.previewUrl} alt="" className="h-44 w-full object-cover" /> : <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><ImagePlus size={21}/></span>
                    <span className="mt-3 text-xs font-bold text-[#0F172A]">آپلود عکس اسلاید {index + 1}</span>
                    <span className="mt-1 text-[10px] text-[#64748B]">برای انتخاب تصویر کلیک کن</span>
                  </>}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadSlideImage(slide.id, file); }} />
                </label>
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F172A]">تیتر اسلاید {index + 1}</label>
                  <input value={slide.title} onChange={(event) => patchSlide(slide.id, { title: event.target.value })} placeholder="تیتر اسلاید را وارد کن..." className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#0F172A]">توضیحات اسلاید {index + 1}</label>
                  <textarea value={slide.description} onChange={(event) => patchSlide(slide.id, { description: event.target.value })} rows={4} maxLength={1000} placeholder="توضیحات اسلاید را وارد کن..." className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                </div>
                {slides.length > 1 && <button type="button" onClick={() => setSlides((current) => current.filter((item) => item.id !== slide.id))} className="text-xs font-semibold text-[#DC2626]">حذف اسلاید</button>}
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => setSlides((current) => [...current, createSlide()])} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#2563EB] hover:bg-[#EFF6FF]">
            <Plus size={17} /> افزودن اسلاید
          </Button>
          {!message.showcaseId && <Button type="button" disabled={savingShowcase} onClick={() => void saveShowcase()} className="w-full rounded-xl bg-[#2563EB] py-3 text-xs font-bold text-white disabled:opacity-50">{savingShowcase ? "در حال ساخت ویترین..." : "ساخت و اتصال ویترین"}</Button>}
          {message.showcaseId && <p className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-3 text-xs font-semibold text-[#166534]">ویترین آماده و متصل شد.</p>}
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
