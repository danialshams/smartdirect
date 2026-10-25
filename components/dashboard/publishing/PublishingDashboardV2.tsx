"use client";
import { Button, Input } from "@/components/dashboard/DashboardUI";
import CommentReplyVariantsField from "../CommentReplyVariantsField";
import ResponseModeSwitcher from "../ResponseModeSwitcher";
import CompleteAutomationPicker, { type CompleteAutomation } from "../CompleteAutomationPicker";
import { normalizeMessages } from "../automation-form-utils";
import { validatePublicCommentReplies, readPublicCommentReplies } from "@/lib/automation/comment-reply-variants";

import { uploadFileWithProgress } from "./shared-upload";
import { ArrowLeft, ArrowRight, CalendarClock, Camera, CheckCircle2, CircleSlash2, Clapperboard, Clock3, ChevronDown, ImagePlus, Images, Loader2, Pencil, RotateCcw, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WheelPicker, type WheelPickerOption } from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";
import { toast } from "sonner";
import PublishingSectionGuide from "./PublishingSectionGuide";
import GlassModalPresence from "../GlassModalPresence";
import { dairaPalette } from "../../../lib/design-system/palette";
import PublishingQueue from "./PublishingQueue";
import ReelSettingsFields from "./ReelSettingsFields";
import { DEFAULT_REEL_OPTIONS, type ReelOptions } from "@/lib/instagram/reel-settings";
import PublishingPageSkeleton from "./PublishingPageSkeleton";
import { type JalaliDate } from "./PersianDatePicker";

import {
    createEmptyMessage,
    createEmptyQuickReply,
    validateMessages,
    type InstagramAccount as AutomationAccount,
    type FormItem,
    type MessageDraft,
    type Showcase
} from "../automation-form-utils";
import dynamic from "next/dynamic";
import type { PublishingStoryAutomationSetupHandle } from "./PublishingStoryAutomationSetup";
const PublishingStoryAutomationSetup = dynamic(() => import("./PublishingStoryAutomationSetup"), {
  loading: () => <PublishingPageSkeleton view="editor" />,
});
import { useStorageUploadLease } from "./useStorageUploadLease";
import { useDashboardAccountSelection } from "../DashboardAccountContext";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY";
type MediaType = "IMAGE" | "VIDEO";
type LocalMedia = { file: File; type: MediaType; previewUrl: string; sortOrder: number };
type UploadRow = { id: string; fileName: string; status: "queued" | "uploading" | "success" | "failed"; progress: number; storageKey?: string; error?: string; removing?: boolean };
type UploadedMedia = { type: MediaType; storageKey: string; publicUrl: string; fileName: string; mimeType: string; fileSize: number; sortOrder: number };
type UploadApiResult = { success?: boolean; message?: string; data?: unknown };
type Job = { id: string; type: PublishType; status: string; caption: string | null; scheduledAt: string | null; publishedAt: string | null; createdAt: string; errorMessage: string | null; media: UploadedMedia[]; instagramAccount?: { igUsername: string | null } };
let publishingJobsCache: Job[] | null = null;
let publishingJobsCacheOwner: string | null = null;

type InstagramAccount = { id: string; igUsername: string | null; username?: string | null; igUserId: string; isConnected?: boolean };


const typeLabels: Record<PublishType, string> = { POST: "پست", CAROUSEL: "پست اسلایدی", REEL: "ریلز", STORY: "استوری" };
const statusLabels: Record<string, string> = { DRAFT: "پیش‌نویس", PROCESSING: "در حال پردازش", PUBLISHING: "در حال انتشار", PUBLISHED: "منتشر شده", FAILED: "ناموفق", SCHEDULED: "زمان‌بندی شده", CANCELLED: "لغو شده" };
const jalaliMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function toPersianDigits(value: number | string) { return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "-"; }
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] { const jYear = jy + 1595; let days = -355668 + 365 * jYear + Math.floor(jYear / 33) * 8 + Math.floor(((jYear % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186); let gy = 400 * Math.floor(days / 146097); days %= 146097; if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; } gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } const gd = days + 1; const monthDays = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let remaining = gd; let gm = 1; while (remaining > monthDays[gm - 1]) { remaining -= monthDays[gm - 1]; gm += 1; } return [gy, gm, remaining]; }
function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate { let jy = gy - 621; const candidate = jalaliToGregorian(jy, 1, 1); const inputUtc = Date.UTC(gy, gm - 1, gd); if (inputUtc < Date.UTC(candidate[0], candidate[1] - 1, candidate[2])) jy -= 1; const start = jalaliToGregorian(jy, 1, 1); const diff = Math.floor((inputUtc - Date.UTC(start[0], start[1] - 1, start[2])) / 86400000); return diff < 186 ? { year: jy, month: Math.floor(diff / 31) + 1, day: (diff % 31) + 1 } : { year: jy, month: Math.floor((diff - 186) / 30) + 7, day: ((diff - 186) % 30) + 1 }; }
function isJalaliLeap(year: number) { const epBase = year - (year >= 0 ? 474 : 473); const epYear = 474 + (epBase % 2820); return ((epYear + 38) * 682) % 2816 < 682; }
function jalaliMonthDays(year: number, month: number) { if (month <= 6) return 31; if (month <= 11) return 30; return isJalaliLeap(year) ? 30 : 29; }
function getOfficialTehranClock() { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); return { hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"), minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"), second: Number(parts.find((part) => part.type === "second")?.value ?? "0") }; }
function currentJalaliDate() { const now = new Date(); const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now); const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getFullYear()); const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getMonth() + 1); const day = Number(parts.find((part) => part.type === "day")?.value ?? now.getDate()); return gregorianToJalali(year, month, day); }
function getJalaliWeekday(value: JalaliDate) { const [gy, gm, gd] = jalaliToGregorian(value.year, value.month, value.day); return ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][new Date(gy, gm - 1, gd).getDay()]; }
function formatWheelValue(value: number) { return value === 0 ? "۰۰" : toPersianDigits(value); }
function formatScheduledLabel(value: Date) { return value.toLocaleString("fa-IR", { dateStyle: "long", timeStyle: "short" }).replace("،", " -"); }
function addJalaliDays(value: JalaliDate, days: number) { const [gy, gm, gd] = jalaliToGregorian(value.year, value.month, value.day); const date = new Date(gy, gm - 1, gd + days); return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate()); }
function jalaliDateTimeToDate(date: JalaliDate, hour: number, minute: number) { const [gy, gm, gd] = jalaliToGregorian(date.year, date.month, date.day); return new Date(Date.UTC(gy, gm - 1, gd, hour, minute, 0, 0) - 3.5 * 60 * 60 * 1000); }

function isVideoCandidate(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return file.type.startsWith("video/") || ["mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp", "mpeg", "mpg", "mts", "m2ts"].includes(extension ?? "");
}

function normalizeSupportedVideoFile(file: File): File | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeByExtension: Record<string, string> = {
    mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
    webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
    "3gp": "video/3gpp", mpeg: "video/mpeg", mpg: "video/mpeg",
    mts: "video/mp2t", m2ts: "video/mp2t",
  };
  const contentType = mimeByExtension[extension] ?? (file.type.startsWith("video/") ? file.type : null);
  if (!contentType) return null;
  if (file.type === contentType) return file;
  return new File([file], file.name, { type: contentType, lastModified: file.lastModified });
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("تصویر قابل خواندن نیست."));
      image.src = objectUrl;
    });
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function normalizeImageAspectRatio(file: File): Promise<File> {
  const dimensions = await getImageDimensions(file);
  const { width, height } = dimensions;
  if (!width || !height) throw new Error("ابعاد تصویر معتبر نیست.");

  const ratio = width / height;
  if (ratio >= 0.8 && ratio <= 1.91) return file;

  // Center-crop to the nearest edge of Meta's supported 4:5–1.91:1 range.
  const targetRatio = ratio < 0.8 ? 0.8 : 1.91;
  const cropWidth = ratio < 0.8 ? width : Math.round(height * targetRatio);
  const cropHeight = ratio < 0.8 ? Math.round(width / targetRatio) : height;
  const canvas = document.createElement("canvas");
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("امکان اصلاح خودکار تصویر وجود ندارد.");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("تصویر قابل خواندن نیست."));
      image.src = sourceUrl;
    });
    const sourceX = Math.max(0, Math.round((width - cropWidth) / 2));
    const sourceY = Math.max(0, Math.round((height - cropHeight) / 2));
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }

  const outputType = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("تبدیل خودکار تصویر ناموفق بود.")), outputType, 0.92);
  });
  const extension = outputType === "image/png" ? ".png" : outputType === "image/webp" ? ".webp" : ".jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], baseName + extension, { type: outputType, lastModified: Date.now() });
}


function InlineWheelPicker({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number | null;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const options: WheelPickerOption<number>[] = Array.from({ length: max - min + 1 }, (_, index) => {
    const optionValue = min + index;
    return {
      value: optionValue,
      label: formatWheelValue(optionValue),
      textValue: String(optionValue),
    };
  });

  return (
    <div className="min-w-0 select-none">
      <div className="mb-2 text-center text-[11px] font-semibold text-[var(--daira-text-secondary)]">
        {label}
      </div>
      <WheelPicker
        options={options}
        value={value ?? min}
        onValueChange={(nextValue) => {
          if (nextValue >= min && nextValue <= max) {
            onChange(nextValue);
          }
        }}
        visibleCount={8}
        optionItemHeight={44}
        dragSensitivity={4}
        scrollSensitivity={6}
        classNames={{
          optionItem: "!text-base !font-semibold !text-[var(--daira-text-disabled)]",
          highlightWrapper: "!rounded-none !border-y !border-[var(--daira-border)] !bg-white",
          highlightItem: "!text-2xl !font-bold !text-[var(--daira-heading)]",
        }}
      />
    </div>
  );
}

function SortableSlideShell({ id, disabled, className, children }: { id: string; disabled: boolean; className: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      data-slide-key={id}
      {...attributes}
      {...listeners}
      onPointerDownCapture={(event) => {
        if ((event.target as HTMLElement).closest("button, input, a")) event.stopPropagation();
      }}
      className={className}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: disabled ? "auto" : "none",
        zIndex: isDragging ? 20 : undefined,
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

function KeywordChipsInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const keywords = value.split(/[\n,،;؛]+/).map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index);
  const [draft, setDraft] = useState("");
  const sync = (next: string[]) => onChange(next.map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).join(","));
  const add = () => { const item = draft.trim(); if (!item) return; sync([...keywords, item]); setDraft(""); };
  return <div className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-xl border border-[var(--daira-border)] bg-white px-3 py-2.5 transition focus-within:border-[var(--daira-processing)] focus-within:ring-2 focus-within:ring-[var(--daira-processing)]/10">{keywords.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">{item}<Button type="button" onClick={() => sync(keywords.filter((keyword) => keyword !== item))} className="text-muted-foreground hover:text-foreground" aria-label={`حذف ${item}`}><X size={13} /></Button></span>)}<Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (["Enter", ",", "،"].includes(event.key)) { event.preventDefault(); add(); } }} onBlur={add} placeholder={keywords.length ? "کلمه بعدی..." : placeholder} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-[var(--daira-heading)] outline-none ring-0 placeholder:text-[var(--daira-text-disabled)]" /><Button type="button" onPointerDown={(event) => event.preventDefault()} onClick={add} className="shrink-0 rounded-lg border border-[var(--daira-border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--daira-text-secondary)] hover:bg-[var(--daira-surface-hover)]">افزودن کلمه</Button></div>;
}

