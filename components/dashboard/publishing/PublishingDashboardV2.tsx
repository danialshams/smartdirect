"use client";
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { faIR } from "@daypicker/persian"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

import { toast } from "sonner";
import { CalendarClock, Camera, Clapperboard, ImagePlus, Images, Loader2, Plus, Send, Video, X } from "lucide-react";
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

const typeLabels: Record<PublishType, string> = { POST: "پست", CAROUSEL: "Carousel", REEL: "Reel", STORY: "Story" };
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
function jalaliDateTimeToDate(date: JalaliDate, hour: number, minute: number) { const [gy, gm, gd] = jalaliToGregorian(date.year, date.month, date.day); return new Date(gy, gm - 1, gd, hour, minute, 0, 0); }
function uploadFileWithProgress(file: File, onProgress: (progress: number) => void): Promise<{ storageKey: string; publicUrl: string; type: MediaType; fileName: string; mimeType: string; fileSize: number }> { return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/instagram/publishing/upload"); xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); }; xhr.onerror = () => reject(new Error("آپلود فایل ناموفق بود.")); xhr.onload = () => { try { const result = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300 || !result.success) { reject(new Error(result.message || "آپلود فایل ناموفق بود.")); return; } resolve(result.data); } catch { reject(new Error("پاسخ نامعتبر از سرور دریافت شد.")); } }; const formData = new FormData(); formData.append("file", file); xhr.send(formData); }); }

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
          onSelect={(date) => {
            if (!date) return;
            onChange(gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate()));
          }}
          dir="rtl"
          locale={faIR}
          numerals="arabext"
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
  return <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:border-ring">{keywords.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">{item}<Button type="button" onClick={() => sync(keywords.filter((keyword) => keyword !== item))} className="text-muted-foreground hover:text-foreground" aria-label={`حذف ${item}`}><X size={13} /></Button></span>)}<Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (["Enter", ",", "،"].includes(event.key)) { event.preventDefault(); add(); } }} onBlur={add} placeholder={keywords.length ? "کلمه بعدی..." : placeholder} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none" /><Button type="button" onClick={add} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">افزودن کلمه</Button></div>;
}

