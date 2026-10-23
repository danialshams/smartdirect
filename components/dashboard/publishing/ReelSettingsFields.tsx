"use client";

import { uploadFileWithProgress } from "./shared-upload";
import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import type { ReelOptions } from "@/lib/instagram/reel-settings";

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function prepareCover(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_INPUT_BYTES) {
    throw new Error("کاور باید تصویر JPG، PNG یا WebP با حجم حداکثر ۱۲ مگابایت باشد.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth < 320 || image.naturalHeight < 320) {
      throw new Error("ابعاد تصویر کاور باید حداقل ۳۲۰ پیکسل باشد.");
    }
    const ratio = 9 / 16;
    let cropW = image.naturalWidth;
    let cropH = cropW / ratio;
    if (cropH > image.naturalHeight) {
      cropH = image.naturalHeight;
      cropW = cropH * ratio;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("مرورگر امکان آماده‌سازی کاور را ندارد.");
    ctx.drawImage(image, (image.naturalWidth - cropW) / 2, (image.naturalHeight - cropH) / 2, cropW, cropH, 0, 0, 1080, 1920);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("تبدیل تصویر ناموفق بود.")), "image/jpeg", 0.86));
    if (!blob.size || blob.size > MAX_COVER_BYTES) throw new Error("حجم کاور آماده‌شده بیش از حد مجاز است.");
    return new File([blob], "reel-cover.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function uploadCover(file: File, onProgress: (percent: number) => void): Promise<{ storageKey: string; publicUrl: string }> {
  const result = await uploadFileWithProgress(file, "REEL", onProgress);
  return { storageKey: result.storageKey, publicUrl: result.publicUrl };
}

