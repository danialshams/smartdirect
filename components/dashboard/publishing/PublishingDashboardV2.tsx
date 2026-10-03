"use client";
import { Checkbox } from "@/components/dashboard/DashboardUI"
import { Textarea } from "@/components/dashboard/DashboardUI"
import { Button } from "@/components/dashboard/DashboardUI"
import { Calendar } from "@/components/dashboard/DashboardUI"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/dashboard/DashboardUI"
import { Input } from "@/components/dashboard/DashboardUI"
import { Select } from "@/components/dashboard/DashboardUI"

import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarClock, Camera, Clapperboard, ImagePlus, Images, Loader2, Plus, Send, Video, X } from "lucide-react";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import AutomationFlowMessage from "../AutomationFlowMessage";
import {
  createEmptyMessage,
  createEmptyQuickReply,
  getMessageTypeLabel,
  validateMessages,
  type FormItem,
  type InstagramAccount as AutomationAccount,
  type MessageDraft,
  type Showcase,
} from "../automation-form-utils";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY";
type MediaType = "IMAGE" | "VIDEO";
type LocalMedia = { file: File; type: MediaType; previewUrl: string; sortOrder: number };
type UploadedMedia = { type: MediaType; storageKey: string; publicUrl: string; fileName: string; mimeType: string; fileSize: number; sortOrder: number };
type Job = { id: string; type: PublishType; status: string; caption: string | null; scheduledAt: string | null; publishedAt: string | null; errorMessage: string | null; media: UploadedMedia[]; instagramAccount?: { igUsername: string | null } };
type InstagramAccount = { id: string; igUsername: string | null; username?: string | null; igUserId: string; isConnected?: boolean };
type JalaliDate = { year: number; month: number; day: number };

type AutomationDraftConfig = {
  triggerType: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD";
  keyword: string;
  commentReplyText: string;
  likeStoryReply: boolean;
  requireFollow: boolean;
  followGateText: string;
  messages: MessageDraft[];
};

const typeLabels: Record<PublishType, string> = { POST: "پست", CAROUSEL: "آلبوم", REEL: "ریلز", STORY: "استوری" };
const statusLabels: Record<string, string> = { DRAFT: "پیش‌نویس", PROCESSING: "در حال پردازش", PUBLISHING: "در حال انتشار", PUBLISHED: "منتشر شده", FAILED: "ناموفق", SCHEDULED: "زمان‌بندی شده", CANCELLED: "لغو شده" };
const jalaliMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function toPersianDigits(value: number | string) { return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]); }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "-"; }
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] { const jYear = jy + 1595; let days = -355668 + 365 * jYear + Math.floor(jYear / 33) * 8 + Math.floor(((jYear % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186); let gy = 400 * Math.floor(days / 146097); days %= 146097; if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; } gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } const gd = days + 1; const monthDays = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let remaining = gd; let gm = 1; while (remaining > monthDays[gm - 1]) { remaining -= monthDays[gm - 1]; gm += 1; } return [gy, gm, remaining]; }
function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate { let jy = gy - 621; const candidate = jalaliToGregorian(jy, 1, 1); const inputUtc = Date.UTC(gy, gm - 1, gd); if (inputUtc < Date.UTC(candidate[0], candidate[1] - 1, candidate[2])) jy -= 1; const start = jalaliToGregorian(jy, 1, 1); const diff = Math.floor((inputUtc - Date.UTC(start[0], start[1] - 1, start[2])) / 86400000); return diff < 186 ? { year: jy, month: Math.floor(diff / 31) + 1, day: (diff % 31) + 1 } : { year: jy, month: Math.floor((diff - 186) / 30) + 7, day: ((diff - 186) % 30) + 1 }; }
function isJalaliLeap(year: number) { const epBase = year - (year >= 0 ? 474 : 473); const epYear = 474 + (epBase % 2820); return ((epYear + 38) * 682) % 2816 < 682; }
function jalaliMonthDays(year: number, month: number) { if (month <= 6) return 31; if (month <= 11) return 30; return isJalaliLeap(year) ? 30 : 29; }
function currentJalaliDate() { const now = new Date(); return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate()); }
function addJalaliDays(value: JalaliDate, days: number) { const [gy, gm, gd] = jalaliToGregorian(value.year, value.month, value.day); const date = new Date(gy, gm - 1, gd + days); return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate()); }
function jalaliDateTimeToDate(date: JalaliDate, hour: number, minute: number) { const [gy, gm, gd] = jalaliToGregorian(date.year, date.month, date.day); return new Date(gy, gm - 1, gd, hour, minute, 0, 0); }
async function uploadFileWithProgress(file: File, onProgress: (progress: number) => void): Promise<{ storageKey: string; publicUrl: string; type: MediaType; fileName: string; mimeType: string; fileSize: number }> {

  const providerResponse = await fetch("/api/instagram/publishing/upload/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
  });

  const providerResult = await providerResponse.json().catch(() => null);
  if (!providerResponse.ok || !providerResult?.success) {
    throw new Error(providerResult?.message || "آماده‌سازی آپلود فایل ناموفق بود.");
  }

  if (providerResult.mode === "vercel-blob") {
    let lastProgress = 0;
    const blob = await uploadToBlob(providerResult.pathname, file, {
      access: "public",
      handleUploadUrl: "/api/instagram/publishing/upload/client",
      multipart: file.size > 10 * 1024 * 1024,
      clientPayload: JSON.stringify({
        pathname: providerResult.pathname,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      }),
      onUploadProgress(event) {
        const nextProgress = Math.max(lastProgress, Math.min(100, Math.round(event.percentage)));
        lastProgress = nextProgress;
        onProgress(nextProgress);
      },
    });

    onProgress(100);
    return {
      storageKey: blob.pathname,
      publicUrl: blob.url,
      type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    };
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/instagram/publishing/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("آپلود فایل ناموفق بود."));
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300 || !result.success) {
          reject(new Error(result.message || "آپلود فایل ناموفق بود."));
          return;
        }
        resolve(result.data);
      } catch {
        reject(new Error("پاسخ نامعتبر از سرور دریافت شد."));
      }
    };
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

function PersianDatePicker({ value, onChange }: { value: JalaliDate; onChange: (value: JalaliDate) => void }) {
  const selected = new Date(jalaliToGregorian(value.year, value.month, value.day).join("-"));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <CalendarClock size={18} />
          <span>{jalaliMonths[value.month - 1]} {toPersianDigits(value.day)}، {toPersianDigits(value.year)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date: Date | undefined) => {
            if (!date) return;
            onChange(gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate()));
          }}
          />
      </PopoverContent>
    </Popover>
  );
}

function KeywordChipsInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const keywords = value.split(/[\n,،;؛]+/).map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index);
  const [draft, setDraft] = useState("");
  const sync = (next: string[]) => onChange(next.map((item) => item.trim()).filter(Boolean).filter((item, index, list) => list.indexOf(item) === index).join(","));
  const add = () => { const item = draft.trim(); if (!item) return; sync([...keywords, item]); setDraft(""); };
  return <div className="flex min-h-[56px] flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 transition focus-within:border-[#7C3AED] focus-within:ring-2 focus-within:ring-[#7C3AED]/10">{keywords.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">{item}<Button type="button" onClick={() => sync(keywords.filter((keyword) => keyword !== item))} className="text-muted-foreground hover:text-foreground" aria-label={`حذف ${item}`}><X size={13} /></Button></span>)}<Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (["Enter", ",", "،"].includes(event.key)) { event.preventDefault(); add(); } }} onBlur={add} placeholder={keywords.length ? "کلمه بعدی..." : placeholder} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-[#0F172A] outline-none ring-0 placeholder:text-[#94A3B8]" /><Button type="button" onPointerDown={(event) => event.preventDefault()} onClick={add} className="shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]">افزودن کلمه</Button></div>;
}