export default function PublishingDashboardV2({ onTypeChange }: { onTypeChange?: (type: PublishType) => void }) {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const knownJobIdsRef = useRef(new Set<string>());
  const [isDragging, setIsDragging] = useState(false);
  const [type, setType] = useState<PublishType>("POST");
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
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
  const [minute, setMinute] = useState(() => { const rounded = Math.ceil(new Date().getMinutes() / 5) * 5; return rounded >= 60 ? 0 : rounded; });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const triggerType = type === "STORY" ? "STORY_REPLY_KEYWORD" : "COMMENT_KEYWORD";
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
  async function loadJobs() { const response = await fetch("/api/instagram/publishing", { cache: "no-store" }); if (!response.ok) throw new Error("دریافت Publishing Jobs ناموفق بود."); const result = await response.json(); setJobs(result.data ?? []); }
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
  function resetAutomation() { setKeywords(""); setMessages([createEmptyMessage()]); setCommentReplyText(""); setLikeStoryReply(false); setRequireFollow(false); setFollowGateText("برای دریافت پاسخ، ابتدا پیج را Follow کنید."); }
  function handleTypeChange(nextType: PublishType) { clearLocalMedia(); setUploadedMedia([]); setType(nextType); onTypeChange?.(nextType); setUploadProgress(0); setCaption(""); resetAutomation(); }
  function prepareFiles(files: File[]) { if (!files.length || uploading || publishing) return; const accepted = type === "REEL" ? files.filter((file) => file.type.startsWith("video/")) : type === "STORY" ? files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")) : files.filter((file) => file.type.startsWith("image/")); if (!accepted.length) { setError(type === "REEL" ? "برای Reel یک فایل ویدیویی انتخاب کنید." : "فرمت فایل انتخاب‌شده برای این نوع محتوا معتبر نیست."); return; } const remaining = type === "CAROUSEL" ? Math.max(0, 10 - uploadedMedia.length) : 1; const selected = accepted.slice(0, remaining); if (type !== "CAROUSEL") setUploadedMedia([]); if (type === "CAROUSEL" && selected.length < 2 && uploadedMedia.length === 0) { setError("برای Carousel حداقل دو تصویر را همزمان انتخاب کنید."); return; } clearLocalMedia(); const nextMedia = selected.map((file, index): LocalMedia => ({ file, type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE", previewUrl: URL.createObjectURL(file), sortOrder: index })); setMedia(nextMedia); setError(""); window.setTimeout(() => void uploadSelectedMedia(nextMedia), 0); }
  function handleFiles(event: ChangeEvent<HTMLInputElement>) { const files = Array.from(event.target.files ?? []); event.target.value = ""; prepareFiles(files); }
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setIsDragging(false); prepareFiles(Array.from(event.dataTransfer.files ?? [])); }
  function removeLocal(index: number) { const item = media[index]; if (item) URL.revokeObjectURL(item.previewUrl); setMedia((current) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + uploadedMedia.length }))); }
  async function removeUploaded(item: UploadedMedia) { try { const response = await fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: item.storageKey }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "حذف فایل ناموفق بود."); setUploadedMedia((current) => current.filter((m) => m.storageKey !== item.storageKey).map((m, i) => ({ ...m, sortOrder: i }))); } catch (e) { setError(e instanceof Error ? e.message : "حذف فایل ناموفق بود."); } }
  async function uploadSelectedMedia(items = media) { if (!selectedAccountId) { setError("اکانت فعال Instagram پیدا نشد."); return; } if (!items.length) return; if (type === "CAROUSEL" && items.length + uploadedMedia.length < 2) { setError("Carousel باید حداقل دو تصویر داشته باشد."); return; } try { setUploading(true); setError(""); setUploadProgress(0); const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0); let completedBytes = 0; const results: UploadedMedia[] = []; for (let index = 0; index < items.length; index += 1) { const item = items[index]; setUploadIndex(index + 1); const result = await uploadFileWithProgress(item.file, (progress) => setUploadProgress(totalBytes ? Math.min(100, Math.round(((completedBytes + item.file.size * progress / 100) / totalBytes) * 100)) : progress)); results.push({ ...result, sortOrder: uploadedMedia.length + results.length }); completedBytes += item.file.size; } revokeLocalMedia(items); setMedia((current) => current.filter((item) => !items.includes(item))); setUploadedMedia((current) => [...current, ...results].map((item, index) => ({ ...item, sortOrder: index }))); setUploadProgress(100); } catch (e) { setError(e instanceof Error ? e.message : "آپلود فایل ناموفق بود."); } finally { setUploading(false); } }

  function updateMessage(index: number, patch: Partial<MessageDraft>) { setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, ...patch } : message)); }
  function addMessage() { setMessages((current) => [...current, createEmptyMessage()]); }
  function addQuickReply(index: number) { setMessages((current) => current.map((message, messageIndex) => messageIndex === index ? { ...message, quickReplies: [...message.quickReplies, createEmptyQuickReply()] } : message)); }
  function updateQuickReply(messageIndex: number, quickReplyId: string, patch: Partial<MessageDraft["quickReplies"][number]>) { setMessages((current) => current.map((message, index) => index === messageIndex ? { ...message, quickReplies: message.quickReplies.map((qr) => qr.id === quickReplyId ? { ...qr, ...patch } : qr) } : message)); }
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
          const response = await fetch(`/api/automations/${automationId}/messages/${serverMessageId}/quick-replies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: quickReply.title.trim(), payload: quickReply.payload, destinationType: quickReply.destinationType, destinationText: quickReply.destinationText.trim() || null, destinationFormId: quickReply.destinationFormId || null, destinationShowcaseId: quickReply.destinationShowcaseId || null }) });
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
    if (type === "CAROUSEL" && uploadedMedia.length < 2) { setError("Carousel باید حداقل دو تصویر داشته باشد."); return; }
    if (type !== "CAROUSEL" && uploadedMedia.length !== 1) { setError(`${typeLabels[type]} باید دقیقاً یک فایل داشته باشد.`); return; }
    const scheduled = jalaliDateTimeToDate(scheduledDate, hour, minute);
    if (!publishNow && scheduled.getTime() <= Date.now()) { setError("زمان‌بندی باید در آینده باشد."); return; }
    try {
      setPublishing(true); setError("");
      const automationId = await createAutomation();
      const response = await fetch("/api/instagram/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagramAccountId: accountId, type, caption: type === "STORY" ? null : caption.trim() || null, scheduledAt: publishNow ? null : scheduled.toISOString(), idempotencyKey: crypto.randomUUID(), commentAutomationId: type === "STORY" ? null : automationId, storyReplyAutomationId: type === "STORY" ? automationId : null, media: uploadedMedia }) });
      const result = await response.json();
      if (!response.ok) { await fetch(`/api/automations/${automationId}`, { method: "DELETE" }).catch(() => undefined); throw new Error(result.message || "ساخت Publishing Job ناموفق بود."); }
      const job = result.data as Job;
      if (publishNow) {
        const publishResponse = await fetch(`/api/instagram/publishing/${job.id}/publish`, { method: "POST" });
        const publishResult = await publishResponse.json();
        if (!publishResponse.ok) throw new Error(publishResult.message || "انتشار ناموفق بود.");
        toast.success("محتوا با موفقیت منتشر شد.");
      } else {
        knownJobIdsRef.current.add(job.id);
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
        toast.success("محتوا برای زمان‌بندی ثبت شد.");
      }
      setCaption(""); setUploadedMedia([]); resetAutomation(); setUploadProgress(0); setScheduledDate(currentJalaliDate()); await loadJobs();
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در انتشار محتوا."); } finally { setPublishing(false); }
  }

  async function retryJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}/retry`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Retry ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "Retry ناموفق بود."); } }
  async function cancelJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "لغو ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "لغو ناموفق بود."); } }

  const canPublish = uploadedMedia.length > 0 && !uploading && !publishing;
  const accept = type === "REEL" ? "video/mp4,video/quicktime" : type === "STORY" ? "image/jpeg,image/png,image/webp,video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp";

  return (
    <div dir="rtl" className="min-h-screen bg-background px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-2xl">
        {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
        <div className="space-y-4">
          <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm">
            <div className="border-b border-border/70 px-4 pb-4 pt-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-foreground">انتشار محتوا</p>
                  {activeInstagramAccount?.igUsername && <p className="mt-1 text-xs text-muted-foreground" dir="ltr">@{activeInstagramAccount.igUsername}</p>}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">{type === "REEL" ? <Video size={18} /> : <ImagePlus size={18} />}</div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              <div>
                <p className="mb-2.5 text-xs font-semibold text-muted-foreground">نوع محتوا</p>
                <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
                  {([
                    ["POST", "پست", ImagePlus],
                    ["CAROUSEL", "Carousel", Images],
                    ["REEL", "Reel", Clapperboard],
                    ["STORY", "Story", Camera],
                  ] as const).map(([value, label, Icon]) => (
                    <Button key={value} type="button" onClick={() => handleTypeChange(value)} className={["flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 text-[11px] font-semibold transition sm:min-h-16 sm:text-xs", type === value ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "bg-transparent text-muted-foreground hover:bg-background/70"].join(" ")}>
                      <Icon size={17} />{label}
                    </Button>
                  ))}
                </div>
              </div>

              <div
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); prepareFiles(Array.from(event.dataTransfer.files ?? [])); }}
                className={["relative overflow-hidden rounded-2xl border border-dashed p-5 text-center transition sm:p-8", isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/30", uploading || publishing ? "pointer-events-none opacity-70" : ""].join(" ")}
              >
                <Input id="publishing-media-upload" type="file" accept={accept} multiple={type === "CAROUSEL"} onChange={handleFiles} disabled={uploading || publishing || (type === "CAROUSEL" && uploadedMedia.length >= 10)} className="sr-only" />
                <label htmlFor="publishing-media-upload" className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center sm:min-h-[250px]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/70">{uploading ? <Loader2 size={25} className="animate-spin text-primary" /> : <ImagePlus size={25} className="text-primary" />}</div>
                  <span className="mt-4 text-sm font-bold text-foreground">{uploading ? "در حال آپلود..." : "محتوا را انتخاب کنید"}</span>
                  <span className="mt-1.5 max-w-[280px] text-xs leading-6 text-muted-foreground">{type === "CAROUSEL" ? "۲ تا ۱۰ تصویر را همزمان انتخاب کنید." : type === "REEL" ? "ویدیوی Reel را انتخاب کنید." : type === "STORY" ? "تصویر یا ویدیوی Story را انتخاب کنید." : "تصویر پست را انتخاب کنید."}</span>
                  {uploading && <div className="mt-5 w-full max-w-xs"><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>فایل {toPersianDigits(uploadIndex)}</span><span>{toPersianDigits(uploadProgress)}٪</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: String(uploadProgress) + "%" }} /></div></div>}
                </label>
              </div>

              {(media.length > 0 || uploadedMedia.length > 0) && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">محتوای انتخاب‌شده</p><span className="text-[11px] text-muted-foreground">{toPersianDigits(uploadedMedia.length + media.length)} فایل</span></div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {uploadedMedia.map((item) => <div key={item.storageKey} className="group relative overflow-hidden rounded-2xl border bg-muted">
                      {item.type === "IMAGE" ? <img src={item.publicUrl} alt={item.fileName} className="aspect-square w-full object-cover" /> : <video src={item.publicUrl} controls className="aspect-square w-full object-cover" />}
                      <Button type="button" onClick={() => void removeUploaded(item)} className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 p-0 text-red-600 shadow-sm" aria-label="حذف فایل"><X size={15} /></Button>
                    </div>)}
                    {media.map((item, index) => <div key={item.file.name + "-" + item.sortOrder} className="relative overflow-hidden rounded-2xl border border-dashed bg-muted">
                      {item.type === "IMAGE" ? <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full object-cover" /> : <video src={item.previewUrl} controls className="aspect-square w-full object-cover" />}
                      <Button type="button" onClick={() => removeLocal(index)} className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/95 p-0 text-red-600 shadow-sm" aria-label="حذف فایل"><X size={15} /></Button>
                    </div>)}
                  </div>
                </div>
              )}

              <div className="border-t border-border/70 pt-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><p className="text-sm font-bold text-foreground">اتوماسیون این محتوا</p><p className="mt-1 text-xs leading-5 text-muted-foreground">واکنش Instagram را برای همین محتوا تنظیم کنید.</p></div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">{type === "STORY" ? "Reply استوری" : "کامنت"}</span>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold text-foreground">{type === "STORY" ? "کلمات کلیدی Reply استوری" : "کلمات کلیدی کامنت"}</span>
                    <KeywordChipsInput value={keywords} onChange={setKeywords} placeholder={type === "STORY" ? "مثلاً 1، اطلاعات، قیمت" : "مثلاً 1، یک، قیمت"} />
                  </label>
                  {type !== "STORY" && <>
                    <label className="block"><span className="mb-2 block text-xs font-semibold text-foreground">پاسخ عمومی کامنت</span><Textarea value={commentReplyText} onChange={(e) => setCommentReplyText(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-ring" placeholder="در صورت نیاز، پاسخ عمومی کامنت را بنویسید." /></label>
                  </>}
                  {type === "STORY" && <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5"><span className="text-sm text-foreground">لایک خودکار Reply استوری</span><Checkbox checked={likeStoryReply} onCheckedChange={(checked) => setLikeStoryReply(Boolean(checked))} /></label>}
                  <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5"><span className="text-sm text-foreground">بررسی Follow قبل از پاسخ</span><Checkbox checked={requireFollow} onCheckedChange={(checked) => setRequireFollow(Boolean(checked))} /></label>
                  {requireFollow && <Textarea value={followGateText} onChange={(e) => setFollowGateText(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-3 text-sm leading-6 outline-none focus:border-ring" placeholder="متن درخواست Follow را وارد کنید." />}
                </div>
              </div>

              <div className="border-t border-border/70 pt-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><p className="text-sm font-bold text-foreground">پاسخ</p><p className="mt-1 text-xs leading-5 text-muted-foreground">نوع پیام را انتخاب کنید و مسیر پاسخ را بسازید.</p></div>
                  <span className="text-[11px] text-muted-foreground">{toPersianDigits(messages.length)} پیام</span>
                </div>
                <div className="space-y-3">
                  {messages.slice(0, 1).map((message, index) => (
                    <div key={message.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-sm font-bold text-foreground">پیام {toPersianDigits(index + 1)}</span><span className="rounded-full bg-background px-2.5 py-1 text-[10px] text-muted-foreground ring-1 ring-border/70">{getMessageTypeLabel(message.messageType)}</span></div>
                      <AutomationFlowMessage triggerType={triggerType} message={message} index={index} total={messages.length} showcases={showcases} forms={forms} loadingResources={loadingResources} instagramAccountId={selectedAccountId} onShowcaseCreated={(showcase) => setShowcases((current) => [showcase, ...current.filter((item) => item.id !== showcase.id)])} onFormCreated={(form) => setForms((current) => [form, ...current.filter((item) => item.id !== form.id)])} onUpdate={(patch) => updateMessage(index, patch)} onAddQuickReply={() => addQuickReply(index)} onUpdateQuickReply={(quickReplyId, patch) => updateQuickReply(index, quickReplyId, patch)} onRemoveQuickReply={(quickReplyId) => removeQuickReply(index, quickReplyId)} />
                    </div>
                  ))}
                </div>
              </div>

              {uploadedMedia.length > 0 && (
                <div className="space-y-4 border-t border-border/70 pt-5">
                  {type !== "STORY" && <label className="block"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Caption</span><span className="text-[10px] text-muted-foreground">{toPersianDigits(caption.length)}/2200</span></div><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} rows={4} className="w-full resize-none rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm leading-7 outline-none focus:border-ring" placeholder="کپشن محتوا را بنویسید." /></label>}
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5 sm:p-4">
                    <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-bold text-foreground">زمان‌بندی</p><p className="mt-1 text-[11px] text-muted-foreground">تاریخ و ساعت انتشار</p></div><CalendarClock size={18} className="text-muted-foreground" /></div>
                    <PersianDatePicker value={scheduledDate} onChange={setScheduledDate} />
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <label><span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">ساعت</span><Select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">{Array.from({ length: 24 }, (_, v) => <option key={v} value={v}>{toPersianDigits(String(v).padStart(2, "0"))}</option>)}</Select></label>
                      <label><span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">دقیقه</span><Select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">{Array.from({ length: 12 }, (_, v) => v * 5).map((v) => <option key={v} value={v}>{toPersianDigits(String(v).padStart(2, "0"))}</option>)}</Select></label>
                    </div>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Button type="button" disabled={!canPublish || loading} onClick={() => void createJob(true)} className="min-h-12 rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50">{publishing ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}انتشار الآن</Button>
                    <Button type="button" disabled={!canPublish || loading} onClick={() => void createJob(false)} className="min-h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"><CalendarClock size={17} />زمان‌بندی انتشار</Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {jobs.filter((job) => job.status !== "PUBLISHED" && job.status !== "CANCELLED").length > 0 && (
            <section className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-sm font-bold text-foreground">محتوای فعال</p><p className="mt-1 text-[11px] text-muted-foreground">آپلود، انتشار یا زمان‌بندی‌های در انتظار</p></div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">{toPersianDigits(jobs.filter((job) => job.status !== "PUBLISHED" && job.status !== "CANCELLED").length)}</span>
              </div>
              <div className="space-y-2">
                {jobs.filter((job) => job.status !== "PUBLISHED" && job.status !== "CANCELLED").map((job) => (
                  <div key={job.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-2.5">
                    {job.media[0] ? (job.media[0].type === "IMAGE" ? <img src={job.media[0].publicUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <video src={job.media[0].publicUrl} className="h-14 w-14 shrink-0 rounded-xl object-cover" />) : <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />}
                    <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-foreground">{typeLabels[job.type]}</span><span className="text-[11px] text-muted-foreground">{statusLabels[job.status] || job.status}</span></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{job.status === "SCHEDULED" ? "انتشار در " + formatDate(job.scheduledAt) : "محتوا در حال پردازش است."}</p></div>
                    {job.status !== "SCHEDULED" && <Loader2 size={16} className="shrink-0 animate-spin text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