function SectionHeader({ n, title, text }: { n: string; title: string; text: string }) {
  const palette = dairaPalette.publishing;
  return <div className="mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-right sm:px-5"
    style={{background:palette.soft,borderColor:palette.border}}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
      style={{background:palette.selectedBackground,color:dairaPalette.primary.main}}>{n}</span>
    <div className="min-w-0 flex-1">
      <h2 className="text-sm font-extrabold leading-6" style={{color:dairaPalette.text.heading}}>{title}</h2>
      <p className="mt-1 text-xs leading-6" style={{color:dairaPalette.text.body}}>{text}</p>
    </div>
  </div>;
}
function ProgressBar({ progress }: { progress: number }) {
  return <div className="mt-4 w-full max-w-md">
    <div className="mb-2 text-center text-[10px] font-semibold text-[var(--daira-primary)]">
      {toPersianDigits(progress)}٪
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--daira-border)]">
      <div className="h-full rounded-full bg-[var(--daira-primary)] transition-[width] duration-150 ease-out" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
    </div>
  </div>;
}
function UploadSuccessMark() {
  return (
    <span
      className="relative inline-block h-8 w-8 shrink-0"
      aria-hidden="true"
      style={{
        ["--check-draw" as string]: "check-draw 420ms cubic-bezier(0.65, 0, 0.35, 1) forwards",
        ["--check-draw-long" as string]: "check-draw-long 360ms cubic-bezier(0.65, 0, 0.35, 1) 300ms forwards",
      }}
    >
      <style>{`
        @keyframes check-draw {
          from { width: 0; }
          to { width: 9px; }
        }
        @keyframes check-draw-long {
          from { width: 0; }
          to { width: 18px; }
        }
      `}</style>
      <span
        className="absolute left-[7px] top-[19px] block h-[3px] origin-left rounded-full bg-[var(--daira-publishing-completed)]"
        style={{ transform: "rotate(45deg)", animation: "var(--check-draw)" }}
      />
      <span
        className="absolute left-[12px] top-[25px] block h-[3px] origin-left rounded-full bg-[var(--daira-publishing-completed)]"
        style={{ transform: "rotate(-45deg)", animation: "var(--check-draw-long)" }}
      />
    </span>
  );
}
type UploadAreaProps = {
  id: string; accept: string; multiple: boolean; disabled: boolean; isDragging: boolean;
  setIsDragging: (value: boolean) => void; title: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
};
function UploadArea({ id, accept, multiple, disabled, isDragging, setIsDragging, title, onChange, onDrop }: UploadAreaProps) {
  return (
    <div className={"rounded-[20px] border p-4 transition-all sm:p-5 " +
      (isDragging ? "border-[var(--daira-primary)] bg-[var(--daira-publishing-selected)] ring-2 ring-[var(--daira-brand-300)]" : "border-[var(--daira-publishing-border)] bg-[var(--daira-upload-bg)] hover:border-[var(--daira-brand-300)]") +
      (disabled ? " pointer-events-none opacity-60" : "")}
      onDragOver={event=>{event.preventDefault();if(!disabled)setIsDragging(true);}}
      onDragLeave={()=>setIsDragging(false)}
      onDrop={event=>{event.preventDefault();setIsDragging(false);if(!disabled)onDrop(event);}}>
      <Input id={id} type="file" accept={accept} multiple={multiple} onChange={onChange} disabled={disabled} className="sr-only"/>
      <label htmlFor={id} className="flex min-h-[130px] cursor-pointer flex-col items-center justify-between gap-4 text-center sm:min-h-[115px] sm:flex-row sm:text-right">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[17px] bg-white text-[var(--daira-primary)] shadow-[0_3px_16px_rgba(47,97,253,.10)]" aria-hidden="true">
          <ImagePlus size={25} strokeWidth={1.8}/>
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm text-[var(--daira-heading)]">{title}</strong>
          <span className="mt-1.5 block text-xs leading-6 text-[var(--daira-text-secondary)]">{multiple?"چند فایل را هم‌زمان انتخاب کن یا اینجا رها کن.":"یک فایل را انتخاب کن یا اینجا رها کن."}</span>
        </span>
        <span className="daira-leading-action inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-5 text-xs font-bold text-white shadow-sm sm:w-auto">
          <ImagePlus size={17}/> انتخاب فایل
        </span>
      </label>
    </div>
  );
}
type MediaTileProps = { item: LocalMedia | UploadedMedia; type: PublishType; onRemove: () => void; ready?: boolean; compact?: boolean; bare?: boolean };
function MediaTile({ item, type, onRemove, ready = false, compact = false }: MediaTileProps) {
  const image = item.type === "IMAGE";
  const src = ready && "publicUrl" in item ? item.publicUrl : "previewUrl" in item ? item.previewUrl : item.publicUrl;
  const aspect = type === "REEL" || type === "STORY" ? "aspect-[9/16]" : "aspect-[4/5]";
  return <div className={"group relative overflow-hidden rounded-2xl border border-[var(--daira-publishing-border)] bg-[var(--daira-upload-bg)] shadow-[0_8px_24px_rgba(22,54,110,.06)] "+(!compact?"w-full":"")}>
    {image ? <img src={src} alt={"file" in item ? item.file.name : item.fileName}
      className={"w-full object-cover "+aspect} /> :
      <video src={src} controls playsInline preload="metadata" className={"w-full object-cover "+aspect} />}
    {!compact && <button type="button" onClick={onRemove}
      className="absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--daira-error-border)] bg-white/95 text-[var(--daira-error-text)] shadow-sm"
      aria-label="حذف فایل"><Trash2 size={16}/></button>}
  </div>;
}