type Props = {
  value: ReelOptions;
  onChange: (options: ReelOptions) => void;
  videoUrl: string | null;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

function persian(value: number) {
  return value.toLocaleString("fa-IR", { maximumFractionDigits: 1 });
}

export default function ReelSettingsFields({ value, onChange, videoUrl, disabled = false, onBusyChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const locked = disabled || busy;

  function selectMode(mode: ReelOptions["coverMode"]) {
    if (locked) return;
    setError("");
    onChange({
      ...value,
      coverMode: mode,
      coverStorageKey: mode === "upload" ? value.coverStorageKey : null,
      coverUrl: mode === "upload" ? value.coverUrl : null,
      thumbOffsetMs: mode === "frame" ? (value.thumbOffsetMs ?? 0) : null,
    });
  }

  async function chooseCover(file?: File) {
    if (!file || locked) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setProgress(0);
    try {
      const normalized = await prepareCover(file);
      const uploaded = await uploadCover(normalized, setProgress);
      onChange({ ...value, coverMode: "upload", coverStorageKey: uploaded.storageKey, coverUrl: uploaded.publicUrl, thumbOffsetMs: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "آپلود کاور ناموفق بود.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div dir="rtl" className="space-y-4 rounded-[22px] border border-[#DFE7F3] bg-white p-4 shadow-sm sm:p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-extrabold text-[#18233C]">تصویر کاور ریلز</h3>
        <p className="text-xs leading-6 text-[#64748B]">کاور همان تصویری است که پیش از بازکردن ریلز دیده می‌شود. یکی از روش‌های زیر را انتخاب کن.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {([
          ["default", "کاور خودکار", "فریم اول ویدیو"],
          ["upload", "کاور اختصاصی", "یک عکس دلخواه"],
          ["frame", "انتخاب از ویدیو", "یک لحظه از ریلز"],
        ] as const).map(([mode, title, hint]) => (
          <button key={mode} type="button" disabled={locked} aria-pressed={value.coverMode === mode}
            onClick={() => selectMode(mode)}
            className={"min-h-[82px] rounded-xl border p-3 text-right transition disabled:opacity-50 " + (value.coverMode === mode ? "border-[#2F61FD] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#B9C9EF]")}>
            <span className="flex items-center gap-2 text-xs font-bold text-[#18233C]">
              {value.coverMode === mode && <CheckCircle2 size={15} className="text-[#2F61FD]"/>}{title}
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-[#64748B]">{hint}</span>
          </button>
        ))}
      </div>
      {value.coverMode === "upload" && (
        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          {value.coverUrl && <div className="flex items-center gap-3"><img src={value.coverUrl} alt="پیش‌نمایش کاور ریلز" className="h-28 w-[63px] rounded-lg border border-[#DFE7F3] object-cover"/><span className="text-xs font-semibold text-[#15803D]">کاور آماده است</span></div>}
          <label className={"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-xs font-bold text-[#18233C] " + (locked ? "pointer-events-none opacity-50" : "")}>
            {busy ? <Loader2 size={16} className="animate-spin"/> : <ImagePlus size={16}/>}
            {busy ? "در حال آپلود کاور..." : value.coverUrl ? "جایگزینی کاور" : "انتخاب عکس کاور"}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={locked} className="sr-only"
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void chooseCover(file); }} />
          </label>
          {busy && <div role="status" className="text-xs text-[#64748B]">آپلود کاور: {persian(progress)}٪</div>}
          <p className="text-[11px] leading-6 text-[#64748B]">تصویر با نسبت ۹:۱۶ برش می‌خورد و خودکار به JPG تبدیل می‌شود. بخش‌های مهم را در مرکز تصویر قرار بده.</p>
          {!value.coverUrl && !busy && <p className="text-xs font-medium text-[#B45309]">برای این روش، آپلود عکس الزامی است.</p>}
        </div>
      )}
      {value.coverMode === "frame" && (
        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          {videoUrl ? (
            <>
              <video key={videoUrl} ref={video} src={videoUrl} playsInline muted preload="metadata" controls={false}
                onLoadedMetadata={(event) => {
                  const length = event.currentTarget.duration;
                  if (Number.isFinite(length) && length > 0) {
                    setDuration(length);
                    event.currentTarget.currentTime = Math.min((value.thumbOffsetMs ?? 0) / 1000, Math.max(0, length - 0.1));
                  }
                }}
                onError={() => setError("پیش‌نمایش این ویدیو روی دستگاه باز نشد. روش کاور اختصاصی را امتحان کن.")}
                className="mx-auto aspect-[9/16] max-h-56 rounded-xl bg-black object-contain"/>
              <label className="block text-xs font-bold text-[#18233C]" htmlFor="reel-cover-time">لحظهٔ انتخاب‌شده: {persian((value.thumbOffsetMs ?? 0) / 1000)} ثانیه</label>
              <input id="reel-cover-time" type="range" min={0} max={Math.max(0, duration - 0.1)} step={0.1}
                disabled={locked || duration === 0} value={Math.min((value.thumbOffsetMs ?? 0) / 1000, Math.max(0, duration - 0.1))}
                onChange={(event) => {
                  const seconds = Number(event.target.value);
                  if (video.current) video.current.currentTime = seconds;
                  onChange({ ...value, thumbOffsetMs: Math.round(seconds * 1000) });
                }}
                dir="ltr" className="w-full accent-[#2F61FD] disabled:opacity-50"/>
              <p className="text-[11px] leading-5 text-[#64748B]">نوار را حرکت بده تا تصویر دلخواهت را پیدا کنی؛ همان زمان هنگام انتشار برای Meta ارسال می‌شود.</p>
            </>
          ) : <p className="text-xs leading-6 text-[#64748B]">ابتدا ویدیوی ریلز را آپلود کن تا بتوانی فریم انتخاب کنی.</p>}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-[#FEF2F2] p-3 text-xs leading-6 text-[#B91C1C]">{error}</p>}
      <div className="border-t border-[#E2E8F0] pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={value.shareToFeed} disabled={locked}
            onChange={(event) => onChange({ ...value, shareToFeed: event.target.checked })}
            className="mt-1 h-4 w-4 accent-[#2F61FD]"/>
          <span>
            <span className="block text-sm font-bold text-[#18233C]">نمایش ریلز در فید</span>
            <span className="mt-1 block text-xs leading-6 text-[#64748B]">اگر فعال باشد ریلز در فید و تب ریلز نمایش داده می‌شود؛ با خاموش‌کردن، فقط در تب ریلز نمایش داده می‌شود.</span>
          </span>
        </label>
      </div>
    </div>
  );
}
