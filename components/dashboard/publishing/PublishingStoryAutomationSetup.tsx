"use client";

import { Button, Checkbox, Select, Textarea } from "@/components/dashboard/DashboardUI";
import { ImagePlus, Mic, Video, Store, ClipboardList, MessageSquareText } from "lucide-react";
import { useState } from "react";
import type { FormItem, MessageDraft, Showcase } from "../automation-form-utils";

type Props = {
  message: MessageDraft;
  showcases: Showcase[];
  forms: FormItem[];
  loadingResources: boolean;
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

export default function PublishingStoryAutomationSetup({ message, showcases, forms, loadingResources, onUpdate }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

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

  const mediaAccept =
    responseType === "IMAGE" ? "image/*" :
    responseType === "VIDEO" ? "video/*" :
    "audio/*";

  return (
    <section className="space-y-5 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
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
        <div>
          <label className="mb-2 block text-sm font-bold text-[#0F172A]">انتخاب ویترین</label>
          <Select
            value={message.showcaseId}
            disabled={loadingResources}
            onChange={(event) => onUpdate({ showcaseId: event.target.value })}
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm outline-none"
          >
            <option value="">{loadingResources ? "در حال دریافت ویترین‌ها..." : "ویترین را انتخاب کن"}</option>
            {showcases.map((showcase) => <option key={showcase.id} value={showcase.id}>{showcase.title}</option>)}
          </Select>
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
    </section>
  );
}