export default function PublishingDashboardV2({ onTypeChange }: { onTypeChange?: (type: PublishType) => void }) {
  const router = useRouter();
  const {accounts:dashboardAccounts,accountId:dashboardAccountId}=useDashboardAccountSelection();
  // Module memory may survive a logout/login in this browser tab. Never
  // hydrate a different user's publishing queue or account list from it.
  const accountScopeKey = dashboardAccounts.map(account => account.id).sort().join("|");
  const cachedJobs = publishingJobsCacheOwner === accountScopeKey ? publishingJobsCache : null;
  const [accounts, setAccounts] = useState<InstagramAccount[]>(() => dashboardAccounts.map(account => ({
    id: account.id, igUserId: account.igUserId, igUsername: account.igUsername,
    username: account.igUsername, isConnected: account.isConnected,
  })));
  const [jobs, setJobs] = useState<Job[]>(cachedJobs ?? []);
  const knownJobIdsRef = useRef(new Set<string>((cachedJobs ?? []).filter((job) => ["SCHEDULED", "PROCESSING", "PUBLISHING"].includes(job.status)).map((job) => job.id)));
  const previousJobsRef = useRef<Job[]>(cachedJobs ?? []);
  const jobsLoadInFlightRef = useRef<Promise<void> | null>(null);
  const pendingJobsRefreshRef = useRef(false);
  const [activePublishJobId, setActivePublishJobId] = useState<string | null>(null);
  const activePublishJobIdRef = useRef<string | null>(null);
  const [publishResultVisible, setPublishResultVisible] = useState(false);
  const [publishResult, setPublishResult] = useState<"PUBLISHED" | "FAILED" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [type, setType] = useState<PublishType>("POST");
  const [activeTab, setActiveTab] = useState<"create" | "queue">("create");
  const publishingTabsRef = useRef<HTMLElement>(null);
  // Both the window and dashboard's own scrolling container must return to
  // the top of the queue when publishing changes the visible tab.
  useLayoutEffect(() => {
    if (activeTab === "queue") publishingTabsRef.current?.scrollIntoView({
      behavior: "instant", block: "start",
    });
  }, [activeTab]);
  const [selectionConfirmed, setSelectionConfirmed] = useState(true);
  const [captionStepConfirmed, setCaptionStepConfirmed] = useState(false);
  const [tagStepConfirmed, setTagStepConfirmed] = useState(false);
  const [automationChoiceStepStarted, setAutomationChoiceStepStarted] = useState(false);
  const [automationChoiceConfirmed, setAutomationChoiceConfirmed] = useState(false);
  const [automationSetupConfirmed, setAutomationSetupConfirmed] = useState(false);
  const [storyResponseSaved, setStoryResponseSaved] = useState(false);
  const [storyResponseEditing, setStoryResponseEditing] = useState(false);
  const [storyResponseDirty, setStoryResponseDirty] = useState(false);
  const storyAutomationSetupRef = useRef<PublishingStoryAutomationSetupHandle>(null);
  const [automationKeywordDraft, setAutomationKeywordDraft] = useState("");
  const [automationKeywords, setAutomationKeywords] = useState<string[]>([]);
  const [directMessageText, setDirectMessageText] = useState("");
  const [publishingCommentReplies, setPublishingCommentReplies] = useState<string[]>(["", "", ""]);
  const [showUploadedMediaPreview, setShowUploadedMediaPreview] = useState(false);
  const [taggedUsersByMedia, setTaggedUsersByMedia] = useState<Record<string, string[]>>({});
  const [tagDraftByMedia, setTagDraftByMedia] = useState<Record<string, string>>({});
  const [tagInputError, setTagInputError] = useState("");
  const [stepVisible, setStepVisible] = useState(true);
  const [caption, setCaption] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [reelOptions, setReelOptions] = useState<ReelOptions>({ ...DEFAULT_REEL_OPTIONS });
  const [reelCoverUploading, setReelCoverUploading] = useState(false);
  useStorageUploadLease([...uploadedMedia.map((item) => item.publicUrl), ...(reelOptions.coverUrl ? [reelOptions.coverUrl] : [])]);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [confirmStoryPublishingReplacement,setConfirmStoryPublishingReplacement] = useState<{
    keywords:string[];publishNow:boolean;
  }|null>(null);
  const [replyMode,setReplyMode]=useState<"new"|"existing">("new");
  const [previousRules,setPreviousRules]=useState<CompleteAutomation[]>([]);
  const [previousLoading,setPreviousLoading]=useState(false);
  const [previousId,setPreviousId]=useState("");
  const [copyStoryWords,setCopyStoryWords]=useState("");
  const [keywords, setKeywords] = useState("");
  const [messages, setMessages] = useState<MessageDraft[]>([createEmptyMessage()]);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [likeStoryReply, setLikeStoryReply] = useState(false);
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("برای دریافت پاسخ، ابتدا پیج را Follow کنید.");
  const [officialTehranClock, setOfficialTehranClock] = useState(() => getOfficialTehranClock());
  const [todayJalali, setTodayJalali] = useState<JalaliDate>(() => currentJalaliDate());
  const [scheduledDate, setScheduledDate] = useState<JalaliDate>(todayJalali);
  const [hour, setHour] = useState(officialTehranClock.hour);
  const [minute, setMinute] = useState(officialTehranClock.minute);
  const [publishNow, setPublishNow] = useState(true);
  const [stage6Date, setStage6Date] = useState<JalaliDate | null>(todayJalali);
  const [stage6Hour, setStage6Hour] = useState<number | null>(officialTehranClock.hour);
  const [stage6Minute, setStage6Minute] = useState<number | null>(officialTehranClock.minute);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([]);
  const slideListRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const restrictSlideDragToList: Modifier = ({ transform, draggingNodeRect }) => {
    const bounds = slideListRef.current?.getBoundingClientRect();
    if (!bounds || !draggingNodeRect) return { ...transform, x: 0 };
    const minX = bounds.left - draggingNodeRect.left;
    const maxX = bounds.right - draggingNodeRect.right;
    const minY = bounds.top - draggingNodeRect.top;
    const maxY = bounds.bottom - draggingNodeRect.bottom;
    return {
      ...transform,
      x: Math.max(minX, Math.min(maxX, 0)),
      y: Math.max(minY, Math.min(maxY, transform.y)),
    };
  };
  const uploadQueueRef = useRef<LocalMedia[]>([]);
  const uploadAbortControllersRef = useRef(new Map<string, AbortController>());
  const uploadedOrderRef = useRef(new Map<string, number>());
  const uploadOrderSequenceRef = useRef(0);
  const pendingValidationCountRef = useRef(0);
  const uploadWorkerRunningRef = useRef(false);
  const activeUploadItemIdsRef = useRef(new Set<string>());
  const carouselInsertAtRef = useRef<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(cachedJobs === null);
  const [error, setError] = useState("");

  const triggerType = type === "STORY" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD";
  const uploadTitle = `آپلود ${typeLabels[type]}`;
  const uploadInstruction =
    type === "CAROUSEL"
      ? uploadedMedia.length >= 2
        ? "برای آپلود اسلایدهای بیشتر (تا ۱۰ اسلاید)، فایل موردنظرت را انتخاب کن."
        : "تصویر یا ویدیوی پست اسلایدی را انتخاب کن."
      : type === "REEL"
        ? "ویدیوی ریلز را انتخاب کن."
        : type === "STORY"
          ? "تصویر یا ویدیوی استوری را انتخاب کن."
          : "تصویر پست را انتخاب کن.";
  const activeInstagramAccount = accounts.find((account) => account.id===dashboardAccountId && account.isConnected !== false)
    ?? accounts.find((account) => account.isConnected !== false);
  const selectedAccountId = activeInstagramAccount?.id ?? "";
  const automationAccount: AutomationAccount = {
    id: selectedAccountId,
    igUsername: activeInstagramAccount?.igUsername ?? activeInstagramAccount?.username ?? "",
  };

  async function loadAccounts() {
    // Accounts already arrived with the authenticated dashboard layout.
    const list: InstagramAccount[] = dashboardAccounts.map(account => ({
      id: account.id, igUserId: account.igUserId, igUsername: account.igUsername,
      username: account.igUsername, isConnected: account.isConnected,
    }));
    setAccounts(list);
  }
  function loadJobs(forceFresh = false): Promise<void> {
    if (jobsLoadInFlightRef.current) {
      // After a create/cancel/retry, do not discard the refresh event just
      // because a polling request happened to be in flight.
      if (forceFresh) pendingJobsRefreshRef.current = true;
      return jobsLoadInFlightRef.current;
    }
    const request = (async () => {
      do {
        pendingJobsRefreshRef.current = false;
        await fetchJobs();
      } while (pendingJobsRefreshRef.current);
    })();
    jobsLoadInFlightRef.current = request;
    const clear = () => {
      if (jobsLoadInFlightRef.current === request) jobsLoadInFlightRef.current = null;
    };
    void request.then(clear, clear);
    return request;
  }

  async function fetchJobs() {
    const response = await fetch("/api/instagram/publishing", { cache: "no-store" });
    if (!response.ok) throw new Error("دریافت Publishing Jobs ناموفق بود.");
    const result = await response.json();
    const nextJobs: Job[] = result.data ?? [];
    if (previousJobsRef.current.length === 0) {
      try {
        const stored = sessionStorage.getItem("smartdirect:publishing-jobs:v2:" + accountScopeKey);
        const cached = stored ? JSON.parse(stored) as Job[] : [];
        if (Array.isArray(cached)) {
          previousJobsRef.current = cached;
          for (const job of cached) if (["SCHEDULED", "PROCESSING", "PUBLISHING"].includes(job.status)) knownJobIdsRef.current.add(job.id);
        }
      } catch { /* Ignore malformed browser cache and trust the server response. */ }
    }
    const previousJobs = previousJobsRef.current;
    const previousById = new Map(previousJobs.map((job) => [job.id, job]));
    const nextById = new Map(nextJobs.map((job) => [job.id, job]));

    for (const job of nextJobs) {
      if (!knownJobIdsRef.current.has(job.id)) continue;
      const previousStatus = previousById.get(job.id)?.status;
      if (previousStatus === job.status) continue;

      if (job.status === "PUBLISHED") {
        toast.success(`${typeLabels[job.type]} با موفقیت در اینستاگرام منتشر شد.`, { icon: <CheckCircle2 size={18} className="text-[var(--daira-publishing-completed)]" /> });
        if (activePublishJobIdRef.current === job.id) {
          setPublishResult("PUBLISHED");
          setPublishResultVisible(true);
        }
        knownJobIdsRef.current.delete(job.id);
      } else if (job.status === "FAILED") {
        toast.error(job.errorMessage || `${typeLabels[job.type]} در اینستاگرام منتشر نشد.`, { icon: <CircleSlash2 size={18} className="text-[var(--daira-error-text)]" /> });
        if (activePublishJobIdRef.current === job.id) {
          setPublishResult("FAILED");
          window.setTimeout(() => {
            setPublishResultVisible(false);
            window.setTimeout(() => {
              setActivePublishJobId(null);
              setPublishResult(null);
            }, 350);
          }, 500);
        }
        knownJobIdsRef.current.delete(job.id);
      }
    }

    for (const id of knownJobIdsRef.current) {
      if (!nextById.has(id)) knownJobIdsRef.current.delete(id);
    }

    previousJobsRef.current = nextJobs;
    publishingJobsCache = nextJobs;
    publishingJobsCacheOwner = accountScopeKey;
    try {
      sessionStorage.setItem("smartdirect:publishing-jobs:v2:" + accountScopeKey, JSON.stringify(nextJobs));
    } catch {
      // Session storage is only a navigation-speed cache; ignore quota/privacy failures.
    }
    setJobs(nextJobs);
  }
  async function loadResources(accountId: string) {
    if (!accountId) return; setLoadingResources(true); try {
      const [showcaseResponse, formResponse] = await Promise.all([fetch(`/api/showcases?instagramAccountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }), fetch(`/api/forms?instagramAccountId=${encodeURIComponent(accountId)}`, { cache: "no-store" })]); const showcaseResult = await showcaseResponse.json(); const formResult = await formResponse.json(); setShowcases(
        Array.isArray(showcaseResult)
          ? showcaseResult
          : Array.isArray(showcaseResult?.data)
            ? showcaseResult.data
            : [],
      ); setForms(Array.isArray(formResult.data) ? formResult.data : []);
    } finally { setLoadingResources(false); }
  }
  async function load() { const showBlockingLoading = cachedJobs === null; try { if (showBlockingLoading) setLoading(true); setError(""); await Promise.all([loadAccounts(), loadJobs()]); } catch (e) { setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات."); } finally { if (showBlockingLoading) setLoading(false); } }
  useEffect(() => {
    let previousDate = todayJalali;
    let previousHour = officialTehranClock.hour;
    let previousMinute = officialTehranClock.minute;

    const syncOfficialTime = () => {
      const nextClock = getOfficialTehranClock();
      const nextDate = currentJalaliDate();
      const dateChanged =
        previousDate.year !== nextDate.year ||
        previousDate.month !== nextDate.month ||
        previousDate.day !== nextDate.day;

      // Avoid re-rendering the entire publishing editor every second when
      // the displayed Tehran clock still shows the same minute.
      setOfficialTehranClock(current =>
        current.hour === nextClock.hour && current.minute === nextClock.minute ? current : nextClock,
      );
      if (dateChanged) setTodayJalali(nextDate);

      const stageDateIsPreviousToday =
        stage6Date &&
        stage6Date.year === previousDate.year &&
        stage6Date.month === previousDate.month &&
        stage6Date.day === previousDate.day;

      if (dateChanged && stageDateIsPreviousToday) {
        setStage6Date(nextDate);
        setStage6Hour(nextClock.hour);
        setStage6Minute(nextClock.minute);
      } else if (stageDateIsPreviousToday && stage6Hour !== null && stage6Minute !== null) {
        const selectedWasNoLongerInTheFuture =
          stage6Hour < previousHour ||
          (stage6Hour === previousHour && stage6Minute <= previousMinute);
        if (selectedWasNoLongerInTheFuture) {
          setStage6Hour(nextClock.hour);
          setStage6Minute(nextClock.minute);
        }
      }

      if (dateChanged) {
        setScheduledDate((current) =>
          current.year === previousDate.year &&
            current.month === previousDate.month &&
            current.day === previousDate.day
            ? nextDate
            : current,
        );
        setHour(nextClock.hour);
        setMinute(nextClock.minute);
      }

      previousDate = nextDate;
      previousHour = nextClock.hour;
      previousMinute = nextClock.minute;
    };

    const interval = window.setInterval(syncOfficialTime, 1000);
    return () => window.clearInterval(interval);
  }, [stage6Date, stage6Hour, stage6Minute, todayJalali, officialTehranClock.hour]);

  useEffect(() => {
    activePublishJobIdRef.current = activePublishJobId;
  }, [activePublishJobId]);

  useEffect(() => {
    void load();

    const refreshFromDetail = () => {
      void loadJobs(true).catch(() => {
        // A failed background refresh must not produce an unhandled promise.
      });
    };

    window.addEventListener("smartdirect:publishing-refresh", refreshFromDetail);
    let lastIdlePoll = Date.now();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const jobs = previousJobsRef.current;
      const active = jobs.some(job => ["PROCESSING", "PUBLISHING"].includes(job.status));
      if (!active && Date.now() - lastIdlePoll < 30_000) return;
      lastIdlePoll = Date.now();
      void loadJobs().catch(() => {
        // The next scheduled check or visible-tab refresh will retry.
      });
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastIdlePoll = Date.now();
        void loadJobs(true).catch(() => {
          // Keep the last usable queue while connectivity is unavailable.
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("smartdirect:publishing-refresh", refreshFromDetail);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (!jobs.length) return;

    const ids = jobs
      .filter((job) => job.status === "SCHEDULED" || job.status === "PUBLISHED")
      .slice(0, 3)
      .map((job) => job.id);

    const prefetch = () => {
      for (const jobId of ids) {
        router.prefetch(`/dashboard/publishing/${jobId}`);
      }
    };

    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 1200 });
      return () => window.cancelIdleCallback(handle);
    }

    const handle = setTimeout(prefetch, 250);
    return () => clearTimeout(handle);
  }, [jobs, router]);

  useEffect(() => { if (selectedAccountId && automationEnabled && type === "STORY") void loadResources(selectedAccountId); }, [selectedAccountId, automationEnabled, type]);
  useEffect(()=>{
    if (!automationEnabled||!selectedAccountId){setPreviousRules([]);return;}
    const controller=new AbortController();setPreviousLoading(true);setPreviousRules([]);
    void fetch("/api/automations?instagramAccountId="+encodeURIComponent(selectedAccountId),{credentials:"include",cache:"no-store",signal:controller.signal})
      .then(async r=>{const v=await r.json();if(!r.ok||!v.success)throw Error(v.error||"دریافت پاسخ‌های قبلی ناموفق بود.");return v;})
      .then(v=>{if(!controller.signal.aborted)setPreviousRules((Array.isArray(v.data)?v.data:[]).filter((x:CompleteAutomation)=>x.triggerType===(type==="STORY"?"STORY_REPLY_KEYWORD":"COMMENT_KEYWORD") && (type==="STORY" ? normalizeMessages(x.messages).length>0 : (() => {
          if (readPublicCommentReplies(x.commentReplyText).length<3) return false;
          if (x.sendDm===false) return true;
          const raw=Array.isArray(x.messages)?x.messages as Array<{messageType?:string;linkButtons?:unknown;linkButtonUrl?:unknown;quickReplies?:unknown}>:[];
          return raw.length===1&&raw[0].messageType==="TEXT"&&!raw[0].linkButtonUrl&&
            (!Array.isArray(raw[0].linkButtons)||raw[0].linkButtons.length===0)&&
            (!Array.isArray(raw[0].quickReplies)||raw[0].quickReplies.length===0);
        })())));})
      .catch(()=>{if(!controller.signal.aborted)setPreviousRules([]);})
      .finally(()=>{if(!controller.signal.aborted)setPreviousLoading(false);});
    return()=>controller.abort();
  },[automationEnabled,selectedAccountId,type]);

  function revokeLocalMedia(items: LocalMedia[]) { items.forEach((item) => URL.revokeObjectURL(item.previewUrl)); }
  function clearLocalMedia() { for (const c of uploadAbortControllersRef.current.values()) c.abort(); uploadAbortControllersRef.current.clear(); activeUploadItemIdsRef.current.clear(); uploadQueueRef.current = []; setUploadRows([]); setMedia((current) => { revokeLocalMedia(current); return []; }); }
  function resetAutomation() { setReplyMode("new"); setPreviousId(""); setAutomationEnabled(false); setStoryResponseSaved(false); setStoryResponseEditing(false); setStoryResponseDirty(false); setKeywords(""); setMessages([createEmptyMessage()]); setCommentReplyText(""); setLikeStoryReply(false); setRequireFollow(false); setFollowGateText("برای دریافت اطلاعات لطفاً ابتدا پیج را فالو کنید."); setAutomationSetupConfirmed(false); setAutomationKeywordDraft(""); setAutomationKeywords([]); setDirectMessageText(""); setPublishingCommentReplies(["", "", ""]); }
  function animateStepChange(action: () => void) {
    setStepVisible(false);
    window.setTimeout(() => { action(); window.requestAnimationFrame(() => setStepVisible(true)); }, 180);
  }
  function handleTypeChange(nextType: PublishType) { animateStepChange(() => { setReelOptions({ ...DEFAULT_REEL_OPTIONS }); setShowTags(false); clearLocalMedia(); setUploadedMedia([]); setType(nextType); setSelectionConfirmed(true); setCaptionStepConfirmed(false); setTagStepConfirmed(false); setAutomationChoiceStepStarted(false); setAutomationChoiceConfirmed(false); setAutomationSetupConfirmed(false); setAutomationKeywordDraft(""); setAutomationKeywords([]); setDirectMessageText(""); setShowUploadedMediaPreview(false); setTaggedUsersByMedia({}); setTagDraftByMedia({}); setTagInputError(""); onTypeChange?.(nextType); setUploadProgress(0); setUploadSuccess(false); setCaption(""); resetAutomation(); }); }
  function handleBackToTypeSelection() { animateStepChange(() => { setReelOptions({ ...DEFAULT_REEL_OPTIONS }); setShowTags(false); clearLocalMedia(); setUploadedMedia([]); setSelectionConfirmed(false); setCaptionStepConfirmed(false); setTagStepConfirmed(false); setAutomationChoiceStepStarted(false); setAutomationChoiceConfirmed(false); setShowUploadedMediaPreview(false); setTaggedUsersByMedia({}); setTagDraftByMedia({}); setTagInputError(""); setUploadProgress(0); setUploadSuccess(false); setCaption(""); resetAutomation(); }); }
  async function prepareFiles(files: File[]) {
    if (!files.length || publishing) return;
    const accepted =
      type === "REEL"
        ? files.filter(isVideoCandidate)
        : type === "STORY" || type === "CAROUSEL"
          ? files.filter((file) => file.type.startsWith("image/") || isVideoCandidate(file))
          : files.filter((file) => file.type.startsWith("image/"));

    if (!accepted.length) {
      setError(
        type === "REEL"
          ? "برای ریلز یک فایل ویدیویی انتخاب کن."
          : type === "STORY"
            ? "برای استوری یک تصویر یا ویدیو انتخاب کن."
            : type === "CAROUSEL"
              ? "برای پست اسلایدی یک تصویر یا ویدیو انتخاب کن."
              : "برای پست یک تصویر انتخاب کن.",
      );
      return;
    }

    const remaining = type === "CAROUSEL"
      ? Math.max(0, 10 - uploadedMedia.length - media.length - pendingValidationCountRef.current)
      : Math.max(0, 1 - uploadedMedia.length - media.length - pendingValidationCountRef.current);
    if (remaining <= 0) {
      const message = type === "CAROUSEL" ? "پست اسلایدی نمی‌تواند بیشتر از ۱۰ اسلاید داشته باشد." : `برای ${typeLabels[type]} فقط یک فایل مجاز است.`;
      setError(message);
      toast.error(message);
      return;
    }

    if (type === "CAROUSEL" && accepted.length > remaining) {
      toast.error(`حداکثر ${toPersianDigits(remaining)} اسلاید دیگر می‌توانی انتخاب کنی.`);
    }

    const selected = accepted.slice(0, remaining);
    if (!selected.length) return;
    pendingValidationCountRef.current += selected.length;

    const validated: File[] = [];
    try {
    for (const file of selected) {
      if (isVideoCandidate(file)) {
        const normalizedVideo = normalizeSupportedVideoFile(file);
        if (normalizedVideo) {
          validated.push(normalizedVideo);
        } else {
          toast.error(`فرمت ویدیوی «${file.name}» پشتیبانی نمی‌شود. لطفاً ویدیو را با فرمت MP4 یا MOV انتخاب کن.`);
        }
        continue;
      }
      if (!file.type.startsWith("image/")) continue;
      try {
        validated.push(await normalizeImageAspectRatio(file));
      } catch {
        toast.error(`اصلاح خودکار تصویر «${file.name}» ممکن نشد؛ لطفاً یک نسخه JPG یا PNG سالم انتخاب کن.`);
      }
    }
    } finally {
      pendingValidationCountRef.current = Math.max(0, pendingValidationCountRef.current - selected.length);
    }
    if (!validated.length) return;

    const nextMedia = validated.map((file, index): LocalMedia => ({
      file,
      type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      previewUrl: URL.createObjectURL(file),
      sortOrder: uploadOrderSequenceRef.current++,
    }));

    setMedia((current) => [...current, ...nextMedia]);
    setUploadRows((current) => [...current, ...nextMedia.map((item) => ({ id: item.previewUrl, fileName: item.file.name, status: "queued" as const, progress: 0 }))]);
    uploadQueueRef.current.push(...nextMedia);
    setError("");
    void uploadSelectedMedia();
  }
  function handleFiles(event: ChangeEvent<HTMLInputElement>) { const files = Array.from(event.target.files ?? []); event.target.value = ""; void prepareFiles(files); }
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setIsDragging(false); void prepareFiles(Array.from(event.dataTransfer.files ?? [])); }
  function removeLocal(index: number) {
    const item = media[index];
    if (!item) return;
    uploadQueueRef.current = uploadQueueRef.current.filter((queued) => queued.previewUrl !== item.previewUrl);
    if (activeUploadItemIdsRef.current.has(item.previewUrl)) { activeUploadItemIdsRef.current.delete(item.previewUrl); uploadAbortControllersRef.current.get(item.previewUrl)?.abort(); }
    URL.revokeObjectURL(item.previewUrl);
    setUploadRows((current) => current.filter((row) => row.id !== item.previewUrl));
    setMedia((current) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + uploadedMedia.length })));
  }
  function removeLocalById(id: string) {
    const index = media.findIndex((item) => item.previewUrl === id);
    if (index >= 0) removeLocal(index);
  }
  function retryLocalUpload(id: string) {
    const item = media.find((candidate) => candidate.previewUrl === id);
    if (!item || uploadQueueRef.current.some((queued) => queued.previewUrl === id) || activeUploadItemIdsRef.current.has(id)) return;
    uploadQueueRef.current.push(item);
    setUploadRows((current) => current.map((row) => row.id === id ? { ...row, status: "queued", progress: 0, error: undefined } : row));
    setError("");
    void uploadSelectedMedia();
  }
  function moveUploadedSlide(sourceStorageKey: string, targetStorageKey: string) {
    if (!sourceStorageKey || !targetStorageKey || sourceStorageKey === targetStorageKey) return;
    setUploadedMedia((current) => {
      const from = current.findIndex((item) => item.storageKey === sourceStorageKey);
      const to = current.findIndex((item) => item.storageKey === targetStorageKey);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      next.forEach((entry, index) => uploadedOrderRef.current.set(entry.storageKey, index));
      return next.map((item, index) => ({ ...item, sortOrder: index }));
    });
    setUploadRows((current) => {
      const order = new Map(uploadedMedia.map((item, index) => [item.storageKey, index]));
      const from = order.get(sourceStorageKey);
      const to = order.get(targetStorageKey);
      if (from === undefined || to === undefined) return current;
      const nextOrder = [...uploadedMedia];
      const [moved] = nextOrder.splice(from, 1);
      nextOrder.splice(to, 0, moved);
      const rowOrder = new Map(nextOrder.map((item, index) => [item.storageKey, index]));
      return [...current].sort((a, b) => {
        const aOrder = a.storageKey ? rowOrder.get(a.storageKey) : undefined;
        const bOrder = b.storageKey ? rowOrder.get(b.storageKey) : undefined;
        if (aOrder === undefined && bOrder === undefined) return 0;
        if (aOrder === undefined) return 1;
        if (bOrder === undefined) return -1;
        return aOrder - bOrder;
      });
    });
    setError("");
  }

  async function removeUploaded(item: UploadedMedia) {
    try {
      const currentIndex = uploadedMedia.findIndex((mediaItem) => mediaItem.storageKey === item.storageKey);
      const response = await fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: item.storageKey }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "حذف فایل ناموفق بود.");
      if (type === "CAROUSEL" && currentIndex >= 0) carouselInsertAtRef.current = currentIndex;
      uploadedOrderRef.current.delete(item.storageKey);
      setUploadRows((current) => current.filter((row) => row.storageKey !== item.storageKey));
      if (type !== "CAROUSEL") setShowUploadedMediaPreview(false);
      setUploadedMedia((current) => current.filter((m) => m.storageKey !== item.storageKey).map((m, i) => ({ ...m, sortOrder: i })));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "حذف فایل ناموفق بود."); }
  }
  async function uploadSelectedMedia() {
    if (uploadWorkerRunningRef.current || !uploadQueueRef.current.length) return;
    if (!selectedAccountId) {
      setError("اکانت فعال Instagram پیدا نشد.");
      toast.error("اکانت فعال Instagram پیدا نشد.");
      return;
    }
    uploadWorkerRunningRef.current = true;
    setUploading(true);
    let completedAny = false;
    try {
      const processNext = async () => {
       while (uploadQueueRef.current.length) {
        const item = uploadQueueRef.current.shift();
        if (!item) continue;
        activeUploadItemIdsRef.current.add(item.previewUrl);
        setUploadRows((current) => current.map((row) => row.id === item.previewUrl ? { ...row, status: "uploading", progress: Math.max(1, row.progress), error: undefined } : row));
        setUploadProgress(0);
        try {
          const result = await uploadFileWithProgress(item.file, type, (progress) => {
            if (!activeUploadItemIdsRef.current.has(item.previewUrl)) return;
            setUploadProgress(progress);
            setUploadRows((current) => current.map((row) => row.id === item.previewUrl ? { ...row, status: "uploading", progress: Math.max(row.progress, progress) } : row));
          }, { onController: (controller) => {
            if (controller) uploadAbortControllersRef.current.set(item.previewUrl, controller);
            else uploadAbortControllersRef.current.delete(item.previewUrl);
          } });
          if (!activeUploadItemIdsRef.current.has(item.previewUrl)) {
            void fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: result.storageKey }) }).catch(() => undefined);
            continue;
          }
          uploadedOrderRef.current.set(result.storageKey, item.sortOrder);
          setUploadedMedia((current) => {
            const next = type !== "CAROUSEL" ? [result] : [...current];
            if (type === "CAROUSEL") {
              if (carouselInsertAtRef.current !== null) {
                next.splice(Math.min(carouselInsertAtRef.current, next.length), 0, result);
                next.forEach((entry, index) => uploadedOrderRef.current.set(entry.storageKey, index));
                carouselInsertAtRef.current = null;
              } else {
                next.push(result);
              }
            }
            return next.sort((a, b) => (uploadedOrderRef.current.get(a.storageKey) ?? Number.MAX_SAFE_INTEGER) - (uploadedOrderRef.current.get(b.storageKey) ?? Number.MAX_SAFE_INTEGER)).map((entry, index) => ({ ...entry, sortOrder: index }));
          });
          // Preserve the typed username but do not register any tag before media upload.
          setTagDraftByMedia((current) => {
            const pending = current["__pending__"];
            if (!pending) return current;
            const next = { ...current };
            delete next["__pending__"];
            next[result.storageKey] = pending;
            return next;
          });
          setMedia((current) => current.filter((candidate) => candidate.previewUrl !== item.previewUrl).map((entry, index) => ({ ...entry, sortOrder: index + uploadedMedia.length })));
          URL.revokeObjectURL(item.previewUrl);
          setUploadRows((current) => current.map((row) => row.id === item.previewUrl ? { ...row, status: "success", progress: 100, storageKey: result.storageKey, error: undefined } : row));
          if (type !== "CAROUSEL") {
            window.setTimeout(() => {
              setUploadRows((current) => current.map((row) => row.id === item.previewUrl ? { ...row, removing: true } : row));
              window.setTimeout(() => {
                setUploadRows((current) => current.filter((row) => row.id !== item.previewUrl));
              }, 350);
            }, 1600);
          }
          setError("");
          completedAny = true;
        } catch (error) {
          if (!activeUploadItemIdsRef.current.has(item.previewUrl)) continue;
          const message = error instanceof Error ? error.message : "آپلود فایل ناموفق بود.";
          setUploadRows((current) => current.map((row) => row.id === item.previewUrl ? { ...row, status: "failed", error: message } : row));
          setError(message);
          toast.error(`آپلود «${item.file.name}» ناموفق بود: ${message}`);
        } finally {
          activeUploadItemIdsRef.current.delete(item.previewUrl);
          uploadAbortControllersRef.current.delete(item.previewUrl);
        }
       }
      };
      await Promise.all(Array.from({ length: type === "CAROUSEL" ? 3 : 1 }, () => processNext()));
    } finally {
      uploadWorkerRunningRef.current = false;
      setUploading(false);
      if (uploadQueueRef.current.length) queueMicrotask(() => { void uploadSelectedMedia(); });
      if (completedAny && type !== "CAROUSEL") {
        setUploadSuccess(true);
        setUploadProgress(100);
        window.setTimeout(() => {
          setUploadSuccess(false);
          setUploadProgress(0);
        }, 900);
      } else {
        setUploadSuccess(false);
        setUploadProgress(0);
      }
    }
  }

  function addTagForMedia(mediaKey: string) {
    // Guard both the button and Enter-key flow until a completed upload exists.
    if (!uploadedMedia.some((item) => item.storageKey === mediaKey)) return;
    const draft = (tagDraftByMedia[mediaKey] ?? "").trim();
    if (!draft) return;
    if (draft.includes("@")) {
      setTagInputError("نام کاربر را بدون @ وارد کن.");
      return;
    }
    if (!/^[A-Za-z0-9._]{1,30}$/.test(draft)) {
      setTagInputError("نام کاربر فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه و زیرخط باشد.");
      return;
    }
    const current = taggedUsersByMedia[mediaKey] ?? [];
    if (current.some((username) => username.toLowerCase() === draft.toLowerCase())) {
      setTagInputError("این کاربر قبلاً اضافه شده است.");
      return;
    }
    if (current.length >= 10) {
      setTagInputError("برای هر محتوا حداکثر ۱۰ کاربر می‌توانی تگ کنی.");
      return;
    }
    setTaggedUsersByMedia((state) => ({ ...state, [mediaKey]: [...current, draft] }));
    setTagDraftByMedia((state) => ({ ...state, [mediaKey]: "" }));
    setTagInputError("");
  }
  function removeTagForMedia(mediaKey: string, username: string) {
    setTaggedUsersByMedia((state) => ({ ...state, [mediaKey]: (state[mediaKey] ?? []).filter((item) => item !== username) }));
    setTagInputError("");
  }
  function handleTagInputChange(mediaKey: string, value: string) {
    setTagDraftByMedia((state) => ({ ...state, [mediaKey]: value }));
    if (value.includes("@")) {
      setTagInputError("نام کاربر را بدون @ وارد کن.");
    } else if (tagInputError) {
      setTagInputError("");
    }
  }
  function handleTagInputKeyDown(mediaKey: string, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTagForMedia(mediaKey);
    }
  }
  function handleEditStoryResponse() {
    setStoryResponseEditing(true);
    setStoryResponseDirty(false);
    setError("");
  }

  async function handleDeleteStoryResponse() {
    const deleted = await storyAutomationSetupRef.current?.deleteAndReset();
    if (!deleted) return;
    setKeywords("");
    setAutomationKeywordDraft("");
    setLikeStoryReply(false);
    setRequireFollow(false);
    setFollowGateText("برای دریافت پاسخ، ابتدا پیج را Follow کنید.");
    setStoryResponseSaved(false);
    setStoryResponseEditing(false);
    setStoryResponseDirty(false);
    setError("");
  }
  function handleAutomationChoice(enabled: boolean) {
    if (publishing) return;
    setAutomationEnabled(enabled);
    setAutomationChoiceConfirmed(true);
    setAutomationSetupConfirmed(false);
    setError("");
  }

  function updateMessage(index: number, patch: Partial<MessageDraft>) { setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, ...patch } : message)); }
  function addMessage() { setMessages((current) => [...current, createEmptyMessage()]); }
  function addQuickReply(index: number) { setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, quickReplies: [...message.quickReplies, createEmptyQuickReply()] } : message)); }
  function updateQuickReply(messageIndex: number, quickReplyId: string, patch: Partial<MessageDraft["quickReplies"][number]>) { setMessages((current) => current.map((message, index) => index === messageIndex ? { ...message, quickReplies: message.quickReplies.map((qr) => qr.id === quickReplyId ? { ...qr, ...patch } : qr) } : message)); }
  function updateQuickReplyTree(messageIndex: number, quickReplyId: string, updater: (quickReply: MessageDraft["quickReplies"][number]) => MessageDraft["quickReplies"][number]) {
    setMessages((current) => current.map((message, index) => {
      if (index !== messageIndex) return message;
      const updateTree = (replies: MessageDraft["quickReplies"]): MessageDraft["quickReplies"] =>
        replies.map((reply) => {
          if (reply.id === quickReplyId) return updater(reply);
          if (reply.destinationQuickReplies.length) {
            return { ...reply, destinationQuickReplies: updateTree(reply.destinationQuickReplies) };
          }
          return reply;
        });
      return { ...message, quickReplies: updateTree(message.quickReplies) };
    }));
  }

  function removeQuickReply(messageIndex: number, quickReplyId: string) { setMessages((current) => current.map((message, index) => index === messageIndex ? { ...message, quickReplies: message.quickReplies.filter((qr) => qr.id !== quickReplyId) } : message)); }

  async function createAutomation(): Promise<string> {
    if (!selectedAccountId) throw new Error("اکانت فعال Instagram پیدا نشد.");
    const source=type!=="STORY"&&replyMode==="existing"?previousRules.find(x=>x.id===previousId):null;
    if(type!=="STORY"&&replyMode==="existing"&&!source)throw new Error("یک پاسخ قبلی انتخاب کن.");
    if(source){
      const response=await fetch("/api/automations/"+encodeURIComponent(source.id),{
        method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({isActive:true}),
      });
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.error||"فعال‌سازی پاسخ قبلی ناموفق بود.");
      return source.id;
    }

    // Post/reel/carousel creation uses one atomic request even if a DM is
    // attached. The publishing job still links its automation after creation.
    if (type !== "STORY") {
      const normalizedKeywords = automationKeywords.map(word => word.trim()).filter(Boolean);
      const replyText = directMessageText.trim();
      if (!normalizedKeywords.length) throw new Error("حداقل یک کلمه کلیدی اضافه کن.");
      if (requireFollow && !followGateText.trim()) throw new Error("متن درخواست فالو را وارد کن.");
      const response = await fetch("/api/automations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          triggerType: "COMMENT_KEYWORD",
          keyword: normalizedKeywords.join(","),
          keywordMatchMode: "EXACT",
          mediaId: `pending:${crypto.randomUUID()}`,
          commentReplyVariants: validatePublicCommentReplies(publishingCommentReplies),
          sendDm: Boolean(replyText),
          requireFollow,
          followGateText: requireFollow ? followGateText.trim() : null,
          isActive: true,
          messages: replyText ? [{messageType:"TEXT",text:replyText,quickReplies:[]}] : [],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.id)
        throw new Error(result.error || "ساخت پاسخ خودکار ناموفق بود.");
      return result.data.id as string;
    }

    const storyKeywords = keywords.trim();
    if (!storyKeywords) throw new Error("حداقل یک کلمه کلیدی ریپلای استوری وارد کن.");
    validateMessages(messages);
    if (requireFollow && !followGateText.trim()) throw new Error("متن درخواست فالو را وارد کن.");
    const serializeQuickReplyTree = (replies: MessageDraft["quickReplies"]): unknown[] =>
      replies.map(reply => ({
        isExit: Boolean(reply.isExit),
        title: reply.title.trim(), payload: reply.payload,
        destinationType: reply.destinationType,
        destinationText: reply.destinationText.trim(),
        destinationFormId: reply.destinationFormId,
        destinationShowcaseId: reply.destinationShowcaseId,
        destinationMediaUrl: reply.destinationMediaUrl,
        destinationMediaId: reply.destinationMediaId,
        destinationQuestion: reply.destinationQuestion.trim(),
        destinationQuickReplies: serializeQuickReplyTree(reply.destinationQuickReplies),
      }));
    const preparedMessages = messages.map(message => ({
      messageType: message.messageType,
      text: message.text.trim() || null,
      mediaUrl: message.mediaUrl.trim() || null,
      mediaId: message.mediaId.trim() || null,
      showcaseId: message.showcaseId || null,
      formId: message.formId || null,
      quickReplies: serializeQuickReplyTree(message.quickReplies),
    }));
    const response = await fetch("/api/automations", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instagramAccountId: selectedAccountId,
        triggerType: "STORY_REPLY_KEYWORD",
        keyword: storyKeywords,
        // This automation stays inactive until the scheduled story publishes.
        mediaId: `pending:${crypto.randomUUID()}`,
        sendDm: true,
        likeStoryReply,
        requireFollow,
        followGateText: requireFollow ? followGateText.trim() : null,
        isActive: false,
        messages: preparedMessages,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.data?.id)
      throw new Error(result.error || "ساخت پاسخ استوری ناموفق بود.");
    return result.data.id as string;
  }

  async function createJob(publishNow: boolean, confirmedStoryReplacement = false) {
    const accountId = selectedAccountId;
    if (!accountId) { setError("اکانت فعال Instagram پیدا نشد."); return; }
    if (!uploadedMedia.length) { setError("ابتدا فایل را آپلود کنید."); return; }
    if (type === "CAROUSEL" && uploadedMedia.length < 2) { setError("پست اسلایدی باید حداقل ۲ اسلاید داشته باشد."); return; }
    if (type !== "CAROUSEL" && uploadedMedia.length !== 1) { setError(`${typeLabels[type]} باید دقیقاً یک فایل داشته باشد.`); return; }
    if (type === "REEL" && (reelCoverUploading || (reelOptions.coverMode === "upload" && !reelOptions.coverUrl))) { setError("آپلود کاور را کامل کن یا روش کاور را تغییر بده."); return; }
    const selectedScheduleDate = !publishNow ? stage6Date : scheduledDate;
    const selectedHour = !publishNow ? stage6Hour : hour;
    const selectedMinute = !publishNow ? stage6Minute : minute;
    if (!publishNow && (!selectedScheduleDate || selectedHour === null || selectedMinute === null)) {
      setError("تاریخ، ساعت و دقیقه انتشار را انتخاب کن.");
      return;
    }
    const scheduled = selectedScheduleDate && selectedHour !== null && selectedMinute !== null
      ? jalaliDateTimeToDate(selectedScheduleDate, selectedHour, selectedMinute)
      : null;
    const scheduledTimestamp = scheduled?.getTime() ?? null;
    const scheduledAt = scheduled?.toISOString() ?? null;
    if (!publishNow && scheduledTimestamp === null) {
      setError("زمان انتشار را انتخاب کن.");
      return;
    }
    if (!publishNow && scheduledTimestamp !== null) {
      const now = Date.now();
      if (scheduledTimestamp <= now) {
        setError("زمان انتخاب‌شده باید در آینده باشد.");
        return;
      }
      if (scheduledTimestamp > now + 48 * 60 * 60 * 1000) {
        setError("زمان انتشار باید حداکثر تا ۴۸ ساعت آینده باشد.");
        return;
      }
    }
    if(type==="STORY"&&automationEnabled&&!confirmedStoryReplacement) {
      try{
        const response=await fetch("/api/automations?instagramAccountId="+encodeURIComponent(accountId),{
          credentials:"include",cache:"no-store",
        });
        const result=await response.json();
        if(!response.ok||!result.success||!Array.isArray(result.data))
          throw new Error(result.error||"بررسی پاسخ فعال استوری ناموفق بود.");
        const rules: Array<{triggerType:string;isActive:boolean;keyword?:string|null}> = result.data;
        const active=rules.filter(rule=>rule.triggerType==="STORY_REPLY_KEYWORD"&&rule.isActive);
        if(active.length){
          setConfirmStoryPublishingReplacement({
            keywords:active.map(rule=>(rule.keyword||"بدون کلمه کلیدی").replace(/,/g,"، ")),
            publishNow,
          });
          return;
        }
      }catch(error){setError(error instanceof Error?error.message:"بررسی پاسخ فعال ناموفق بود.");return;}
    }
    try {
      setPublishing(true); setError("");
      const automationId = automationEnabled ? await createAutomation() : null;
      const response = await fetch("/api/instagram/publishing", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          instagramAccountId: accountId,
          type,
          caption: type === "STORY" ? null : caption.trim() || null,
          userTags: type === "CAROUSEL"
            ? {
              media: uploadedMedia.reduce<Record<string, Array<{ username: string }>>>((accumulator, item) => {
                const usernames = taggedUsersByMedia[item.storageKey] ?? [];
                if (usernames.length) accumulator[item.storageKey] = usernames.map((username) => ({ username }));
                return accumulator;
              }, {})
            }
            : (taggedUsersByMedia[uploadedMedia[0]?.storageKey ?? ""] ?? []).map((username) => ({ username })),
          scheduledAt: publishNow ? null : scheduledAt,
          idempotencyKey: crypto.randomUUID(),
          ...(type === "REEL" ? { reelOptions } : {}),
          commentAutomationId: type === "STORY" ? null : automationId,
          storyReplyAutomationId: type === "STORY" ? automationId : null,
          media: uploadedMedia,
        })
      });
      const result = await response.json();
      if (!response.ok) { if (automationId && (type==="STORY"||replyMode!=="existing")) await fetch(`/api/automations/${automationId}`, { method: "DELETE" }).catch(() => undefined); throw new Error(result.message || "ساخت Publishing Job ناموفق بود."); }
      const job = result.data as Job;
      if (publishNow) {
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        setActivePublishJobId(job.id);
        setActiveTab("queue");
        setPublishResultVisible(true);
        setPublishResult(null);
        knownJobIdsRef.current.add(job.id);

        // Return to stage 1 immediately. The polling loop keeps watching this job
        // and loadJobs will show the success/failure toast when the final status arrives.
        animateStepChange(() => {
          clearLocalMedia();
          setSelectionConfirmed(false);
          setCaptionStepConfirmed(false);
          setTagStepConfirmed(false);
          setAutomationChoiceStepStarted(false);
          setAutomationChoiceConfirmed(false);
          setAutomationSetupConfirmed(false);
          setAutomationKeywordDraft("");
          setAutomationKeywords([]);
          setDirectMessageText("");
          setPublishingCommentReplies(["", "", ""]);
          setTaggedUsersByMedia({});
          setTagDraftByMedia({});
          setTagInputError("");
          setCaption("");
          setReelOptions({ ...DEFAULT_REEL_OPTIONS });
          setUploadedMedia([]);
          setShowUploadedMediaPreview(false);
          resetAutomation();
          setUploadProgress(0);
          setUploadSuccess(false);
          setError("");
        });

        const publishResponse = await fetch(`/api/instagram/publishing/${job.id}/publish`, { method: "POST" });
        const publishResult = await publishResponse.json();
        if (!publishResponse.ok) {
          setPublishResult("FAILED");
          toast.error(publishResult.message || `${typeLabels[type]} در اینستاگرام منتشر نشد.`, { icon: <CircleSlash2 size={18} className="text-[var(--daira-error-text)]" /> });
          window.setTimeout(() => {
            setPublishResultVisible(false);
            setActivePublishJobId(null);
            setPublishResult(null);
          }, 850);
          throw new Error(publishResult.message || "انتشار ناموفق بود.");
        }
      } else {
        knownJobIdsRef.current.add(job.id);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        setActiveTab("queue");
        toast.success(`${typeLabels[type]} برای زمان ${formatScheduledLabel(scheduled!)} تنظیم شد.`, { icon: <Clock3 size={18} className="text-[var(--daira-primary)]" /> });
        setCaption(""); setReelOptions({ ...DEFAULT_REEL_OPTIONS }); setUploadedMedia([]); setShowUploadedMediaPreview(false); resetAutomation(); setUploadProgress(0); setScheduledDate(todayJalali); setHour(officialTehranClock.hour); setMinute(officialTehranClock.minute); setStage6Date(todayJalali); setStage6Hour(officialTehranClock.hour); setStage6Minute(officialTehranClock.minute);
        animateStepChange(() => {
          clearLocalMedia();
          setSelectionConfirmed(false);
          setCaptionStepConfirmed(false);
          setTagStepConfirmed(false);
          setAutomationChoiceStepStarted(false);
          setAutomationChoiceConfirmed(false);
          setAutomationSetupConfirmed(false);
          setAutomationKeywordDraft("");
          setAutomationKeywords([]);
          setDirectMessageText("");
          setTaggedUsersByMedia({});
          setTagDraftByMedia({});
          setTagInputError("");
          setError("");
        });
        await loadJobs(true);
        return;
      }
      setCaption(""); setUploadedMedia([]); setShowUploadedMediaPreview(false); resetAutomation(); setUploadProgress(0); setScheduledDate(currentJalaliDate()); await loadJobs(true);
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در انتشار محتوا."); } finally { setPublishing(false); }
  }

  async function retryJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}/retry`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Retry ناموفق بود."); await loadJobs(true); } catch (e) { setError(e instanceof Error ? e.message : "Retry ناموفق بود."); } }
  async function cancelJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "لغو ناموفق بود."); await loadJobs(true); } catch (e) { setError(e instanceof Error ? e.message : "لغو ناموفق بود."); } }


  const canUpload = type === "CAROUSEL" ? uploadedMedia.length + media.length < 10 : uploadedMedia.length + media.length < 1;
  const hasDraft = uploadedMedia.length > 0 || media.length > 0 || Boolean(caption.trim()) || automationEnabled || (type === "REEL" && JSON.stringify(reelOptions) !== JSON.stringify(DEFAULT_REEL_OPTIONS));
  const canSubmitMedia = uploadedMedia.length >= (type === "CAROUSEL" ? 2 : 1) && !uploading && !media.length;
  const canSubmitAutomation = !automationEnabled || (type === "STORY"
      ? storyResponseSaved && !storyResponseEditing && !storyResponseDirty
    : replyMode==="existing"
      ? Boolean(previousId)
      : automationKeywords.length > 0 && publishingCommentReplies.length >= 3 && publishingCommentReplies.length <= 5 && publishingCommentReplies.every(text=>text.trim().length>0&&text.trim().length<=2000) && new Set(publishingCommentReplies.map(text=>text.trim())).size===publishingCommentReplies.length);
  function changeContentType(nextType: PublishType) {
    if (nextType === type || uploading || reelCoverUploading || publishing) return;
    if (hasDraft && !window.confirm("با تغییر نوع محتوا، رسانه‌های آپلودشده و تنظیمات فعلی حذف می‌شوند. ادامه می‌دهید؟")) return;
    handleTypeChange(nextType);
  }

  const canPublish = canSubmitMedia && canSubmitAutomation && !publishing && !reelCoverUploading && (type !== "REEL" || reelOptions.coverMode !== "upload" || Boolean(reelOptions.coverUrl));
  const acceptedVideos = "video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/mpeg,video/3gpp,video/mp2t,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.mpeg,.mpg,.mts,.m2ts";
  const accept = type === "REEL" ? acceptedVideos : type === "STORY" || type === "CAROUSEL" ? "image/jpeg,image/png,image/webp," + acceptedVideos : "image/jpeg,image/png,image/webp";

  return (
    <div dir="rtl" className="daira-publishing-glass min-h-full bg-transparent px-1 py-2 pb-24 sm:px-2 sm:py-3 sm:pb-10">
      <div className="mx-auto w-full max-w-4xl">
        <nav ref={publishingTabsRef} className="daira-publishing-tabs mb-5 grid grid-cols-2 gap-2 rounded-[20px] bg-[var(--daira-section-alt)] p-1.5" aria-label="بخش‌های انتشار">
          <button type="button" onClick={()=>setActiveTab("create")} aria-current={activeTab==="create"?"page":undefined}
            className={"flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold transition "+(activeTab==="create"?"bg-white text-[var(--daira-primary)] shadow-sm":"text-[var(--daira-text-secondary)]")}>
            <ImagePlus size={18}/> انتشار محتوا
          </button>
          <button type="button" onClick={()=>setActiveTab("queue")} aria-current={activeTab==="queue"?"page":undefined}
            className={"flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold transition "+(activeTab==="queue"?"bg-white text-[var(--daira-primary)] shadow-sm":"text-[var(--daira-text-secondary)]")}>
            <CalendarClock size={18}/> صف انتشار
          </button>
        </nav>
        {activeTab==="queue" ? (
          <PublishingQueue jobs={jobs} loading={loading} error={error} onRetry={retryJob} onCancel={cancelJob} onRefresh={loadJobs}/>
        ) : loading ? <PublishingPageSkeleton/> : (
          <div className="space-y-5 pb-7">
            <section aria-label="نوع محتوا" className="rounded-[22px] border border-[var(--daira-publishing-border)] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <h1 className="text-base font-extrabold text-[var(--daira-heading)]">انتشار محتوای جدید</h1>
                <p className="mt-1 text-xs leading-6 text-[var(--daira-text-secondary)]">نوع محتوا را انتخاب کن؛ تمام تنظیمات مربوط به آن در همین صفحه است.</p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3" role="group" aria-label="انتخاب نوع محتوا">
                {([["POST","پست",ImagePlus],["REEL","ریلز",Clapperboard],["CAROUSEL","پست اسلایدی",Images],["STORY","استوری",Camera]] as const).map(([value,label,Icon])=>{
                  const selected=type===value;
                  return <button key={value} type="button" disabled={uploading||reelCoverUploading||publishing} aria-pressed={selected} onClick={()=>changeContentType(value)}
                    className={"relative flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl border px-1.5 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)] disabled:opacity-50 "+(selected?"border-[var(--daira-primary)] bg-[var(--daira-publishing-selected)] text-[var(--daira-primary)]":"border-[var(--daira-border)] bg-[var(--daira-surface-hover)] text-[var(--daira-text-secondary)] hover:border-[var(--daira-brand-300)]")}>
                    <Icon size={22} strokeWidth={1.8}/>
                    <span className="text-[11px] font-bold sm:text-xs">{label}</span>
                    {selected&&<CheckCircle2 size={14} className="absolute left-2 top-2 text-[var(--daira-primary)]"/>}
                  </button>;
                })}
              </div>
            </section>

            <section aria-label="رسانه محتوا" className="space-y-3">
              <PublishingSectionGuide number={1} title="افزودن رسانه">
                {type==="POST"?"یک عکس برای پست انتخاب کن.":type==="REEL"?"ویدیوی ریلز را بارگذاری کن.":type==="CAROUSEL"?"بین ۲ تا ۱۰ تصویر یا ویدیو اضافه کن؛ ترتیب اسلایدها قابل جابه‌جایی است.":"یک عکس یا ویدیو برای استوری انتخاب کن."}
              </PublishingSectionGuide>
              <div className="rounded-[22px] border border-[var(--daira-publishing-border)] bg-white p-4 shadow-sm sm:p-5">
                {type!=="CAROUSEL" && uploadedMedia[0] ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                    <div className="mx-auto w-full max-w-[200px] shrink-0 sm:mx-0 sm:w-44">
                      <MediaTile item={uploadedMedia[0]} type={type} onRemove={()=>void removeUploaded(uploadedMedia[0])} ready/>
                    </div>
                    <div className="min-w-0 flex-1 space-y-3 text-center sm:text-right">
                      <div className="flex items-center justify-center gap-2 text-[var(--daira-chart-increase)] sm:justify-start"><CheckCircle2 size={19}/><strong className="text-sm">رسانه آماده است</strong></div>
                      <p dir="auto" className="truncate text-xs text-[var(--daira-text-secondary)]">{uploadedMedia[0].fileName}</p>
                      <button type="button" onClick={()=>void removeUploaded(uploadedMedia[0])}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--daira-publishing-border)] bg-[var(--daira-surface-hover)] px-4 text-xs font-bold text-[var(--daira-heading)]"><Trash2 size={15}/> جایگزینی فایل</button>
                    </div>
                  </div>
                ) : canUpload ? (
                  <UploadArea id="publishing-media-upload" accept={accept} multiple={type==="CAROUSEL"}
                    disabled={publishing || !canUpload} isDragging={isDragging} setIsDragging={setIsDragging}
                    title={uploadTitle} onChange={handleFiles} onDrop={handleDrop}/>
                ) : type!=="CAROUSEL" && uploading ? (
                  <div role="status" className="rounded-xl bg-[var(--daira-upload-bg)] p-5 text-center">
                    <Loader2 className="mx-auto mb-2 animate-spin text-[var(--daira-primary)]" size={22}/>
                    <p className="text-xs text-[var(--daira-text-secondary)]">در حال بارگذاری رسانه…</p>
                  </div>
                ) : null}
                {uploading&&type!=="CAROUSEL"&&<ProgressBar progress={uploadProgress}/>}
                {uploadRows.filter(row=>row.status==="failed").map(row=>
                  <div key={row.id} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] p-3">
                    <p className="min-w-0 flex-1 text-xs leading-6 text-[var(--daira-error-text)]">{row.fileName}: {row.error||"آپلود ناموفق بود."}</p>
                    <button type="button" onClick={()=>retryLocalUpload(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[var(--daira-error-text)]"><RotateCcw size={14}/>تلاش دوباره</button>
                    <button type="button" onClick={()=>removeLocalById(row.id)} aria-label={"حذف فایل ناموفق "+row.fileName} className="rounded-lg border border-[var(--daira-error-border)] bg-white p-2 text-[var(--daira-error-text)]"><Trash2 size={14}/></button>
                  </div>
                )}
                                      {type === "CAROUSEL" && uploadRows.length > 0 && (
                        <DndContext
                          sensors={sensors}
                          modifiers={[restrictSlideDragToList]}
                          collisionDetection={closestCenter}
                          onDragEnd={(event: DragEndEvent) => {
                            if (!event.over || event.active.id === event.over.id) return;
                            moveUploadedSlide(String(event.active.id), String(event.over.id));
                          }}
                        >
                          <SortableContext items={uploadedMedia.map((item) => item.storageKey)} strategy={verticalListSortingStrategy}>
                            <div ref={slideListRef} className="mt-4 space-y-2" aria-live="polite">
                              {uploadRows.map((row, rowPosition) => {
                            const slideIndex = row.storageKey ? uploadedMedia.findIndex((item) => item.storageKey === row.storageKey) : -1;
                            const slide = slideIndex >= 0 ? uploadedMedia[slideIndex] : null;
                            const isCarouselSlide = type === "CAROUSEL" && Boolean(slide);
                            return (
                              <div key={row.id} className="relative flex items-stretch gap-2">
                                {type === "CAROUSEL" && <span className="flex w-12 shrink-0 items-center justify-center self-stretch whitespace-nowrap px-1 text-[11px] font-bold tabular-nums text-[var(--daira-text-secondary)]">{"اسلاید " + toPersianDigits(slideIndex >= 0 ? slideIndex + 1 : rowPosition + 1)}</span>}
                                <SortableSlideShell
                                id={row.storageKey ?? row.id}
                                disabled={!isCarouselSlide || row.status !== "success" || Boolean(row.removing)}
                                className="relative min-w-0 flex-1"
                              >
                                <div className={["relative flex-1 overflow-hidden rounded-[17px] border px-3 py-3 shadow-[0_2px_10px_rgba(22,54,110,.025)] transition-[border-color,background-color,opacity] duration-150 ease-out", row.removing ? "max-h-0 -translate-y-1 !border-transparent !p-0 opacity-0" : "max-h-36 opacity-100", row.status === "failed" ? "border-[var(--daira-error-border)] bg-[var(--daira-error-background)]" : row.status === "success" && slide ? "border-[var(--daira-publishing-border)] bg-[var(--daira-upload-bg)]" : row.status === "success" ? "border-[var(--daira-success-border)] bg-[var(--daira-success-bg)]" : "border-[var(--daira-border)] bg-white", isCarouselSlide ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
                                >
                                <div className="flex items-center gap-3">
                                  {slide ? (
                                    <span className="flex h-[68px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--daira-publishing-border)] bg-white">
                                      {slide.type === "IMAGE" ? <img src={slide.publicUrl} alt={slide.fileName} className="h-full w-full object-cover" /> : <video src={slide.publicUrl} muted preload="metadata" className="h-full w-full object-cover" />}
                                    </span>
                                  ) : (
                                    <span className="flex h-[68px] w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--daira-publishing-border)] bg-white text-[var(--daira-text-secondary)]">
                                      {row.status === "failed" ? <CircleSlash2 size={17} className="text-[var(--daira-error-text)]" /> : row.status === "uploading" ? <Loader2 size={17} className="animate-spin text-[var(--daira-primary)]" /> : <Images size={17} />}
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="max-w-full truncate text-xs font-semibold text-[var(--daira-heading)]" dir="auto">{row.fileName}</p>

                                    </div>
                                    <p className={["mt-1 text-[11px] font-medium", row.status === "failed" ? "text-[var(--daira-error-text)]" : row.status === "success" ? "text-[var(--daira-chart-increase)]" : "text-[var(--daira-text-secondary)]"].join(" ")}>
                                      {row.status === "queued" ? "در صف آپلود" : row.status === "uploading" ? `در حال آپلود · ${toPersianDigits(row.progress)}٪` : row.status === "success" ? "آپلود با موفقیت انجام شد · برای جابه‌جایی نگه دار و بکش" : "آپلود ناموفق بود"}
                                    </p>
                                    {(row.status === "queued" || row.status === "uploading" || row.status === "failed") && (
                                      <div className={["mt-2 h-1.5 overflow-hidden rounded-full", row.status === "failed" ? "bg-[var(--daira-error-background)]" : "bg-[var(--daira-border)]"].join(" ")}>
                                        <div className={["h-full rounded-full transition-[width] duration-150", row.status === "failed" ? "bg-[var(--daira-error-text)]" : "bg-[var(--daira-primary)]"].join(" ")} style={{ width: `${Math.max(row.status === "failed" ? 3 : 0, Math.min(100, row.progress))}%` }} />
                                      </div>
                                    )}
                                    {row.error && <p className="mt-2 text-[11px] leading-5 text-[var(--daira-error-text)]">{row.error}</p>}
                                  </div>
                                  {row.status === "failed" && <button type="button" onClick={() => retryLocalUpload(row.id)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[var(--daira-error-text)] px-2.5 text-[11px] font-bold text-white"><RotateCcw size={13} />تلاش دوباره</button>}
                                  {row.status === "success" && slide && <button type="button" onClick={() => void removeUploaded(slide)} aria-label="حذف اسلاید از پست اسلایدی" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--daira-error-border)] bg-white text-[var(--daira-error-text)] hover:bg-[var(--daira-error-background)]"><X size={16} /></button>}
                                  {row.status !== "success" && <button type="button" onClick={() => removeLocalById(row.id)} aria-label="حذف فایل از صف آپلود" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--daira-text-secondary)] hover:bg-black/5 hover:text-[var(--daira-error-text)]"><X size={16} /></button>}
                                </div>
                                </div>
                              </SortableSlideShell>
                              </div>
                            );
                          })}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}


                {type==="CAROUSEL" && uploadedMedia.length>0 && <p className="mt-3 rounded-xl bg-[var(--daira-upload-bg)] px-3 py-2.5 text-xs leading-6 text-[var(--daira-text-secondary)]">
                  {toPersianDigits(uploadedMedia.length)} اسلاید از ۱۰ آماده است؛ برای تغییر ترتیب، اسلاید را بگیر و جابه‌جا کن.
                </p>}
              </div>
            </section>

            {type==="REEL" && (
              <section aria-label="تنظیمات ریلز" className="space-y-3">
                <PublishingSectionGuide number={2} title="تنظیمات ریلز">
                  کاور ریلز و نمایش آن در فید را به‌دلخواه تنظیم کن. هر دو اختیاری‌اند.
                </PublishingSectionGuide>
                <ReelSettingsFields value={reelOptions} onChange={setReelOptions} videoUrl={uploadedMedia[0]?.publicUrl ?? media[0]?.previewUrl ?? null} disabled={publishing || uploading} onBusyChange={setReelCoverUploading}/>
              </section>
            )}

            {type!=="STORY" && (
              <section aria-label="جزئیات محتوا" className="space-y-3">
                <PublishingSectionGuide number={type==="REEL"?3:2} title="جزئیات محتوا">
                  کپشن را بنویس؛ در صورت نیاز، تگ کاربران را برای هر رسانه اضافه کن.
                </PublishingSectionGuide>
                <div className="mx-auto w-full max-w-4xl space-y-4">
                <section className="w-full rounded-2xl border border-[var(--daira-border)] bg-white p-4 shadow-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--daira-publishing-border)] bg-[var(--daira-upload-bg)] px-4 py-3.5">
                    <div>
                      <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--daira-publishing-selected)] text-xs font-bold text-[var(--daira-primary)]">۲</span><h2 className="text-sm font-bold text-[var(--daira-heading)]">کپشن</h2></div>
                      <p className="mt-1.5 text-xs leading-5 text-[var(--daira-text-secondary)]">{`کپشن ${typeLabels[type]} را بنویس.`}</p>
                    </div>
                    <span className="text-[11px] text-[var(--daira-text-secondary)]">{toPersianDigits(caption.length)} / ۲۲۰۰</span>
                  </div>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    maxLength={2200}
                    rows={5}
                    inputMode="text"
                    autoCapitalize="sentences"
                    spellCheck
                    style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}
                    className="w-full resize-none rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10"
                    placeholder={`کپشن ${typeLabels[type]} را بنویس...`}
                  />
                </section>
                <section className="w-full rounded-[22px] border border-[var(--daira-border)] bg-white p-4 shadow-sm sm:p-6">
                  <button type="button" onClick={()=>setShowTags(value=>!value)} aria-expanded={showTags} aria-controls="publishing-tags-panel"
                    className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl p-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--daira-primary)]">
                    <span className="flex items-start gap-3">

                      <span><span className="block text-sm font-bold text-[var(--daira-heading)]">تگ کردن کاربران <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></span>
                        <span className="mt-1 block text-xs leading-6 text-[var(--daira-text-secondary)]">{Object.values(taggedUsersByMedia).reduce((sum,list)=>sum+list.length,0).toLocaleString("fa-IR")} تگ ثبت‌شده — برای ویرایش باز کنید</span></span>
                    </span>
                    <ChevronDown size={18} className={"shrink-0 text-[var(--daira-text-secondary)] transition-transform "+(showTags?"rotate-180":"")}/>
                  </button>
                  {showTags && <div id="publishing-tags-panel" className="mt-4 border-t border-[var(--daira-border)] pt-4">
                  {tagInputError && <p role="alert" className="mb-3 rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] p-3 text-xs text-[var(--daira-error-text)]">{tagInputError}</p>}
                  <div className="space-y-3">
                    {uploadedMedia.length === 0 && (
                      <p className="text-xs leading-6 text-[var(--daira-text-secondary)]">برای فعال‌شدن دکمه افزودن تگ، ابتدا رسانه را آپلود کن.</p>
                    )}
                    {(uploadedMedia.length ? uploadedMedia : [null]).map((item, index) => {
                      const mediaKey = item?.storageKey ?? "__pending__";
                      const tags = taggedUsersByMedia[mediaKey] ?? [];
                      const draft = tagDraftByMedia[mediaKey] ?? "";
                      return (
                        <div key={mediaKey} className="rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3.5 sm:p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--daira-heading)]">{!item ? "تگ‌های محتوا" : type === "CAROUSEL" ? `اسلاید ${toPersianDigits(index + 1)}` : typeLabels[type]}</p>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[var(--daira-text-secondary)] ring-1 ring-[var(--daira-border)]">{toPersianDigits(tags.length)} تگ</span>
                          </div>
                          {tags.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                              {tags.map((username) => (
                                <span key={username} className="inline-flex items-center gap-1 rounded-full bg-[var(--daira-outline-hover-bg)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--daira-primary)] ring-1 ring-[var(--daira-outline-active-bg)]">
                                  <span dir="ltr">@{username}</span>
                                  <button type="button" onClick={() => removeTagForMedia(mediaKey, username)} className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--daira-text-secondary)] hover:bg-white hover:text-[var(--daira-error-text)]" aria-label={`حذف تگ @${username}`}>
                                    <X size={11} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {type === "CAROUSEL" && item && (
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--daira-border)] bg-white">
                                <MediaTile item={item} type="CAROUSEL" onRemove={() => void removeUploaded(item)} ready compact />
                              </div>
                            )}
                            <input value={draft} onChange={(event) => handleTagInputChange(mediaKey, event.target.value)} onKeyDown={(event) => handleTagInputKeyDown(mediaKey, event)} placeholder="نام کاربر بدون @" maxLength={30} inputMode="text" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-2.5 !text-base leading-5 text-[var(--daira-heading)] outline-none placeholder:text-xs placeholder:text-[var(--daira-text-disabled)] focus:border-[var(--daira-primary)] focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                            <Button type="button" onClick={() => addTagForMedia(mediaKey)} disabled={!item || !draft.trim()} className="shrink-0 rounded-lg !bg-[var(--daira-primary)] px-3.5 py-2.5 text-xs font-semibold text-white hover:!bg-[var(--daira-primary-hover)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:!bg-[var(--daira-border)] disabled:!text-[var(--daira-text-disabled)] disabled:opacity-100 disabled:hover:!bg-[var(--daira-border)]">افزودن</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>}
                </section>
                
              </div>
              </section>
            )}

            <section aria-label="پاسخ خودکار" className="space-y-3">
              <PublishingSectionGuide number={type==="STORY"?2:3} title="پاسخ خودکار (اختیاری)">
                {type==="STORY"?"پاسخ استوری برای تمام استوری‌های پیج فعال است. پاسخ جدید هنگام انتشار موفق، جای پاسخ فعال قبلی را می‌گیرد.":"اگر می‌خواهی به کامنت‌ها و دایرکت‌ها پاسخ داده شود، این بخش را فعال کن."}
              </PublishingSectionGuide>
              <div className="rounded-[22px] border border-[var(--daira-publishing-border)] bg-white p-4 shadow-sm sm:p-5">
                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0"><strong className="block text-sm text-[var(--daira-heading)]">فعال‌سازی پاسخ خودکار</strong>
                    <span className="mt-1 block text-xs leading-6 text-[var(--daira-text-secondary)]">بدون فعال‌سازی، محتوا عادی منتشر می‌شود.</span></span>
                  <input type="checkbox" role="switch" checked={automationEnabled} disabled={publishing} onChange={e=>handleAutomationChoice(e.target.checked)} className="daira-form-switch shrink-0 -scale-x-100"/>
                </label>
              </div>
              {automationEnabled && type!=="STORY" && <div className="mx-auto w-full max-w-2xl space-y-3">
                <ResponseModeSwitcher value={replyMode} existingAvailable={previousRules.length>0}
                  loading={previousLoading} disabled={publishing} onChange={v=>{setReplyMode(v);setPreviousId("");}}/>
                {replyMode==="existing" && <div className="space-y-3">
                  <CompleteAutomationPicker items={previousRules} selected={previousRules.find(x=>x.id===previousId)||null}
                    onSelect={item=>setPreviousId(item.id)} onChange={()=>setPreviousId("")}
                    kind="COMMENT_KEYWORD" showcases={showcases} forms={forms} disabled={publishing}/>
                  <p className="text-xs text-[var(--daira-text-secondary)]">پاسخ انتخاب‌شده روی این محتوا اعمال می‌شود و از فهرست پاسخ‌های موجود قابل ویرایش است.</p>
                </div>}
              </div>}
              {automationEnabled && (type==="STORY"||replyMode==="new") && (type==="STORY" ? <div className="mx-auto w-full max-w-2xl">
                

                <section className="space-y-5 rounded-2xl border border-[var(--daira-border)] bg-white p-4 shadow-sm sm:p-6">
                  

                  <fieldset disabled={storyResponseSaved && !storyResponseEditing}>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">کلمات کلیدی Reply استوری</label>
                      <p className="mb-3 text-xs leading-5 text-[var(--daira-text-secondary)]">با وارد شدن این کلمات در Reply استوری، پاسخ خودکار فعال می‌شود.</p>
                      {keywords.trim() && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean).map((keyword) => (
                            <span key={keyword} className="daira-keyword-chip inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]">
                              <span>{keyword}</span>
                              <button type="button" onClick={() => { setKeywords(keywords.split(",").map(item => item.trim()).filter(item => item && item !== keyword).join(",")); if (storyResponseEditing) setStoryResponseDirty(true); }} aria-label={`حذف ${keyword}`} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="daira-keyword-field flex items-center gap-2">
                        <input id="publishing-story-keyword" value={automationKeywordDraft} onChange={event => setAutomationKeywordDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); const value = automationKeywordDraft.trim(); const current = keywords.split(",").map(item => item.trim()).filter(Boolean); if (value && !current.includes(value)) setKeywords(current.concat(value).join(",")); if (storyResponseEditing) setStoryResponseDirty(true); setAutomationKeywordDraft(""); } }} placeholder="مثلاً قیمت، اطلاعات" inputMode="text" className="min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 !text-base leading-5 text-[var(--daira-heading)] outline-none placeholder:text-xs placeholder:text-[var(--daira-text-disabled)] focus:border-[var(--daira-primary)] focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                        <Button type="button" onClick={() => { const value = automationKeywordDraft.trim(); const current = keywords.split(",").map(item => item.trim()).filter(Boolean); if (value && !current.includes(value)) setKeywords(current.concat(value).join(",")); setAutomationKeywordDraft(""); }} disabled={!automationKeywordDraft.trim() || keywords.split(",").map(item => item.trim()).filter(Boolean).includes(automationKeywordDraft.trim())} className="min-h-11 shrink-0 rounded-lg !bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white hover:!bg-[var(--daira-primary-hover)] disabled:!bg-[var(--daira-border)] disabled:!text-[var(--daira-text-disabled)]">افزودن</Button>
                      </div>
                    </div>
                  </fieldset>

                  <PublishingStoryAutomationSetup
                    storyCreateMode
                    responseTypeTitle="نوع پاسخ خودکار"
                    responseTypeDescription="نوع محتوایی را که در پاسخ به استوری فرستاده می‌شود انتخاب کن."
                    ref={storyAutomationSetupRef}
                    message={messages[0] ?? createEmptyMessage()}
                    showcases={showcases}
                    forms={forms}
                    loadingResources={loadingResources}
                    instagramAccountId={selectedAccountId}
                    disabled={storyResponseSaved && !storyResponseEditing}
                    onUpdate={(patch) => {
                      updateMessage(0, patch);
                      if (storyResponseEditing) setStoryResponseDirty(true);
                    }}
                    onSavedChange={setStoryResponseSaved}
                    keywordValid={Boolean(keywords.trim())}
                    onContinue={() => {
                      setStoryResponseSaved(true);
                      setStoryResponseEditing(false);
                      setStoryResponseDirty(false);
                      setAutomationSetupConfirmed(true);
                      setError("");
                    }}
                  />



                  <fieldset disabled={storyResponseSaved && !storyResponseEditing}>
                    <section className="space-y-3">
                      {messages[0]?.messageType === "FORM" && (
                        <div className="rounded-xl border border-[var(--daira-border)] bg-white p-3.5">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={Boolean(messages[0]?.quickReplies?.some((reply) => reply.isExit))}
                              onChange={(event) => {
                                const currentReplies = messages[0]?.quickReplies ?? [];
                                const existingExit = currentReplies.find((reply) => reply.isExit);
                                if (event.target.checked) {
                                  if (existingExit || currentReplies.length >= 13) return;
                                  const exit = createEmptyQuickReply();
                                  updateMessage(0, {
                                    quickReplies: [...currentReplies, { ...exit, isExit: true, title: "خروج از فرم", destinationType: "TEXT", destinationText: "از فرم خارج شدید." }],
                                  });
                                } else {
                                  updateMessage(0, { quickReplies: currentReplies.filter((reply) => !reply.isExit) });
                                }
                              }}
                              disabled={!messages[0]?.quickReplies?.some((reply) => reply.isExit) && (messages[0]?.quickReplies?.length ?? 0) >= 13}
                              className="mt-0.5 h-4 w-4 accent-[var(--daira-primary)]"
                            />
                            <span>
                              <span className="block text-sm font-bold text-[var(--daira-heading)]">خروج از فرم <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></span>
                              <span className="mt-1 block text-xs leading-5 text-[var(--daira-text-secondary)]">در صورت فعال‌سازی، کاربر با این گزینه از شاخه فرم خارج می‌شود.</span>
                            </span>
                          </label>

                          {messages[0]?.quickReplies?.find((reply) => reply.isExit) && (
                            <div className="mt-3 space-y-3">
                              <div>
                                <label className="mb-2 block text-xs font-bold text-[var(--daira-heading)]">متن دکمه خروج</label>
                                <input
                                  value={messages[0]?.quickReplies?.find((reply) => reply.isExit)?.title ?? ""}
                                  maxLength={20}
                                  onChange={(event) => {
                                    const exitId = messages[0]?.quickReplies?.find((reply) => reply.isExit)?.id;
                                    if (!exitId) return;
                                    updateMessage(0, { quickReplies: (messages[0]?.quickReplies ?? []).map((reply) => reply.id === exitId ? { ...reply, title: event.target.value } : reply) });
                                  }}
                                  className="w-full rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10"
                                  style={{ fontSize: "16px", WebkitTextSizeAdjust: "100%" }}
                                />
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-bold text-[var(--daira-heading)]">متن خروج از فرم</label>
                                <textarea
                                  value={messages[0]?.quickReplies?.find((reply) => reply.isExit)?.destinationText ?? ""}
                                  rows={3}
                                  maxLength={2000}
                                  onChange={(event) => {
                                    const exitId = messages[0]?.quickReplies?.find((reply) => reply.isExit)?.id;
                                    if (!exitId) return;
                                    updateMessage(0, { quickReplies: (messages[0]?.quickReplies ?? []).map((reply) => reply.id === exitId ? { ...reply, destinationText: event.target.value } : reply) });
                                  }}
                                  className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10"
                                  style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="rounded-xl border border-[var(--daira-border)] bg-white p-3.5">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input type="checkbox" checked={likeStoryReply} onChange={event => { setLikeStoryReply(event.target.checked); if (storyResponseEditing) setStoryResponseDirty(true); }} className="mt-0.5 h-4 w-4 accent-[var(--daira-primary)]" />
                          <span><span className="block text-sm font-bold text-[var(--daira-heading)]">لایک ریپلای <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></span><span className="mt-1 block text-xs leading-5 text-[var(--daira-text-secondary)]">در صورت فعال بودن، Reply استوری کاربر لایک می‌شود.</span></span>
                        </label>
                      </div>

                      <div className="rounded-xl border border-[var(--daira-border)] bg-white p-3.5">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input type="checkbox" checked={requireFollow} onChange={event => { setRequireFollow(event.target.checked); if (storyResponseEditing) setStoryResponseDirty(true); }} className="mt-0.5 h-4 w-4 accent-[var(--daira-primary)]" />
                          <span><span className="block text-sm font-bold text-[var(--daira-heading)]">اجبار به فالو <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></span><span className="mt-1 block text-xs leading-5 text-[var(--daira-text-secondary)]">در صورت فعال بودن، کاربر باید پیج را فالو کرده باشد تا پاسخ را دریافت کند.</span></span>
                        </label>
                        {requireFollow && <div className="mt-2.5">
                          <label htmlFor="publishing-follow-gate-text" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">متن درخواست فالو</label>
                          <textarea id="publishing-follow-gate-text" value={followGateText} onChange={event => { setFollowGateText(event.target.value); if (storyResponseEditing) setStoryResponseDirty(true); }} rows={2} maxLength={500} inputMode="text" placeholder="مثلاً برای دریافت اطلاعات لطفاً ابتدا پیج را فالو کنید." className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-xs focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                        </div>}
                      </div>
                    </section>
                  </fieldset>



                  {(!storyResponseSaved || storyResponseEditing) && (
                    <div className="border-t border-[var(--daira-border)] pt-4">
                      <Button type="button" onClick={() => { void storyAutomationSetupRef.current?.saveAndContinue(); }} disabled={!keywords.trim() || (messages[0]?.messageType === "TEXT" && !messages[0]?.text.trim()) || (storyResponseEditing && !storyResponseDirty)} className="w-full min-h-11 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
                        ذخیره {messages[0]?.messageType === "FORM" ? "فرم" : messages[0]?.messageType === "SHOWCASE" ? "ویترین" : messages[0]?.messageType === "TEXT" ? "متن" : messages[0]?.messageType === "IMAGE" ? "عکس" : messages[0]?.messageType === "VIDEO" ? "فیلم" : "وویس"} 
                      </Button>
                    </div>
                  )}

                  {storyResponseSaved && !storyResponseEditing && (
                    <div className="flex items-center justify-center gap-2 border-t border-[var(--daira-border)] pt-4">
                      <Button type="button" onClick={handleEditStoryResponse} className="min-h-10 flex-1 rounded-xl border border-[var(--daira-brand-300)] bg-[var(--daira-outline-hover-bg)] px-4 text-sm font-bold text-[var(--daira-primary)] hover:bg-[var(--daira-outline-active-bg)]">
                        <span dir="rtl" className="inline-flex items-center justify-center gap-1.5"><span>ویرایش</span><Pencil size={15} /></span>
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => void handleDeleteStoryResponse()} className="min-h-10 flex-1 !rounded-xl !border !border-[var(--daira-error-border)] !bg-[var(--daira-error-background)] !px-4 !text-sm !font-bold !text-[var(--daira-error-text)] hover:!bg-[var(--daira-error-background)]">
                        <span dir="rtl" className="inline-flex items-center justify-center gap-1.5"><span>حذف</span><Trash2 size={15} /></span>
                      </Button>
                    </div>
                  )}

                  {error && <div className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--daira-error-text)]" role="alert">{error}</div>}
                </section>
              </div> : <div className="mx-auto w-full max-w-2xl">
                
                <section className="space-y-5 rounded-2xl border border-[var(--daira-border)] bg-white p-4 shadow-sm sm:p-6">
                  

                  <div>
                    <label htmlFor="publishing-auto-keyword" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">کلمات کلیدی</label>
                    <p className="mb-3 text-xs leading-5 text-[var(--daira-text-secondary)]">با وارد شدن این کلمات در کامنت، پاسخ خودکار فعال می‌شود.</p>
                    {automationKeywords.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{automationKeywords.map((keyword) => <span key={keyword} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--daira-outline-hover-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--daira-primary)]"><span>{keyword}</span><button type="button" onClick={() => setAutomationKeywords(current => current.filter(item => item !== keyword))} aria-label={`حذف ${keyword}`} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-white"><X size={12} /></button></span>)}</div>}
                    <div className="daira-keyword-field flex items-center gap-2">
                        <input id="publishing-auto-keyword" value={automationKeywordDraft} onChange={event => setAutomationKeywordDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); const value = automationKeywordDraft.trim(); if (value && !automationKeywords.includes(value)) setAutomationKeywords(current => [...current, value]); setAutomationKeywordDraft(""); } }} placeholder="مثلاً قیمت، اطلاعات" inputMode="text" className="min-w-0 flex-1 rounded-lg border border-[var(--daira-outline)] bg-white px-3 py-3 !text-base leading-5 text-[var(--daira-heading)] outline-none placeholder:text-xs placeholder:text-[var(--daira-text-disabled)] focus:border-[var(--daira-primary)] focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                      <Button type="button" onClick={() => { const value = automationKeywordDraft.trim(); if (value && !automationKeywords.includes(value)) setAutomationKeywords(current => [...current, value]); setAutomationKeywordDraft(""); }} disabled={!automationKeywordDraft.trim() || automationKeywords.includes(automationKeywordDraft.trim())} className="min-h-11 shrink-0 rounded-lg !bg-[var(--daira-primary)] px-3.5 text-xs font-semibold text-white hover:!bg-[var(--daira-primary-hover)] disabled:!bg-[var(--daira-border)] disabled:!text-[var(--daira-text-disabled)]">افزودن</Button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--daira-border)] pt-5">
                    <PublishingSectionGuide number={4} title="متن‌های پاسخ زیر کامنت">برای کاهش تکرار پاسخ‌ها و احتمال شناسایی رفتار اسپم، حداقل ۳ پاسخ متفاوت بنویس. حداکثر ۵ پاسخ ثبت می‌شود و یکی به‌صورت تصادفی انتخاب خواهد شد.</PublishingSectionGuide>
                      <CommentReplyVariantsField values={publishingCommentReplies} onChange={setPublishingCommentReplies} disabled={publishing} />
                  </div>

                  <div className="border-t border-[var(--daira-border)] pt-5">
                    <label htmlFor="publishing-direct-message" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">متن ارسالی در دایرکت <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></label>
                    <textarea id="publishing-direct-message" value={directMessageText} onChange={event => setDirectMessageText(event.target.value)} rows={4} maxLength={2000} inputMode="text" placeholder="متن پیامی را که می‌خواهی در دایرکت ارسال شود بنویس..." className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-xs focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                  </div>

                  <div className="border-t border-[var(--daira-border)] pt-5">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] p-3.5">
                      <input type="checkbox" checked={requireFollow} onChange={event => setRequireFollow(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--daira-primary)]" />
                      <span><span className="block text-sm font-bold text-[var(--daira-heading)]">اجبار به فالو <span className="font-medium text-[var(--daira-primary)]">(اختیاری)</span></span><span className="mt-1 block text-xs leading-5 text-[var(--daira-text-secondary)]">در صورت فعال بودن، کاربر باید پیج را فالو کرده باشد تا پاسخ را دریافت کند.</span></span>
                    </label>
                    {requireFollow && <div className="mt-2.5">
                      <label htmlFor="publishing-follow-gate-text" className="mb-2 block text-sm font-bold text-[var(--daira-heading)]">متن درخواست فالو</label>
                      <textarea id="publishing-follow-gate-text" value={followGateText} onChange={event => setFollowGateText(event.target.value)} rows={2} maxLength={500} inputMode="text" placeholder="مثلاً برای دریافت اطلاعات لطفاً ابتدا پیج را فالو کنید." className="w-full resize-y rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)] px-3.5 py-3 !text-base leading-7 text-[var(--daira-heading)] outline-none placeholder:text-xs focus:border-[var(--daira-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--daira-primary)]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }} />
                    </div>}
                  </div>
                  

                  {error && <div className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--daira-error-text)]" role="alert">{error}</div>}
                </section>
              </div>)}
            </section>

            <section aria-label="انتشار" className="space-y-3">
              <PublishingSectionGuide number={type==="STORY"?3:4} title="زمان انتشار">
                انتشار فوری را انتخاب کن یا محتوایت را تا ۴۸ ساعت آینده زمان‌بندی کن.
              </PublishingSectionGuide>
              <div className="mx-auto w-full max-w-2xl">
                
                <section className="rounded-2xl border border-[var(--daira-border)] bg-white p-4 shadow-sm sm:p-6">
                  

                  <div className="space-y-3">
                    <fieldset className="space-y-2.5">
                      <legend className="sr-only">شیوه انتشار محتوا</legend>
                      <label className={"flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition " + (publishNow?"border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]":"border-[var(--daira-border)] bg-white")}>
                        <input type="radio" name="publishing-mode" checked={publishNow} onChange={()=>{setPublishNow(true);setError("");}} className="h-4 w-4 accent-[var(--daira-primary)]" />
                        <span className="flex-1"><span className="block text-sm font-bold text-[var(--daira-heading)]">انتشار همین حالا</span>
                          <span className="mt-1 block text-xs text-[var(--daira-text-secondary)]">پس از ثبت، وضعیت انتشار در صف قابل پیگیری است.</span></span>
                        <Send size={18} className="text-[var(--daira-primary)]"/>
                      </label>
                      <label className={"flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition " + (!publishNow?"border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)]":"border-[var(--daira-border)] bg-white")}>
                        <input type="radio" name="publishing-mode" checked={!publishNow} onChange={()=>{setPublishNow(false);setError("");}} className="h-4 w-4 accent-[var(--daira-primary)]" />
                        <span className="flex-1"><span className="block text-sm font-bold text-[var(--daira-heading)]">زمان‌بندی انتشار</span>
                          <span className="mt-1 block text-xs text-[var(--daira-text-secondary)]">انتخاب زمان تا ۴۸ ساعت آینده</span></span>
                        <CalendarClock size={18} className="text-[var(--daira-primary)]"/>
                      </label>
                    </fieldset>

                    {!publishNow && (
                      <div className="mt-3 rounded-xl border border-[var(--daira-border)] bg-white p-4 sm:p-5">
                        <div className="mb-4">
                          <p className="text-sm font-bold text-[var(--daira-heading)]">انتخاب زمان دقیق</p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--daira-text-secondary)]">تاریخ انتشار را انتخاب کن.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {[todayJalali, addJalaliDays(todayJalali, 1)].map((date, index) => {
                            const selected = stage6Date?.year === date.year && stage6Date?.month === date.month && stage6Date?.day === date.day;
                            const label = index === 0 ? "امروز" : "فردا";
                            return (
                              <button
                                key={`${date.year}-${date.month}-${date.day}`}
                                type="button"
                                onClick={() => {
                                  setStage6Date(date);
                                  if (index === 0) {
                                    setStage6Hour((current) => Math.max(current ?? officialTehranClock.hour, officialTehranClock.hour));
                                    setStage6Minute((current) => {
                                      if (stage6Hour === officialTehranClock.hour) return Math.max(current ?? officialTehranClock.minute, officialTehranClock.minute);
                                      return current ?? officialTehranClock.minute;
                                    });
                                  }
                                  setError("");
                                }}
                                className={["relative min-h-24 overflow-hidden rounded-2xl border p-3.5 text-right transition-all", selected ? "border-[var(--daira-primary)] bg-[var(--daira-outline-hover-bg)] shadow-sm ring-2 ring-[var(--daira-primary)]/10" : "border-[var(--daira-border)] bg-white hover:border-[var(--daira-brand-300)] hover:bg-[var(--daira-surface-hover)]"].join(" ")}
                              >
                                <span className="absolute right-3.5 top-3.5 text-[11px] font-semibold text-[var(--daira-text-secondary)]">{getJalaliWeekday(date)}</span>
                                <span className="absolute left-3.5 top-3.5 text-[10px] font-semibold text-[var(--daira-primary)]">{label}</span>
                                <div className="mt-5 text-center text-base font-bold text-[var(--daira-heading)]">{toPersianDigits(date.day)} {jalaliMonths[date.month - 1]}</div>
                                <div className="mt-2 text-center text-[10px] font-medium text-[var(--daira-text-secondary)]">{toPersianDigits(date.year)}</div>
                                {selected && <span className="absolute bottom-2.5 left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--daira-primary)] text-[10px] font-bold text-white">✓</span>}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-6 border-t border-[var(--daira-border)] pt-5">
                          <div className="mb-3">
                            <p className="text-sm font-bold text-[var(--daira-heading)]">ساعت انتشار</p>
                          </div>

                          <div dir="ltr" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                            <InlineWheelPicker
                              value={stage6Hour}
                              min={stage6Date && stage6Date.year === todayJalali.year && stage6Date.month === todayJalali.month && stage6Date.day === todayJalali.day ? officialTehranClock.hour : 0}
                              max={23}
                              label="ساعت"
                              onChange={(value) => {
                                const isToday = stage6Date && stage6Date.year === todayJalali.year && stage6Date.month === todayJalali.month && stage6Date.day === todayJalali.day;
                                const nextHour = isToday ? Math.max(value, officialTehranClock.hour) : value;
                                setStage6Hour(nextHour);
                                if (isToday && nextHour === officialTehranClock.hour && (stage6Minute ?? 0) < officialTehranClock.minute) {
                                  setStage6Minute(officialTehranClock.minute);
                                }
                                setError("");
                              }}
                            />
                            <span className="mt-6 px-0.5 text-xl font-bold text-[var(--daira-text-secondary)]" aria-hidden="true">:</span>
                            <InlineWheelPicker
                              value={stage6Minute}
                              min={
                                stage6Date &&
                                  stage6Date.year === todayJalali.year &&
                                  stage6Date.month === todayJalali.month &&
                                  stage6Date.day === todayJalali.day &&
                                  stage6Hour === officialTehranClock.hour
                                  ? officialTehranClock.minute
                                  : 0
                              }
                              max={59}
                              label="دقیقه"
                              onChange={(value) => {
                                const isToday = stage6Date && stage6Date.year === todayJalali.year && stage6Date.month === todayJalali.month && stage6Date.day === todayJalali.day;
                                const nextMinute = isToday && stage6Hour === officialTehranClock.hour
                                  ? Math.max(value, officialTehranClock.minute)
                                  : value;
                                setStage6Minute(nextMinute);
                                setError("");
                              }}
                            />
                          </div>

                          <p className="mt-4 text-center text-[11px] leading-5 text-[var(--daira-text-secondary)]">برای انتخاب به بالا یا پایین بکشید</p>
                        </div>

                      </div>
                    )}

                    <button type="button" disabled={!canPublish || (!publishNow && (!stage6Date || stage6Hour===null || stage6Minute===null))}
                      onClick={()=>void createJob(publishNow)}
                      className="daira-leading-action flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[var(--daira-primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--daira-primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--daira-border)] disabled:text-[var(--daira-text-disabled)]">
                      {publishing?<Loader2 size={18} className="animate-spin"/>:publishNow?<Send size={18}/>:<CalendarClock size={18}/>}
                      {publishing?"در حال ثبت انتشار...":publishNow?"انتشار همین حالا":"ثبت زمان‌بندی انتشار"}
                    </button>
                    {error && <div className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--daira-error-text)]" role="alert">{error}</div>}
                  </div>
                </section>
              </div>
              {automationEnabled&&!canSubmitAutomation&&<p className="rounded-xl border border-[var(--daira-warning-border)] bg-[var(--daira-warning-bg)] px-4 py-3 text-xs leading-6 text-[var(--daira-warning-text)]">
                {type==="STORY"?"برای انتشار با پاسخ خودکار، ابتدا پاسخ استوری را ذخیره کن.":"برای فعال‌سازی پاسخ خودکار، حداقل یک کلمه کلیدی و متن پاسخ کامنت لازم است."}
              </p>}
              {error&&<p role="alert" className="rounded-xl border border-[var(--daira-error-border)] bg-[var(--daira-error-background)] px-4 py-3 text-xs leading-6 text-[var(--daira-error-text)]">{error}</p>}
            </section>
          </div>
        )}
      </div>
      <GlassModalPresence open={Boolean(confirmStoryPublishingReplacement)}
        onEscape={()=>{if(!publishing)setConfirmStoryPublishingReplacement(null);}}>
        {confirmStoryPublishingReplacement&&<div className="daira-glass-overlay fixed inset-0 z-[9998] flex items-center justify-center p-4 backdrop-blur-md" role="presentation"
          onMouseDown={event=>{if(event.target===event.currentTarget&&!publishing)setConfirmStoryPublishingReplacement(null);}}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="publishing-story-replacement-title"
            className="daira-glass-modal w-full max-w-md rounded-3xl border border-[var(--daira-glass-rim)] bg-[var(--daira-glass-raised)] p-5 shadow-2xl">
            <h2 id="publishing-story-replacement-title" className="text-base font-bold text-[var(--daira-heading)]">جایگزینی پاسخ فعال استوری</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--daira-text)]">پاسخ فعلی با کلمات کلیدی زیر فعال است:</p>
            <div className="mt-3 space-y-2">{confirmStoryPublishingReplacement.keywords.map((words,index)=>(
              <p key={index} className="rounded-xl border border-[var(--daira-glass-rim)] bg-[var(--daira-surface-hover)] px-3 py-2 text-sm font-semibold">{words}</p>
            ))}</div>
            <p className="mt-3 text-sm leading-7 text-[var(--daira-text)]">
              پاسخ قبلی {confirmStoryPublishingReplacement.publishNow
                ? "پس از انتشار موفق استوری جدید"
                : "در زمان انتشار موفق استوری زمان‌بندی‌شده"} غیرفعال می‌شود؛ حذف نخواهد شد.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={()=>setConfirmStoryPublishingReplacement(null)} disabled={publishing}
                className="min-h-11 flex-1 rounded-xl border border-[var(--daira-glass-rim)] text-sm font-semibold">انصراف</button>
              <button type="button" disabled={publishing} onClick={()=>{
                const publishNow=confirmStoryPublishingReplacement.publishNow;
                setConfirmStoryPublishingReplacement(null);
                void createJob(publishNow,true);
              }} className="daira-complete-reply__select min-h-11 flex-1 rounded-xl text-sm font-bold">تأیید و ادامه</button>
            </div>
          </section>
        </div>}
      </GlassModalPresence>
    </div>
  );
}