function SectionHeader({ n, title, text }: { n: string; title: string; text: string }) { return <div className="mb-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">{n}</span><h2 className="text-sm font-bold text-[#0F172A]">{title}</h2></div><p className={["mt-2 leading-5 text-[#64748B]", title === "آپلود آلبوم" ? "whitespace-nowrap text-[9px] sm:text-xs" : "text-xs"].join(" ")}>{text}</p></div>; }
function ProgressBar({ progress }: { progress: number }) {
  return <div className="mt-4 w-full max-w-md rounded-xl border border-[#DBEAFE] bg-white px-4 py-3.5 shadow-sm">
    <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#2563EB]">
      <span>پیشرفت آپلود</span><span>{toPersianDigits(progress)}٪</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
      <div className="h-full rounded-full bg-[#2563EB] transition-[width] duration-200 ease-out" style={{width:`${Math.max(0,Math.min(100,progress))}%`}}/>
    </div>
  </div>;
}
function UploadSuccessMark() {
  return <svg viewBox="0 0 24 24" className="inline-block h-8 w-8 shrink-0 text-[#16A34A]" aria-hidden="true">
    <path d="m4 12.5 5 5L20 6" pathLength="100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-check-path"/>
  </svg>;
}
function UploadArea({ id, accept, multiple, disabled, isDragging, setIsDragging, uploading, uploadSuccess, uploadProgress, onChange, onDrop, onCancelUpload, title }: any) {
  return <div onDragOver={(e: DragEvent<HTMLDivElement>)=>{e.preventDefault();setIsDragging(true)}} onDragLeave={()=>setIsDragging(false)} onDrop={onDrop} className={["relative overflow-hidden rounded-xl border border-dashed p-4 transition sm:p-6",isDragging?"border-[#2563EB] bg-[#2563EB]/5":"border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#93C5FD] hover:bg-[#EFF6FF]/50",disabled&&!uploading?"pointer-events-none opacity-60":""].join(" ")}>
    <Input id={id} type="file" accept={accept} multiple={multiple} onChange={onChange} disabled={disabled} className="sr-only"/>
    <label htmlFor={id} className={["flex min-h-[190px] flex-col items-center justify-center text-center",uploading?"cursor-default":"cursor-pointer"].join(" ")}>
      {!uploading && !uploadSuccess && <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]"><ImagePlus size={22}/></div>}
      <span className={["mt-4 inline-flex min-h-6 items-center justify-center gap-2 text-sm font-bold transition-colors duration-300",uploadSuccess?"text-[#16A34A]":"text-[#0F172A]"].join(" ")}>
        {uploadSuccess ? <><UploadSuccessMark/><span className="sr-only">آپلود کامل شد</span></> : uploading ? "در حال آپلود..." : title}
      </span>
      {!uploading&&!uploadSuccess&&<span className="mt-1.5 whitespace-nowrap text-[11px] leading-5 text-[#64748B]">فایل را بکش و اینجا رها کن یا برای انتخاب از دستگاه کلیک کن.</span>}
      {uploading&&<ProgressBar progress={uploadProgress}/>}
    </label>
    {uploading&&<div className="flex justify-center"><button type="button" onClick={onCancelUpload} className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50">حذف فایل در حال آپلود</button></div>}
  </div>;
}
function MediaTile({ item, type, onRemove, ready=false, compact=false }: any) {
  const image=item.type==="IMAGE"; const src=ready?item.publicUrl:item.previewUrl;
  const aspect=type==="REEL"||type==="STORY"?"aspect-[9/16]":"aspect-[4/5]";
  return <div className={["group relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F1F5F9]",compact?"shadow-sm":""].join(" ")}>
    {image?<img src={src} alt={ready?item.fileName:item.file.name} className={["w-full object-cover",aspect].join(" ")}/>:<video src={src} controls className={["w-full object-cover",aspect].join(" ")}/>}
    {!compact && <Button type="button" onClick={onRemove} className="absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 p-0 text-[#DC2626] shadow-sm ring-1 ring-black/5" aria-label="حذف فایل"><X size={15}/></Button>}
  </div>;
}

export default function PublishingDashboardV2({ onTypeChange }: { onTypeChange?: (type: PublishType) => void }) {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const knownJobIdsRef = useRef(new Set<string>());
  const [isDragging, setIsDragging] = useState(false);
  const [type, setType] = useState<PublishType>("POST");
  const [selectionConfirmed, setSelectionConfirmed] = useState(false);
  const [captionStepConfirmed, setCaptionStepConfirmed] = useState(false);
  const [tagStepConfirmed, setTagStepConfirmed] = useState(false);
  const [automationChoiceStepStarted, setAutomationChoiceStepStarted] = useState(false);
  const [automationChoiceConfirmed, setAutomationChoiceConfirmed] = useState(false);
  const [showUploadedMediaPreview, setShowUploadedMediaPreview] = useState(false);
  const [taggedUsersByMedia, setTaggedUsersByMedia] = useState<Record<string, string[]>>({});
  const [tagDraftByMedia, setTagDraftByMedia] = useState<Record<string, string>>({});
  const [tagInputError, setTagInputError] = useState("");
  const [stepVisible, setStepVisible] = useState(true);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [messages, setMessages] = useState<MessageDraft[]>([createEmptyMessage()]);
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [likeStoryReply, setLikeStoryReply] = useState(false);
  const [requireFollow, setRequireFollow] = useState(false);
  const [followGateText, setFollowGateText] = useState("برای دریافت پاسخ، ابتدا پیج را Follow کنید.");
  const [scheduledDate, setScheduledDate] = useState<JalaliDate>(currentJalaliDate());
  const [hour, setHour] = useState(new Date().getHours());
  const [minute, setMinute] = useState(new Date().getMinutes());
  const [publishNow, setPublishNow] = useState(true);
  const [stage6Date, setStage6Date] = useState<JalaliDate | null>(null);
  const [stage6Hour, setStage6Hour] = useState<number | null>(null);
  const [stage6Minute, setStage6Minute] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const uploadRunRef = useRef(0);
  const carouselInsertAtRef = useRef<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const triggerType = type === "STORY" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD";
  const uploadTitle = `آپلود ${typeLabels[type]}`;
  const uploadInstruction =
    type === "CAROUSEL"
      ? uploadedMedia.length >= 2
        ? "برای آپلود اسلایدهای بیشتر (تا ۱۰ اسلاید)، فایل موردنظرت را انتخاب کن."
        : "تصویر یا ویدیوی آلبوم را انتخاب کن."
      : type === "REEL"
        ? "ویدیوی ریلز را انتخاب کن."
        : type === "STORY"
          ? "تصویر یا ویدیوی استوری را انتخاب کن."
          : "تصویر پست را انتخاب کن.";
  const activeInstagramAccount = accounts.find((account) => account.isConnected !== false);
  const selectedAccountId = activeInstagramAccount?.id ?? "";
  const automationAccount: AutomationAccount = {
    id: selectedAccountId,
    igUsername: activeInstagramAccount?.igUsername ?? activeInstagramAccount?.username ?? "",
  };

  async function loadAccounts() {
    const response = await fetch("/api/instagram/accounts", { cache: "no-store" });
    if (!response.ok) throw new Error("دریافت اکانت‌های Instagram ناموفق بود.");

    const result = await response.json();
    const rawList = result.data ?? result.accounts ?? [];
    const list = Array.isArray(rawList)
      ? rawList
          .filter((account) => account?.id)
          .map((account) => ({
            id: String(account.id),
            igUserId: String(account.igUserId ?? ""),
            igUsername: account.igUsername ?? account.username ?? null,
            username: account.username ?? account.igUsername ?? null,
            isConnected: account.isConnected !== false,
          }))
      : [];

    setAccounts(list);
    }
  async function loadJobs() {
    const response = await fetch("/api/instagram/publishing", { cache: "no-store" });
    if (!response.ok) throw new Error("دریافت Publishing Jobs ناموفق بود.");
    const result = await response.json();
    const nextJobs: Job[] = result.data ?? [];
    const previousJobs = jobs;
    const previousById = new Map(previousJobs.map((job) => [job.id, job]));
    const nextById = new Map(nextJobs.map((job) => [job.id, job]));

    for (const job of nextJobs) {
      if (!knownJobIdsRef.current.has(job.id)) continue;
      const previousStatus = previousById.get(job.id)?.status;
      if (previousStatus === job.status) continue;

      if (job.status === "PUBLISHED") {
        toast.success("محتوا با موفقیت منتشر شد.");
        knownJobIdsRef.current.delete(job.id);
      } else if (job.status === "FAILED") {
        toast.error(job.errorMessage || "انتشار محتوا ناموفق بود.");
        knownJobIdsRef.current.delete(job.id);
      }
    }

    for (const id of knownJobIdsRef.current) {
      if (!nextById.has(id)) knownJobIdsRef.current.delete(id);
    }

    setJobs(nextJobs);
  }
  async function loadResources(accountId: string) { if (!accountId) return; setLoadingResources(true); try { const [showcaseResponse, formResponse] = await Promise.all([fetch(`/api/showcases?instagramAccountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }), fetch(`/api/forms?instagramAccountId=${encodeURIComponent(accountId)}`, { cache: "no-store" })]); const showcaseResult = await showcaseResponse.json(); const formResult = await formResponse.json(); setShowcases(
        Array.isArray(showcaseResult)
          ? showcaseResult
          : Array.isArray(showcaseResult?.data)
            ? showcaseResult.data
            : [],
      ); setForms(Array.isArray(formResult.data) ? formResult.data : []); } finally { setLoadingResources(false); } }
  async function load() { try { setLoading(true); setError(""); await Promise.all([loadAccounts(), loadJobs()]); } catch (e) { setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات."); } finally { setLoading(false); } }
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void loadJobs(), 5000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => { if (selectedAccountId) void loadResources(selectedAccountId); }, [selectedAccountId]);

  function revokeLocalMedia(items: LocalMedia[]) { items.forEach((item) => URL.revokeObjectURL(item.previewUrl)); }
  function clearLocalMedia() { setMedia((current) => { revokeLocalMedia(current); return []; }); }
  function resetAutomation() { setAutomationEnabled(false); setKeywords(""); setMessages([createEmptyMessage()]); setCommentReplyText(""); setLikeStoryReply(false); setRequireFollow(false); setFollowGateText("برای دریافت پاسخ، ابتدا پیج را Follow کنید."); }
  function animateStepChange(action: () => void) {
    setStepVisible(false);
    window.setTimeout(() => { action(); window.requestAnimationFrame(() => setStepVisible(true)); }, 180);
  }
  function handleTypeChange(nextType: PublishType) { animateStepChange(() => { clearLocalMedia(); setUploadedMedia([]); setType(nextType); setSelectionConfirmed(true); setCaptionStepConfirmed(false); setTagStepConfirmed(false); setAutomationChoiceStepStarted(false); setAutomationChoiceConfirmed(false); setShowUploadedMediaPreview(false); setTaggedUsersByMedia({}); setTagDraftByMedia({}); setTagInputError(""); onTypeChange?.(nextType); setUploadProgress(0); setUploadSuccess(false); setCaption(""); resetAutomation(); }); }
  function handleBackToTypeSelection() { animateStepChange(() => { clearLocalMedia(); setUploadedMedia([]); setSelectionConfirmed(false); setCaptionStepConfirmed(false); setTagStepConfirmed(false); setAutomationChoiceStepStarted(false); setAutomationChoiceConfirmed(false); setShowUploadedMediaPreview(false); setTaggedUsersByMedia({}); setTagDraftByMedia({}); setTagInputError(""); setUploadProgress(0); setUploadSuccess(false); setCaption(""); resetAutomation(); }); }
  function prepareFiles(files: File[]) {
    if (!files.length || uploading || publishing) return;
    const accepted =
      type === "REEL"
        ? files.filter((file) => file.type.startsWith("video/"))
        : type === "STORY" || type === "CAROUSEL"
          ? files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
          : files.filter((file) => file.type.startsWith("image/"));

    if (!accepted.length) {
      setError(
        type === "REEL"
          ? "برای ریلز یک فایل ویدیویی انتخاب کن."
          : type === "STORY"
            ? "برای استوری یک تصویر یا ویدیو انتخاب کن."
            : type === "CAROUSEL"
              ? "برای آلبوم یک تصویر یا ویدیو انتخاب کن."
              : "برای پست یک تصویر انتخاب کن.",
      );
      return;
    }

    const remaining = type === "CAROUSEL" ? Math.max(0, 10 - uploadedMedia.length) : 1;
    if (remaining <= 0) {
      setError("آلبوم نمی‌تواند بیشتر از ۱۰ اسلاید داشته باشد.");
      return;
    }

    const selected = accepted.slice(0, 1);
    if (type !== "CAROUSEL") setUploadedMedia([]);
    clearLocalMedia();

    const nextMedia = selected.map((file, index): LocalMedia => ({
      file,
      type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      previewUrl: URL.createObjectURL(file),
      sortOrder: uploadedMedia.length + index,
    }));

    setMedia(nextMedia);
    setError("");
    window.setTimeout(() => void uploadSelectedMedia(nextMedia), 0);
  }
  function handleFiles(event: ChangeEvent<HTMLInputElement>) { const files = Array.from(event.target.files ?? []); event.target.value = ""; prepareFiles(files); }
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setIsDragging(false); prepareFiles(Array.from(event.dataTransfer.files ?? [])); }
  function removeLocal(index: number) {
    const item = media[index];
    if (!item) return;
    if (uploading) {
      uploadRunRef.current += 1;
      setUploading(false);
      setUploadProgress(0);
      setUploadSuccess(false);
    }
    URL.revokeObjectURL(item.previewUrl);
    setMedia((current) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + uploadedMedia.length })));
  }
  async function removeUploaded(item: UploadedMedia) {
    try {
      const currentIndex = uploadedMedia.findIndex((mediaItem) => mediaItem.storageKey === item.storageKey);
      const response = await fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: item.storageKey }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "حذف فایل ناموفق بود.");
      if (type === "CAROUSEL" && currentIndex >= 0) carouselInsertAtRef.current = currentIndex;
      if (type !== "CAROUSEL") setShowUploadedMediaPreview(false);
      setUploadedMedia((current) => current.filter((m) => m.storageKey !== item.storageKey).map((m, i) => ({ ...m, sortOrder: i })));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "حذف فایل ناموفق بود."); }
  }
  async function uploadSelectedMedia(items = media) {
    if (!selectedAccountId) { setError("اکانت فعال Instagram پیدا نشد."); return; }
    if (!items.length) return;
    const runId = ++uploadRunRef.current;
    try {
      setUploading(true); setUploadSuccess(false); setError(""); setUploadProgress(0);
      const totalBytes = items.reduce((sum,item)=>sum+item.file.size,0);
      let completedBytes=0; const results: UploadedMedia[]=[];
      // Each carousel file is uploaded serially, preserving slide order.
      for (let index=0; index<items.length; index+=1) {
        const item=items[index];
        const result=await uploadFileWithProgress(item.file,(progress)=>{
          if (uploadRunRef.current !== runId) return;
          setUploadProgress(totalBytes?Math.min(100,Math.round(((completedBytes+item.file.size*progress/100)/totalBytes)*100)):progress);
        });
        if (uploadRunRef.current !== runId) {
          void fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: result.storageKey }) }).catch(()=>undefined);
          return;
        }
        results.push({...result,sortOrder:uploadedMedia.length+results.length}); completedBytes+=item.file.size;
      }
      revokeLocalMedia(items);
      setMedia(current=>current.filter(item=>!items.includes(item)));
      setUploadedMedia(current=>{
        const next=[...current];
        if (type === "CAROUSEL" && carouselInsertAtRef.current !== null) {
          next.splice(Math.min(carouselInsertAtRef.current, next.length), 0, ...results);
          carouselInsertAtRef.current = null;
        } else {
          next.push(...results);
        }
        return next.map((item,index)=>({...item,sortOrder:index}));
      });
      setUploadProgress(100); setUploading(false); setUploadSuccess(true);
      if (type !== "CAROUSEL" && type !== "STORY") {
        window.setTimeout(() => {
          animateStepChange(() => {
            setCaptionStepConfirmed(true);
            setShowUploadedMediaPreview(false);
            setUploadSuccess(false);
            setUploadProgress(0);
          });
        }, 1100);
      } else {
        window.setTimeout(() => {
          setUploadSuccess(false);
          setUploadProgress(0);
        }, 1100);
      }
    } catch(e) {
      if (uploadRunRef.current !== runId) return;
      setUploading(false); setUploadSuccess(false); setError(e instanceof Error?e.message:"آپلود فایل ناموفق بود.");
    }
  }

  function addTagForMedia(mediaKey: string) {
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
  function handleNextStep() {
    if (uploading || publishing || uploadedMedia.length < (type === "CAROUSEL" ? 2 : 1)) return;
    if (!captionStepConfirmed) { setCaptionStepConfirmed(true); setError(""); return; }
    if (!tagStepConfirmed && caption.trim()) { setTagStepConfirmed(true); setError(""); }
  }
  function handlePreviousStep() {
    if (publishing || uploading) return;
    if (automationChoiceConfirmed) { setAutomationChoiceConfirmed(false); return; }
    if (automationChoiceStepStarted) { setAutomationChoiceStepStarted(false); return; }
    if (tagStepConfirmed) { setTagStepConfirmed(false); return; }
    if (captionStepConfirmed) { setCaptionStepConfirmed(false); setShowUploadedMediaPreview(type !== "CAROUSEL"); setUploadProgress(0); setUploadSuccess(false); setError(""); return; }
    handleBackToTypeSelection();
  }

  function handleAutomationChoice(enabled: boolean) {
    if (publishing || uploading) return;
    animateStepChange(() => {
      setAutomationEnabled(enabled);
      setAutomationChoiceConfirmed(true);
      setError("");
    });
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
    if (!keywords.trim()) throw new Error(type === "STORY" ? "حداقل یک کلمه برای Reply استوری وارد کنید." : "حداقل یک کلمه برای کامنت وارد کنید.");
    validateMessages(messages);
    if (requireFollow && !followGateText.trim()) throw new Error("متن Follow Gate را وارد کنید.");

    const pendingMediaId = `pending:${crypto.randomUUID()}`;
    const automationPayload = {
      instagramAccountId: selectedAccountId,
      triggerType,
      keyword: keywords,
      mediaId: pendingMediaId,
      commentReplyText: triggerType === "COMMENT_KEYWORD" ? commentReplyText.trim() || null : null,
      sendDm: true,
      likeStoryReply: triggerType === "STORY_REPLY_KEYWORD" ? likeStoryReply : false,
      requireFollow: (triggerType === "COMMENT_KEYWORD" || triggerType === "STORY_REPLY_KEYWORD") ? requireFollow : false,
      followGateText: requireFollow ? followGateText.trim() : null,
      isActive: true,
    };

    const automationResponse = await fetch("/api/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(automationPayload) });
    const automationResult = await automationResponse.json();
    if (!automationResponse.ok || !automationResult.success) throw new Error(automationResult.error || "ساخت Automation ناموفق بود.");
    const automationId = automationResult.data.id as string;

    try {
      const serverMessageIds = new Map<string, string>();
      for (let index = 0; index < messages.length; index += 1) {
        const message = messages[index];
        const response = await fetch(`/api/automations/${automationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageType: message.messageType, text: message.text.trim() || null, mediaUrl: message.mediaUrl.trim() || null, mediaId: message.mediaId.trim() || null, showcaseId: message.showcaseId || null, formId: message.formId || null, order: index }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `ساخت پیام ${index + 1} ناموفق بود.`);
        serverMessageIds.set(message.id, result.data.id);
      }
      for (const message of messages) {
        const serverMessageId = serverMessageIds.get(message.id);
        if (!serverMessageId) throw new Error("شناسه پیام Automation پیدا نشد.");
        for (const quickReply of message.quickReplies) {
          const serializeQuickReplyTree = (replies: MessageDraft["quickReplies"]): unknown[] =>
            replies.map((reply) => ({
              id: reply.id,
              title: reply.title.trim(),
              payload: reply.payload,
              destinationType: reply.destinationType,
              destinationText: reply.destinationText.trim(),
              destinationFormId: reply.destinationFormId,
              destinationShowcaseId: reply.destinationShowcaseId,
              destinationMediaUrl: reply.destinationMediaUrl,
              destinationMediaId: reply.destinationMediaId,
              destinationQuestion: reply.destinationQuestion.trim(),
              question: reply.destinationQuestion.trim(),
              destinationQuickReplies: serializeQuickReplyTree(reply.destinationQuickReplies),
            }));

          const response = await fetch(`/api/automations/${automationId}/messages/${serverMessageId}/quick-replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: quickReply.title.trim(),
              payload: quickReply.payload,
              destinationType: quickReply.destinationType,
              destinationText: quickReply.destinationText.trim() || null,
              destinationFormId: quickReply.destinationFormId || null,
              destinationShowcaseId: quickReply.destinationShowcaseId || null,
              destinationMediaUrl: quickReply.destinationMediaUrl || null,
              destinationMediaId: quickReply.destinationMediaId || null,
              destinationQuestion: quickReply.destinationQuestion.trim() || null,
              question: quickReply.destinationQuestion.trim() || null,
              destinationQuickReplies: serializeQuickReplyTree(quickReply.destinationQuickReplies),
            }),
          });

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error || `ساخت پاسخ «${quickReply.title}" ناموفق بود.`);
        }
      }
      return automationId;
    } catch (error) {
      await fetch(`/api/automations/${automationId}`, { method: "DELETE" }).catch(() => undefined);
      throw error;
    }
  }

  async function createJob(publishNow: boolean) {
    const accountId = selectedAccountId;
    if (!accountId) { setError("اکانت فعال Instagram پیدا نشد."); return; }
    if (!uploadedMedia.length) { setError("ابتدا فایل را آپلود کنید."); return; }
    if (type === "CAROUSEL" && uploadedMedia.length < 2) { setError("آلبوم باید حداقل ۲ اسلاید داشته باشد."); return; }
    if (type !== "CAROUSEL" && uploadedMedia.length !== 1) { setError(`${typeLabels[type]} باید دقیقاً یک فایل داشته باشد.`); return; }
    const selectedScheduleDate = !publishNow && type !== "STORY" && !automationEnabled ? stage6Date : scheduledDate;
    const selectedHour = !publishNow && type !== "STORY" && !automationEnabled ? stage6Hour : hour;
    const selectedMinute = !publishNow && type !== "STORY" && !automationEnabled ? stage6Minute : minute;
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
    try {
      setPublishing(true); setError("");
      const automationId = automationEnabled ? await createAutomation() : null;
      const response = await fetch("/api/instagram/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        instagramAccountId: accountId,
        type,
        caption: type === "STORY" ? null : caption.trim() || null,
        userTags: type === "CAROUSEL"
          ? { media: uploadedMedia.reduce<Record<string, Array<{ username: string }>>>((accumulator, item) => {
              const usernames = taggedUsersByMedia[item.storageKey] ?? [];
              if (usernames.length) accumulator[item.storageKey] = usernames.map((username) => ({ username }));
              return accumulator;
            }, {}) }
          : (taggedUsersByMedia[uploadedMedia[0]?.storageKey ?? ""] ?? []).map((username) => ({ username })),
        scheduledAt: publishNow ? null : scheduledAt,
        idempotencyKey: crypto.randomUUID(),
        commentAutomationId: type === "STORY" ? null : automationId,
        storyReplyAutomationId: type === "STORY" ? automationId : null,
        media: uploadedMedia,
      }) });
      const result = await response.json();
      if (!response.ok) { if (automationId) await fetch(`/api/automations/${automationId}`, { method: "DELETE" }).catch(() => undefined); throw new Error(result.message || "ساخت Publishing Job ناموفق بود."); }
      const job = result.data as Job;
      if (publishNow) {
        const publishResponse = await fetch(`/api/instagram/publishing/${job.id}/publish`, { method: "POST" });
        const publishResult = await publishResponse.json();
        if (!publishResponse.ok) throw new Error(publishResult.message || "انتشار ناموفق بود.");
        knownJobIdsRef.current.add(job.id);
      } else {
        knownJobIdsRef.current.add(job.id);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        toast.success("محتوا برای زمان‌بندی ثبت شد.");
      }
      setCaption(""); setUploadedMedia([]); setShowUploadedMediaPreview(false); resetAutomation(); setUploadProgress(0); setScheduledDate(currentJalaliDate()); await loadJobs();
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در انتشار محتوا."); } finally { setPublishing(false); }
  }

  async function retryJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}/retry`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Retry ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "Retry ناموفق بود."); } }
  async function cancelJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "لغو ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "لغو ناموفق بود."); } }

  const canPublish = uploadedMedia.length > 0 && !uploading && !publishing;
  const accept = type === "REEL" ? "video/mp4,video/quicktime" : type === "STORY" || type === "CAROUSEL" ? "image/jpeg,image/png,image/webp,video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp";

  return (
    <>
      <style>{`@keyframes draw-check { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } } .upload-check-path { stroke-dasharray: 100; stroke-dashoffset: 100; animation: draw-check 850ms cubic-bezier(.22,.61,.36,1) forwards; }`}</style>
      <div dir="rtl" className={["bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8", !selectionConfirmed ? "pb-8" : "pb-8"].join(" ")}>
      <div className="mx-auto w-full max-w-6xl">
        <div className={["transition-all duration-300 ease-out", stepVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"].join(" ")}>
        {!selectionConfirmed ? (
          <section className="w-full">
            <SectionHeader n="۱" title="نوع محتوا" text="نوع محتوایی را که می‌خواهی در Instagram منتشر کنی انتخاب کن." />
            <div className="grid w-full grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {([["POST","پست",ImagePlus,"#2563EB","#EFF6FF","#1D4ED8"],["CAROUSEL","آلبوم",Images,"#7C3AED","#F5F3FF","#6D28D9"],["REEL","ریلز",Clapperboard,"#D97706","#FFF7ED","#B45309"],["STORY","استوری",Camera,"#16A34A","#F0FDF4","#15803D"]] as const).map(([value,label,Icon,accent,soft,border]) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() => handleTypeChange(value)}
                  className="group relative flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-[28px] p-5 text-center shadow-none transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 sm:rounded-[32px] sm:p-7"
                  style={{ backgroundColor: soft, border: `1px solid ${border}`, color: accent }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/55 sm:h-14 sm:w-14"
                    style={{ color: accent }}
                  >
                    <Icon size={22} strokeWidth={1.9} className="sm:h-6 sm:w-6" />
                  </span>
                  <span className="text-base font-bold text-[#0F172A] sm:text-lg">{label}</span>
                </Button>
              ))}
            </div>
          </section>
        ) : (type !== "STORY" && !captionStepConfirmed) || uploadedMedia.length === 0 || (type === "STORY" && showUploadedMediaPreview) ? (
          <section className="mx-auto w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                onClick={handleBackToTypeSelection}
                className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
              >
                <ArrowRight size={15} strokeWidth={2} />
                بازگشت
              </Button>
              {uploadedMedia.length > 0 && !uploading && (
                <Button type="button" disabled={type === "CAROUSEL" && uploadedMedia.length < 2} onClick={handleNextStep} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40">
                  مرحله بعد <ArrowLeft size={15} strokeWidth={2}/>
                </Button>
              )}
            </div>

            <div className={type !== "CAROUSEL" && showUploadedMediaPreview && uploadedMedia.length > 0 ? "p-0" : "rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6"}>
              {type !== "CAROUSEL" && showUploadedMediaPreview && uploadedMedia.length > 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center py-5">
                  <span className="mb-3 inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-[11px] font-semibold text-[#15803D]">{typeLabels[type]} آپلود شده</span>
                  <div className="w-32 sm:w-40">
                    <MediaTile item={uploadedMedia[0]} type={type} onRemove={() => void removeUploaded(uploadedMedia[0])} ready compact/>
                  </div>
                  <button type="button" onClick={() => void removeUploaded(uploadedMedia[0])} className="mt-3 min-h-9 rounded-lg px-4 py-2 text-xs font-semibold text-[#DC2626] hover:bg-red-50">
                    پاک کردن
                  </button>
                </div>
              ) : (
                <>
                  <SectionHeader n="۲" title={uploadTitle} text={uploadInstruction} />
                  <UploadArea
                    id="publishing-media-upload"
                    accept={accept}
                    multiple={false}
                    title={uploadTitle}
                    disabled={uploading || publishing || (type === "CAROUSEL" && uploadedMedia.length >= 10)}
                    isDragging={isDragging}
                    setIsDragging={setIsDragging}
                    uploading={uploading}
                    uploadSuccess={uploadSuccess}
                    uploadProgress={uploadProgress}
                    onChange={handleFiles}
                    onDrop={handleDrop}
                    onCancelUpload={() => removeLocal(0)}
                  />

                  {type === "CAROUSEL" && uploadedMedia.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-3 text-center">
                        <p className="text-sm font-bold text-[#334155]">اسلایدهای آلبوم</p>
                        <p className="mt-1 text-[11px] text-[#64748B]">{toPersianDigits(uploadedMedia.length)} از ۱۰ اسلاید</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-3">
                        {uploadedMedia.map((item,index)=><div key={item.storageKey} className="w-16 sm:w-20"><MediaTile item={item} type="CAROUSEL" onRemove={()=>void removeUploaded(item)} ready compact/><p className="mt-1 text-center text-[10px] font-semibold text-[#64748B]">اسلاید {toPersianDigits(index+1)}</p><button type="button" onClick={()=>void removeUploaded(item)} className="mt-1 w-full rounded-md py-1 text-[11px] font-semibold text-[#DC2626] hover:bg-red-50">پاک کردن</button></div>)}
                      </div>
                    </div>
                  )}
                  {type === "CAROUSEL" && uploadedMedia.length >= 10 && (
                    <p className="mt-3 text-center text-xs font-medium text-[#64748B]">حداکثر ۱۰ اسلاید آپلود شده؛ برای افزودن فایل جدید ابتدا یک اسلاید را پاک کن.</p>
                  )}
                </>
              )}
            </div>
          </section>
        ) : type !== "STORY" && !tagStepConfirmed ? (
          <div>
            <div className="mx-auto mb-5 flex w-full max-w-2xl items-center justify-between gap-3">
              <Button
                type="button"
                onClick={handlePreviousStep}
                className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
              >
                <ArrowRight size={15} strokeWidth={2} />
                بازگشت
              </Button>
              <Button type="button" disabled={!caption.trim() || publishing} onClick={handleNextStep} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40">مرحله بعد <ArrowLeft size={15} strokeWidth={2}/></Button>
            </div>

            <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">۳</span><h2 className="text-sm font-bold text-[#0F172A]">کپشن</h2></div>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">{`کپشن ${typeLabels[type]} را بنویس.`}</p>
                </div>
                <span className="text-[11px] text-[#64748B]">{toPersianDigits(caption.length)} / ۲۲۰۰</span>
              </div>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={2200}
                rows={8}
                inputMode="text"
                autoCapitalize="sentences"
                spellCheck
                style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}
                className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 !text-base leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10"
                placeholder={`کپشن ${typeLabels[type]} را بنویس...`}
              />
            </section>
          </div>
        ) : type !== "STORY" && tagStepConfirmed && !automationChoiceStepStarted ? (
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Button type="button" onClick={handlePreviousStep} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]">
                <ArrowRight size={15} strokeWidth={2}/>بازگشت
              </Button>
              <Button type="button" onClick={() => { setAutomationChoiceStepStarted(true); setError(""); }} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]">
                مرحله بعد <ArrowLeft size={15} strokeWidth={2}/>
              </Button>
            </div>
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">۴</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">تگ کردن <span className="text-[#2563EB]">(اختیاری)</span></h2>
                  <p className="mt-1 whitespace-nowrap text-[11px] leading-5 text-[#64748B]">در صورت نیاز، کاربرهای موردنظر را اضافه کن.</p>
                </div>
              </div>
              
              {tagInputError && (
                <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]" role="alert">
                  {tagInputError}
                </div>
              )}

              {type === "CAROUSEL" ? (
                <div className="space-y-3">
                  {uploadedMedia.map((item, index) => {
                    const mediaKey = item.storageKey;
                    const tags = taggedUsersByMedia[mediaKey] ?? [];
                    const draft = tagDraftByMedia[mediaKey] ?? "";
                    return (
                      <div key={mediaKey} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 sm:p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white">
                            <MediaTile item={item} type="CAROUSEL" onRemove={() => void removeUploaded(item)} ready compact/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[#0F172A]">اسلاید {toPersianDigits(index + 1)}</p>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#64748B] ring-1 ring-[#E2E8F0]">{toPersianDigits(tags.length)} تگ</span>
                            </div>
                            {tags.length > 0 && (
                              <div className="mb-2.5 flex flex-wrap gap-1.5">
                                {tags.map((username) => (
                                  <span key={username} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-1.5 text-[11px] font-semibold text-[#2563EB] ring-1 ring-[#DBEAFE]">
                                    <span dir="ltr">@{username}</span>
                                    <button type="button" onClick={() => removeTagForMedia(mediaKey, username)} className="flex h-4 w-4 items-center justify-center rounded-full text-[#64748B] hover:bg-white hover:text-[#DC2626]" aria-label={`حذف تگ @${username}`}>
                                      <X size={11} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <input value={draft} onChange={(event) => handleTagInputChange(mediaKey, event.target.value)} onKeyDown={(event) => handleTagInputKeyDown(mediaKey, event)} placeholder="نام کاربر بدون @" maxLength={30} inputMode="text" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 !text-base leading-5 text-[#0F172A] outline-none placeholder:text-xs placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}/>
                              <Button type="button" onClick={() => addTagForMedia(mediaKey)} disabled={!draft.trim()} className="shrink-0 rounded-lg bg-[#2563EB] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">افزودن</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 sm:p-4">
                  {(() => {
                    const mediaKey = uploadedMedia[0]?.storageKey ?? "";
                    const tags = taggedUsersByMedia[mediaKey] ?? [];
                    const draft = tagDraftByMedia[mediaKey] ?? "";
                    return (
                      <>
                        {tags.length > 0 && (
                          <div className="mb-2.5 flex flex-wrap gap-1.5">
                            {tags.map((username) => (
                              <span key={username} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-1.5 text-[11px] font-semibold text-[#2563EB] ring-1 ring-[#DBEAFE]">
                                <span dir="ltr">@{username}</span>
                                <button type="button" onClick={() => removeTagForMedia(mediaKey, username)} className="flex h-4 w-4 items-center justify-center rounded-full text-[#64748B] hover:bg-white hover:text-[#DC2626]" aria-label={`حذف تگ @${username}`}>
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input value={draft} onChange={(event) => handleTagInputChange(mediaKey, event.target.value)} onKeyDown={(event) => handleTagInputKeyDown(mediaKey, event)} placeholder="فقط نام کاربر را بدون @ بنویس" maxLength={30} inputMode="text" autoCapitalize="none" spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 !text-base leading-5 text-[#0F172A] outline-none placeholder:text-xs placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10" style={{ fontSize: "16px", lineHeight: 1.75, WebkitTextSizeAdjust: "100%" }}/>
                          <Button type="button" onClick={() => addTagForMedia(mediaKey)} disabled={!draft.trim()} className="shrink-0 rounded-lg bg-[#2563EB] px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">افزودن</Button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}


            </section>
          </div>
        ) : type !== "STORY" && tagStepConfirmed && automationChoiceStepStarted && !automationChoiceConfirmed ? (
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Button type="button" onClick={handlePreviousStep} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]">
                <ArrowRight size={15} strokeWidth={2}/>بازگشت
              </Button>
              
            </div>
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">۵</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">پاسخ خودکار <span className="text-[#2563EB]">(اختیاری)</span></h2>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">آیا می‌خواهی برای این محتوا پاسخ خودکار تنظیم شود؟</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => handleAutomationChoice(true)} className="group rounded-2xl border border-[#E2E8F0] bg-white p-4 text-right shadow-sm transition hover:border-[#BFDBFE] hover:bg-[#F8FBFF] active:scale-[0.99] sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition group-hover:bg-[#DBEAFE]"><Send size={18}/></span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F172A]">پاسخ خودکار می‌خواهم</p>
                      <p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">برای این محتوا پاسخ خودکار تنظیم کن.</p>
                    </div>
                  </div>
                </button>
                <button type="button" onClick={() => handleAutomationChoice(false)} className="group rounded-2xl border border-[#E2E8F0] bg-white p-4 text-right shadow-sm transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] active:scale-[0.99] sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8FAFC] text-[#64748B] transition group-hover:bg-[#F1F5F9]"><ArrowLeft size={18}/></span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F172A]">بدون پاسخ خودکار</p>
                      <p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">مستقیماً به مرحله انتشار برو.</p>
                    </div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        ) : type !== "STORY" && automationChoiceConfirmed && !automationEnabled ? (
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Button type="button" onClick={handlePreviousStep} className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]">
                <ArrowRight size={15} strokeWidth={2}/>بازگشت
              </Button>
            </div>
            <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-6 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10 text-xs font-bold text-[#2563EB]">۶</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0F172A]">زمان انتشار</h2>
                  <p className="mt-1.5 text-xs leading-5 text-[#64748B]">زمان انتشار این {typeLabels[type]} را انتخاب کن.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 sm:flex-row sm:items-center">
                  <Button type="button" disabled={!publishNow} onClick={() => void createJob(true)} className="min-h-11 w-full shrink-0 whitespace-nowrap rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1">
                    <Send size={17}/>انتشار {typeLabels[type]} هم‌اکنون
                  </Button>
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[#334155]">
                    <input type="checkbox" checked={!publishNow} onChange={(event) => {
                      const enabled = event.target.checked;
                      setPublishNow(!enabled);
                      if (!enabled) {
                        setStage6Date(null);
                        setStage6Hour(null);
                        setStage6Minute(null);
                      }
                      setError("");
                    }} className="h-4 w-4 accent-[#2563EB]" />
                    <span className="whitespace-nowrap">انتشار در زمان دلخواه</span>
                  </label>
                </div>

                {!publishNow && (
                  <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
                    <div className="mb-4">
                      <p className="text-sm font-bold text-[#0F172A]">انتخاب زمان دقیق</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#64748B]">تاریخ انتشار را انتخاب کن.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {[currentJalaliDate(), addJalaliDays(currentJalaliDate(), 1)].map((date, index) => {
                        const selected = stage6Date?.year === date.year && stage6Date?.month === date.month && stage6Date?.day === date.day;
                        const label = index === 0 ? "امروز" : "فردا";
                        return (
                          <button
                            key={`${date.year}-${date.month}-${date.day}`}
                            type="button"
                            onClick={() => { setStage6Date(date); setError(""); }}
                            className={["relative min-h-20 rounded-xl border px-3 py-3 text-right transition-all", selected ? "border-[#2563EB] bg-[#EFF6FF] ring-2 ring-[#2563EB]/10" : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FAFC]"].join(" ")}
                          >
                            <span className="block text-[11px] font-medium text-[#64748B]">{label}</span>
                            <span className="mt-1 block text-sm font-bold text-[#0F172A]">{toPersianDigits(date.day)} {jalaliMonths[date.month - 1]}</span>
                            <span className="mt-0.5 block text-[10px] text-[#64748B]">{toPersianDigits(date.year)}</span>
                            {selected && <span className="absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white text-[11px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                      <p className="mb-3 text-sm font-bold text-[#0F172A]">ساعت انتشار</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <label>
                          <span className="mb-1.5 block text-[11px] font-medium text-[#64748B]">ساعت</span>
                          <Select value={stage6Hour === null ? "" : stage6Hour} onChange={(e) => { setStage6Hour(e.target.value === "" ? null : Number(e.target.value)); setError(""); }} className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm">
                            <option value="">انتخاب ساعت</option>
                            {Array.from({length:24}, (_, value) => <option key={value} value={value}>{toPersianDigits(String(value).padStart(2, "0"))}</option>)}
                          </Select>
                        </label>
                        <label>
                          <span className="mb-1.5 block text-[11px] font-medium text-[#64748B]">دقیقه</span>
                          <Select value={stage6Minute === null ? "" : stage6Minute} onChange={(e) => { setStage6Minute(e.target.value === "" ? null : Number(e.target.value)); setError(""); }} className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm">
                            <option value="">انتخاب دقیقه</option>
                            {Array.from({length:60}, (_, value) => <option key={value} value={value}>{toPersianDigits(String(value).padStart(2, "0"))}</option>)}
                          </Select>
                        </label>
                      </div>
                    </div>

                    <Button type="button" onClick={() => void createJob(false)} disabled={publishing || !stage6Date || stage6Hour === null || stage6Minute === null} className="mt-5 min-h-11 w-full rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50">
                      {publishing ? <Loader2 size={17} className="animate-spin"/> : <CalendarClock size={17}/>} انتشار در زمان انتخاب‌شده
                    </Button>
                  </div>
                )}

                {error && <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-xs font-medium leading-5 text-[#B91C1C]" role="alert">{error}</div>}
              </div>
            </section>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <Button
                type="button"
                onClick={() => animateStepChange(() => {
                  setCaptionStepConfirmed(false);
                  setShowUploadedMediaPreview(type === "STORY" && uploadedMedia.length > 0);
                  setUploadProgress(0);
                })}
                className="min-h-9 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-xs font-semibold text-[#3B82F6] shadow-none hover:bg-[#DBEAFE] hover:text-[#2563EB]"
              >
                <ArrowRight size={15} strokeWidth={2} />
                بازگشت
              </Button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-5">
              {type !== "STORY" && (
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
                <SectionHeader n="۲" title={uploadTitle} text={uploadInstruction} />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {uploadedMedia.map((item)=><MediaTile key={item.storageKey} item={item} type={type} onRemove={() => void removeUploaded(item)} ready />)}
                  {media.map((item,index)=><MediaTile key={item.file.name+"-"+item.sortOrder} item={item} type={type} onRemove={() => removeLocal(index)} />)}
                </div>
                {uploading && <ProgressBar progress={uploadProgress} />}
              </section>              )}


              {uploadedMedia.length>0 && type!=="STORY" && <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><SectionHeader n="۳" title="کپشن" text={`کپشن ${typeLabels[type]} را بنویس.`}/><span className="text-[11px] text-[#64748B]">{toPersianDigits(caption.length)} / ۲۲۰۰</span></div>
                <Textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={2200} rows={6} className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" placeholder={`کپشن ${typeLabels[type]} را بنویس...`} />
              </section>}

              <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                <button type="button" onClick={()=>setAutomationEnabled(v=>!v)} className="flex w-full items-center justify-between gap-4 p-5 text-right sm:p-6">
                  <div className="flex min-w-0 items-start gap-3.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]">✦</span><div><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-[#0F172A]">اتوماسیون این محتوا</h2><span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold text-[#64748B]">اختیاری</span></div><p className="mt-1.5 text-xs leading-5 text-[#64748B]">پاسخ خودکار به کامنت یا Reply استوری را برای این محتوا فعال کن.</p></div></div>
                  <span className={["relative h-6 w-11 shrink-0 rounded-full transition",automationEnabled?"bg-[#7C3AED]":"bg-[#CBD5E1]"].join(" ")}><span className={["absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",automationEnabled?"right-1":"right-6"].join(" ")}/></span>
                </button>
                {automationEnabled && <div className="border-t border-[#E2E8F0] bg-[#FAFAFC] p-5 sm:p-6"><div className="space-y-7">
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5"><p className="text-sm font-bold text-[#0F172A]">{type==="STORY"?"کلمات کلیدی Reply استوری":"کلمات کلیدی کامنت"}</p><p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">کلمات یا عبارت‌هایی را وارد کن که این پاسخ را فعال می‌کنند.</p><div className="mt-3"><KeywordChipsInput value={keywords} onChange={setKeywords} placeholder={type==="STORY"?"مثلاً اطلاعات، قیمت":"مثلاً قیمت، اطلاعات"}/></div></div>
                  {type!=="STORY" && <label className="block"><span className="mb-2 block text-sm font-semibold text-[#0F172A]">پاسخ عمومی کامنت</span><Textarea value={commentReplyText} onChange={e=>setCommentReplyText(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10" placeholder="در صورت نیاز، پاسخ عمومی کامنت را بنویس..."/></label>}
                  {type==="STORY" && <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3.5"><span className="text-sm font-medium text-[#334155]">لایک خودکار Reply استوری</span><Checkbox checked={likeStoryReply} onCheckedChange={v=>setLikeStoryReply(Boolean(v))}/></label>}
                  <div><label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-3.5"><span className="text-sm font-medium text-[#334155]">بررسی Follow قبل از پاسخ</span><Checkbox checked={requireFollow} onCheckedChange={v=>setRequireFollow(Boolean(v))}/></label>{requireFollow&&<Textarea value={followGateText} onChange={e=>setFollowGateText(e.target.value)} rows={3} className="mt-2.5 w-full resize-none rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/10" placeholder="متن درخواست Follow را وارد کنید."/>}</div>
                  <div className="border-t border-[#E2E8F0] pt-7"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold text-[#0F172A]">پاسخ خودکار</p><p className="mt-1 text-[11px] text-[#64748B]">نوع پیام و مسیر پاسخ را مشخص کن.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] text-[#64748B] ring-1 ring-[#E2E8F0]">{toPersianDigits(messages.length)} پیام</span></div>
                    {messages.slice(0,1).map((message,index)=><div key={message.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 sm:p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-[#0F172A]">پیام {toPersianDigits(index+1)}</span><span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 text-[10px] font-semibold text-[#7C3AED]">{getMessageTypeLabel(message.messageType)}</span></div><AutomationFlowMessage triggerType={triggerType} message={message} index={index} total={messages.length} showcases={showcases} forms={forms} loadingResources={loadingResources} instagramAccountId={selectedAccountId} onShowcaseCreated={showcase=>setShowcases(current=>[showcase,...current.filter(item=>item.id!==showcase.id)])} onFormCreated={form=>setForms(current=>[form,...current.filter(item=>item.id!==form.id)])} onUpdate={patch=>updateMessage(index,patch)} onAddQuickReply={()=>addQuickReply(index)} onUpdateQuickReply={(id,patch)=>updateQuickReply(index,id,patch)} onUpdateQuickReplyTree={(id,updater)=>updateQuickReplyTree(index,id,updater)} onRemoveQuickReply={id=>removeQuickReply(index,id)}/></div>)}
                  </div>
                </div></div>}
              </section>
            </main>

            <aside className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm lg:sticky lg:top-5">
                <SectionHeader n="۴" title="زمان انتشار" text="تاریخ و ساعت انتشار را تنظیم کن."/>
                <PersianDatePicker value={scheduledDate} onChange={setScheduledDate}/>
                <div className="mt-3 grid grid-cols-2 gap-2.5"><label><span className="mb-1.5 block text-[11px] font-medium text-[#64748B]">ساعت</span><Select value={hour} onChange={e=>setHour(Number(e.target.value))} className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm">{Array.from({length:24},(_,v)=><option key={v} value={v}>{toPersianDigits(String(v).padStart(2,"0"))}</option>)}</Select></label><label><span className="mb-1.5 block text-[11px] font-medium text-[#64748B]">دقیقه</span><Select value={minute} onChange={e=>setMinute(Number(e.target.value))} className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm">{Array.from({length:12},(_,v)=>v*5).map(v=><option key={v} value={v}>{toPersianDigits(String(v).padStart(2,"0"))}</option>)}</Select></label></div>
                <div className="mt-4 rounded-xl bg-[#F8FAFC] px-3.5 py-3 text-xs leading-5 text-[#64748B]">انتشار فوری یا زمان‌بندی‌شده را از همین‌جا انتخاب کن.</div>
                <div className="mt-4 grid gap-2.5"><Button type="button" disabled={!canPublish||loading} onClick={()=>void createJob(true)} className="min-h-12 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50">{publishing?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>} انتشار الآن</Button><Button type="button" disabled={!canPublish||loading} onClick={()=>void createJob(false)} className="min-h-12 rounded-xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"><CalendarClock size={17}/> زمان‌بندی انتشار</Button></div>
              </section>

              {jobs.filter(job=>["PROCESSING","PUBLISHING","SCHEDULED"].includes(job.status)).length>0 && <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#0F172A]">انتشارهای فعال</h2><p className="mt-1 text-[11px] text-[#64748B]">زمان‌بندی یا پردازش در حال انجام</p></div><span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">{toPersianDigits(jobs.filter(job=>["PROCESSING","PUBLISHING","SCHEDULED"].includes(job.status)).length)}</span></div>
                <div className="space-y-2.5">{jobs.filter(job=>["PROCESSING","PUBLISHING","SCHEDULED"].includes(job.status)).map(job=><div key={job.id} className="rounded-xl border border-[#E2E8F0] p-2.5"><div className="flex items-center gap-3">{job.media[0]?(job.media[0].type==="IMAGE"?<img src={job.media[0].publicUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover"/>:<video src={job.media[0].publicUrl} className="h-14 w-14 shrink-0 rounded-lg object-cover"/>):<div className="h-14 w-14 shrink-0 rounded-lg bg-[#F1F5F9]"/>}<div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#0F172A]">{typeLabels[job.type]}</span><span className={["text-[10px] font-semibold",job.status==="SCHEDULED"?"text-[#D97706]":"text-[#2563EB]"].join(" ")}>{statusLabels[job.status]||job.status}</span></div><p className="mt-1 truncate text-[10px] leading-5 text-[#64748B]">{job.status==="SCHEDULED"?"انتشار در "+formatDate(job.scheduledAt):job.status==="PUBLISHING"?"محتوا در حال انتشار است.":"محتوا در حال پردازش است."}</p></div>{job.status!=="SCHEDULED"&&<Loader2 size={15} className="shrink-0 animate-spin text-[#2563EB]"/>}</div>{job.status==="SCHEDULED"&&<Button type="button" onClick={()=>void cancelJob(job.id)} className="mt-2.5 min-h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#64748B] hover:bg-[#F8FAFC]">لغو زمان‌بندی</Button>}</div>)}</div>
              </section>}
            </aside>
            </div>
          </div>
        )}
        </div>
        </div>
      {selectionConfirmed&&captionStepConfirmed&&tagStepConfirmed&&type==="STORY"&&!loading&&uploadedMedia.length>0&&<div className="fixed inset-x-3 z-40 rounded-2xl border border-[#E2E8F0] bg-white/95 p-2.5 shadow-lg backdrop-blur sm:hidden"><div className="grid grid-cols-2 gap-2"><Button type="button" disabled={!canPublish||publishing} onClick={()=>void createJob(true)} className="min-h-11 rounded-xl bg-[#2563EB] px-3 text-xs font-semibold text-white disabled:opacity-50">{publishing?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>} انتشار الآن</Button><Button type="button" disabled={!canPublish||publishing} onClick={()=>void createJob(false)} className="min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#334155] disabled:opacity-50"><CalendarClock size={16}/> زمان‌بندی</Button></div></div>}
      </div>
    </>
  );
}