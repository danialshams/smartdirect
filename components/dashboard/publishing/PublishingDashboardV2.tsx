"use client";
import { Checkbox } from "@/components/dashboard/DashboardUI"
import { Textarea } from "@/components/dashboard/DashboardUI"
import { Button } from "@/components/dashboard/DashboardUI"
import { Calendar } from "@/components/dashboard/DashboardUI"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/dashboard/DashboardUI"
import { Input } from "@/components/dashboard/DashboardUI"
import { Select } from "@/components/dashboard/DashboardUI"

import { toast } from "sonner";
import { CalendarClock, Camera, Clapperboard, ImagePlus, Images, Loader2, MessageSquare, Plus, Send, Video, X } from "lucide-react";
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
  return <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 focus-within:border-ring">{keywords.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground">{item}<Button type="button" onClick={() => sync(keywords.filter((keyword) => keyword !== item))} className="text-muted-foreground hover:text-foreground" aria-label={`حذف ${item}`}><X size={13} /></Button></span>)}<Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (["Enter", ",", "،"].includes(event.key)) { event.preventDefault(); add(); } }} onBlur={add} placeholder={keywords.length ? "کلمه بعدی..." : placeholder} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none" /><Button type="button" onPointerDown={(event) => event.preventDefault()} onClick={add} className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">افزودن کلمه</Button></div>;
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
  function handleTypeChange(nextType: PublishType) { clearLocalMedia(); setUploadedMedia([]); setType(nextType); onTypeChange?.(nextType); setUploadProgress(0); setCaption(""); resetAutomation(); }
  function prepareFiles(files: File[]) { if (!files.length || uploading || publishing) return; const accepted = type === "REEL" ? files.filter((file) => file.type.startsWith("video/")) : type === "STORY" ? files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")) : files.filter((file) => file.type.startsWith("image/")); if (!accepted.length) { setError(type === "REEL" ? "برای ریلز یک فایل ویدیویی انتخاب کنید." : "فرمت فایل انتخاب‌شده برای این نوع محتوا معتبر نیست."); return; } const remaining = type === "CAROUSEL" ? Math.max(0, 10 - uploadedMedia.length) : 1; const selected = accepted.slice(0, remaining); if (type !== "CAROUSEL") setUploadedMedia([]); if (type === "CAROUSEL" && selected.length < 2 && uploadedMedia.length === 0) { setError("برای ساخت آلبوم، حداقل دو تصویر را همزمان انتخاب کنید."); return; } clearLocalMedia(); const nextMedia = selected.map((file, index): LocalMedia => ({ file, type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE", previewUrl: URL.createObjectURL(file), sortOrder: index })); setMedia(nextMedia); setError(""); window.setTimeout(() => void uploadSelectedMedia(nextMedia), 0); }
  function handleFiles(event: ChangeEvent<HTMLInputElement>) { const files = Array.from(event.target.files ?? []); event.target.value = ""; prepareFiles(files); }
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setIsDragging(false); prepareFiles(Array.from(event.dataTransfer.files ?? [])); }
  function removeLocal(index: number) { const item = media[index]; if (item) URL.revokeObjectURL(item.previewUrl); setMedia((current) => current.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + uploadedMedia.length }))); }
  async function removeUploaded(item: UploadedMedia) { try { const response = await fetch("/api/instagram/publishing/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storageKey: item.storageKey }) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "حذف فایل ناموفق بود."); setUploadedMedia((current) => current.filter((m) => m.storageKey !== item.storageKey).map((m, i) => ({ ...m, sortOrder: i }))); } catch (e) { setError(e instanceof Error ? e.message : "حذف فایل ناموفق بود."); } }
  async function uploadSelectedMedia(items = media) { if (!selectedAccountId) { setError("اکانت فعال Instagram پیدا نشد."); return; } if (!items.length) return; if (type === "CAROUSEL" && items.length + uploadedMedia.length < 2) { setError("آلبوم باید حداقل دو تصویر داشته باشد."); return; } try { setUploading(true); setError(""); setUploadProgress(0); const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0); let completedBytes = 0; const results: UploadedMedia[] = []; for (let index = 0; index < items.length; index += 1) { const item = items[index]; setUploadIndex(index + 1); const result = await uploadFileWithProgress(item.file, (progress) => setUploadProgress(totalBytes ? Math.min(100, Math.round(((completedBytes + item.file.size * progress / 100) / totalBytes) * 100)) : progress)); results.push({ ...result, sortOrder: uploadedMedia.length + results.length }); completedBytes += item.file.size; } revokeLocalMedia(items); setMedia((current) => current.filter((item) => !items.includes(item))); setUploadedMedia((current) => [...current, ...results].map((item, index) => ({ ...item, sortOrder: index }))); setUploadProgress(100); } catch (e) { setError(e instanceof Error ? e.message : "آپلود فایل ناموفق بود."); } finally { setUploading(false); } }

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
    if (type === "CAROUSEL" && uploadedMedia.length < 2) { setError("Carousel باید حداقل دو تصویر داشته باشد."); return; }
    if (type !== "CAROUSEL" && uploadedMedia.length !== 1) { setError(`${typeLabels[type]} باید دقیقاً یک فایل داشته باشد.`); return; }
    const scheduled = jalaliDateTimeToDate(scheduledDate, hour, minute);
    if (!publishNow && scheduled.getTime() <= Date.now()) { setError("زمان‌بندی باید در آینده باشد."); return; }
    try {
      setPublishing(true); setError("");
      const automationId = automationEnabled ? await createAutomation() : null;
      const response = await fetch("/api/instagram/publishing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagramAccountId: accountId, type, caption: type === "STORY" ? null : caption.trim() || null, scheduledAt: publishNow ? null : scheduled.toISOString(), idempotencyKey: crypto.randomUUID(), commentAutomationId: type === "STORY" ? null : automationId, storyReplyAutomationId: type === "STORY" ? automationId : null, media: uploadedMedia }) });
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
      setCaption(""); setUploadedMedia([]); resetAutomation(); setUploadProgress(0); setScheduledDate(currentJalaliDate()); await loadJobs();
    } catch (e) { setError(e instanceof Error ? e.message : "خطا در انتشار محتوا."); } finally { setPublishing(false); }
  }

  async function retryJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}/retry`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "Retry ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "Retry ناموفق بود."); } }
  async function cancelJob(id: string) { try { setError(""); const response = await fetch(`/api/instagram/publishing/${id}`, { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw new Error(result.message || "لغو ناموفق بود."); await loadJobs(); } catch (e) { setError(e instanceof Error ? e.message : "لغو ناموفق بود."); } }

  const canPublish = uploadedMedia.length > 0 && !uploading && !publishing;
  const accept = type === "REEL" ? "video/mp4,video/quicktime" : type === "STORY" ? "image/jpeg,image/png,image/webp,video/mp4,video/quicktime" : "image/jpeg,image/png,image/webp";

  const activeJobs = jobs.filter((job) => ["PROCESSING", "PUBLISHING", "SCHEDULED"].includes(job.status));
  const hasMedia = media.length > 0 || uploadedMedia.length > 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F7FB] px-3 py-4 text-[#0F172A] sm:px-5 sm:py-7 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#DCE8FA] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#315D9B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
              انتشار و زمان‌بندی
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-[30px]">انتشار محتوا</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748B]">فایل را اضافه کنید، متن را بنویسید و زمان انتشار را مشخص کنید.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.025)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><CalendarClock size={19} /></div>
            <div>
              <p className="text-xs font-bold text-[#334155]">انتشارهای در جریان</p>
              <p className="mt-1 text-lg font-extrabold leading-none text-[#0F172A]">{toPersianDigits(activeJobs.length)}</p>
            </div>
          </div>
        </header>

        {loading && (
          <div aria-label="در حال بارگذاری اطلاعات انتشار" className="grid animate-pulse gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5"><div className="h-5 w-28 rounded-lg bg-[#E2E8F0]" /><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="h-24 rounded-2xl bg-[#F1F5F9]" />)}</div><div className="mt-5 h-64 rounded-2xl bg-[#F1F5F9]" /></div>
              <div className="h-48 rounded-3xl border border-[#E2E8F0] bg-white p-5"><div className="h-5 w-36 rounded-lg bg-[#E2E8F0]" /><div className="mt-5 h-24 rounded-2xl bg-[#F1F5F9]" /></div>
            </div>
            <div className="hidden h-80 rounded-3xl border border-[#E2E8F0] bg-white p-5 lg:block"><div className="h-5 w-28 rounded-lg bg-[#E2E8F0]" /><div className="mt-5 h-12 rounded-xl bg-[#F1F5F9]" /><div className="mt-3 h-12 rounded-xl bg-[#F1F5F9]" /><div className="mt-8 h-24 rounded-2xl bg-[#F1F5F9]" /></div>
          </div>
        )}

        {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-3.5 text-sm leading-6 text-[#B91C1C]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] font-bold">!</span><span>{error}</span></div>}

        {!loading && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
            <main className="min-w-0 space-y-5">
              <section className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.025)]">
                <div className="border-b border-[#EEF2F7] px-4 py-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-sm font-extrabold text-[#2563EB]">۱</span>
                    <div><h2 className="text-base font-extrabold">چه چیزی منتشر می‌کنید؟</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">نوع محتوا را انتخاب کنید تا تنظیمات فایل متناسب با آن نمایش داده شود.</p></div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {([
                      ["POST", "پست", "یک تصویر", ImagePlus],
                      ["CAROUSEL", "آلبوم", "۲ تا ۱۰ تصویر", Images],
                      ["REEL", "ریلز", "ویدیویی", Clapperboard],
                      ["STORY", "استوری", "تصویر یا ویدیو", Camera],
                    ] as const).map(([value, label, hint, Icon]) => {
                      const selected = type === value;
                      return (
                        <Button key={value} type="button" aria-pressed={selected} onClick={() => handleTypeChange(value)} className={["group flex min-h-[112px] flex-col items-start justify-between rounded-2xl border p-3.5 text-right transition duration-150 sm:min-h-[124px] sm:p-4", selected ? "border-[#2563EB] bg-[#F0F6FF] shadow-[0_0_0_2px_rgba(37,99,235,0.08)]" : "border-[#E2E8F0] bg-white hover:border-[#B8CBE7] hover:bg-[#FAFCFF]"].join(" ")}>
                          <span className="flex w-full items-center justify-between gap-2"><span className={["flex h-9 w-9 items-center justify-center rounded-xl", value === "POST" ? "bg-[#DBEAFE] text-[#1D4ED8]" : value === "CAROUSEL" ? "bg-[#F3E8FF] text-[#7E22CE]" : value === "REEL" ? "bg-[#FFEDD5] text-[#C2410C]" : "bg-[#FCE7F3] text-[#BE185D]"].join(" ")}><Icon size={19} /></span>{selected && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-white"><span className="text-[11px]">✓</span></span>}</span>
                          <span><span className={["block text-sm font-extrabold", selected ? "text-[#1D4ED8]" : "text-[#1E293B]"].join(" ")}>{label}</span><span className="mt-1 block text-[11px] font-normal text-[#64748B]">{hint}</span></span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="px-4 py-5 sm:px-6 sm:py-6">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-sm font-extrabold text-[#475569]">۲</span>
                    <div><h2 className="text-base font-extrabold">رسانه محتوا</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">{type === "CAROUSEL" ? "تصاویر آلبوم را با هم انتخاب کنید؛ ترتیب آن‌ها از همین‌جا مشخص می‌شود." : type === "REEL" ? "یک فایل ویدیویی برای ریلز انتخاب کنید." : type === "STORY" ? "یک تصویر یا ویدیو برای استوری انتخاب کنید." : "یک تصویر برای پست انتخاب کنید."}</p></div>
                  </div>

                  {!hasMedia && (
                    <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={["rounded-2xl border-2 border-dashed px-4 py-7 text-center transition sm:px-8 sm:py-10", isDragging ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#93B4E8] hover:bg-[#F7FAFF]", uploading || publishing ? "pointer-events-none opacity-60" : ""].join(" ")}>
                      <Input id="publishing-media-upload" type="file" accept={accept} multiple={type === "CAROUSEL"} onChange={handleFiles} disabled={uploading || publishing || (type === "CAROUSEL" && uploadedMedia.length >= 10)} className="sr-only" />
                      <label htmlFor="publishing-media-upload" className="mx-auto flex max-w-sm cursor-pointer flex-col items-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#2563EB] shadow-sm ring-1 ring-[#D7E5FA]">{uploading ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={24} />}</span>
                        <span className="mt-4 text-sm font-extrabold text-[#0F172A]">{uploading ? "در حال بارگذاری فایل..." : "انتخاب فایل"}</span>
                        <span className="mt-1.5 text-xs leading-6 text-[#64748B]">برای انتخاب از دستگاه لمس کنید یا فایل را اینجا رها کنید.</span>
                        <span className="mt-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">{type === "CAROUSEL" ? "حداکثر ۱۰ تصویر" : type === "REEL" ? "MP4 یا MOV" : type === "STORY" ? "تصویر یا ویدیو" : "JPG، PNG یا WebP"}</span>
                        {uploading && <div className="mt-5 w-full"><div className="mb-2 flex justify-between text-[11px] text-[#64748B]"><span>فایل {toPersianDigits(uploadIndex)}</span><span>{toPersianDigits(uploadProgress)}٪</span></div><div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]"><div className="h-full rounded-full bg-[#2563EB] transition-[width]" style={{ width: String(uploadProgress) + "%" }} /></div></div>}
                      </label>
                    </div>
                  )}

                  {hasMedia && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">پیش‌نمایش رسانه</p><p className="mt-1 text-xs text-[#64748B]">فایل‌های انتخاب‌شده را بررسی کنید و در صورت نیاز حذف کنید.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#1D4ED8]">{toPersianDigits(uploadedMedia.length + media.length)} فایل</span><Button type="button" disabled={uploading || publishing} onClick={() => { clearLocalMedia(); setUploadedMedia([]); setUploadProgress(0); }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9]">تغییر فایل</Button></div></div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {uploadedMedia.map((item) => <div key={item.storageKey} className="group relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9]">
                          {item.type === "IMAGE" ? <img src={item.publicUrl} alt={item.fileName} className="aspect-square w-full object-cover" /> : <video src={item.publicUrl} controls className="aspect-square w-full object-cover" />}
                          <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-[#334155] shadow-sm">{item.type === "IMAGE" ? "تصویر" : "ویدیو"}</span>
                          <Button type="button" onClick={() => void removeUploaded(item)} className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 p-0 text-[#B91C1C] shadow-sm hover:bg-white" aria-label="حذف فایل"><X size={15} /></Button>
                        </div>)}
                        {media.map((item, index) => <div key={item.file.name + "-" + item.sortOrder} className="relative overflow-hidden rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F1F5F9]">
                          {item.type === "IMAGE" ? <img src={item.previewUrl} alt={item.file.name} className="aspect-square w-full object-cover" /> : <video src={item.previewUrl} controls className="aspect-square w-full object-cover" />}
                          <Button type="button" onClick={() => removeLocal(index)} className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 p-0 text-[#B91C1C] shadow-sm" aria-label="حذف فایل"><X size={15} /></Button>
                        </div>)}
                        {type === "CAROUSEL" && uploadedMedia.length + media.length < 10 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#FAFCFF] text-[#64748B] transition hover:border-[#93B4E8] hover:text-[#2563EB]"><Plus size={22} /><span className="text-xs font-bold">افزودن تصویر</span><Input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={handleFiles} disabled={uploading || publishing} /></label>}
                      </div>
                      {uploading && <div className="rounded-xl bg-[#EFF6FF] px-3.5 py-3"><div className="mb-2 flex justify-between text-xs text-[#1D4ED8]"><span>در حال آپلود فایل {toPersianDigits(uploadIndex)}</span><span>{toPersianDigits(uploadProgress)}٪</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#DCE8FA]"><div className="h-full bg-[#2563EB] transition-[width]" style={{ width: String(uploadProgress) + "%" }} /></div></div>}
                    </div>
                  )}

                  {uploadedMedia.length > 0 && type !== "STORY" && (
                    <div className="mt-6 border-t border-[#EEF2F7] pt-5">
                      <div className="mb-2.5 flex items-center justify-between gap-3"><label htmlFor="publishing-caption" className="text-sm font-extrabold">کپشن محتوا</label><span className="text-[11px] tabular-nums text-[#64748B]">{toPersianDigits(caption.length)} از ۲۲۰۰</span></div>
                      <Textarea id="publishing-caption" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2200} rows={5} className="w-full resize-y rounded-2xl border border-[#CBD5E1] bg-white px-4 py-3.5 text-sm leading-7 outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-4 focus:ring-[#DBEAFE]/70" placeholder="متن کپشن، هشتگ‌ها و اشاره‌ها را اینجا بنویسید..." />
                      <p className="mt-2 text-[11px] leading-5 text-[#94A3B8]">برای خوانایی، متن را در پاراگراف‌های کوتاه بنویسید. هشتگ‌ها را می‌توانید در انتهای کپشن اضافه کنید.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.025)] sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-sm font-extrabold text-[#475569]">۳</span>
                  <div className="min-w-0 flex-1"><h2 className="text-base font-extrabold">پاسخ خودکار</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">در صورت نیاز، برای کامنت‌ها یا پاسخ‌های استوری یک مسیر پاسخ خودکار بسازید.</p></div>
                  <Checkbox checked={automationEnabled} onCheckedChange={(checked) => setAutomationEnabled(Boolean(checked))} />
                </div>
                {!automationEnabled && <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F8FAFC] px-4 py-3.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#64748B] ring-1 ring-[#E2E8F0]"><MessageSquare size={16} /></span><p className="text-xs leading-5 text-[#64748B]">این بخش اختیاری است. اگر فعالش نکنید، فقط محتوا منتشر می‌شود.</p></div>}
                {automationEnabled && <div className="mt-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="mb-2 block text-xs font-bold text-[#334155]">{type === "STORY" ? "کلمات کلیدی پاسخ استوری" : "کلمات کلیدی کامنت"}</span><KeywordChipsInput value={keywords} onChange={setKeywords} placeholder={type === "STORY" ? "مثلاً: قیمت، اطلاعات" : "مثلاً: قیمت، لینک، راهنما"} /><span className="mt-1.5 block text-[10px] leading-5 text-[#94A3B8]">با Enter یا دکمه افزودن، هر کلمه را جدا ثبت کنید.</span></label>
                    {type !== "STORY" ? <label className="block"><span className="mb-2 block text-xs font-bold text-[#334155]">پاسخ عمومی کامنت (اختیاری)</span><Textarea value={commentReplyText} onChange={(event) => setCommentReplyText(event.target.value)} rows={3} className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]" placeholder="مثلاً: جزئیات در دایرکت ارسال شد." /></label> : <div className="flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"><Checkbox checked={likeStoryReply} onCheckedChange={(checked) => setLikeStoryReply(Boolean(checked))} /><div><p className="text-sm font-bold">لایک خودکار پاسخ استوری</p><p className="mt-1 text-xs leading-5 text-[#64748B]">در صورت فعال‌سازی، پاسخ استوری مخاطب نیز لایک می‌شود.</p></div></div>}
                  </div>
                  <div className="rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4">
                    <label className="flex items-center justify-between gap-4"><span><span className="block text-sm font-bold">شرط دنبال‌کردن پیج</span><span className="mt-1 block text-xs leading-5 text-[#64748B]">پیش از ارسال پاسخ، دنبال‌کردن پیج بررسی شود.</span></span><Checkbox checked={requireFollow} onCheckedChange={(checked) => setRequireFollow(Boolean(checked))} /></label>
                    {requireFollow && <div className="mt-4"><label className="mb-2 block text-xs font-bold text-[#334155]">پیام درخواست دنبال‌کردن</label><Textarea value={followGateText} onChange={(event) => setFollowGateText(event.target.value)} rows={2} className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]" placeholder="متن درخواست دنبال‌کردن را وارد کنید." /></div>}
                  </div>
                  <div className="border-t border-[#EEF2F7] pt-5">
                    <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">محتوای پاسخ</h3><p className="mt-1 text-xs leading-5 text-[#64748B]">متن، رسانه، فرم یا ویترین و گزینه‌های ادامه گفتگو را تنظیم کنید.</p></div><span className="shrink-0 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold text-[#475569]">{toPersianDigits(messages.length)} پیام</span></div>
                    {messages.slice(0, 1).map((message, index) => <div key={message.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-3.5 sm:p-5"><AutomationFlowMessage triggerType={triggerType} message={message} index={index} total={messages.length} showcases={showcases} forms={forms} loadingResources={loadingResources} instagramAccountId={selectedAccountId} onShowcaseCreated={(showcase) => setShowcases((current) => [showcase, ...current.filter((item) => item.id !== showcase.id)])} onFormCreated={(form) => setForms((current) => [form, ...current.filter((item) => item.id !== form.id)])} onUpdate={(patch) => updateMessage(index, patch)} onAddQuickReply={() => addQuickReply(index)} onUpdateQuickReply={(quickReplyId, patch) => updateQuickReply(index, quickReplyId, patch)} onUpdateQuickReplyTree={(quickReplyId, updater) => updateQuickReplyTree(index, quickReplyId, updater)} onRemoveQuickReply={(quickReplyId) => removeQuickReply(index, quickReplyId)} /></div>)}
                  </div>
                </div>}
              </section>
            </main>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-5">
              <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.025)] sm:p-5">
                <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-sm font-extrabold text-[#475569]">۴</span><div><h2 className="text-base font-extrabold">زمان انتشار</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">اکنون منتشر کنید یا برای آینده زمان تعیین کنید.</p></div></div>
                <div className="mt-5 space-y-4">
                  <div><label className="mb-2 block text-xs font-bold text-[#334155]">تاریخ شمسی</label><PersianDatePicker value={scheduledDate} onChange={setScheduledDate} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="mb-2 block text-xs font-bold text-[#64748B]">ساعت</span><Select value={hour} onChange={(event) => setHour(Number(event.target.value))} className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]">{Array.from({ length: 24 }, (_, value) => <option key={value} value={value}>{toPersianDigits(String(value).padStart(2, "0"))}</option>)}</Select></label>
                    <label className="block"><span className="mb-2 block text-xs font-bold text-[#64748B]">دقیقه</span><Select value={minute} onChange={(event) => setMinute(Number(event.target.value))} className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]">{Array.from({ length: 12 }, (_, value) => value * 5).map((value) => <option key={value} value={value}>{toPersianDigits(String(value).padStart(2, "0"))}</option>)}</Select></label>
                  </div>
                  <div className="rounded-2xl bg-[#F8FAFC] p-3.5"><p className="text-[11px] font-semibold text-[#64748B]">زمان انتخاب‌شده</p><p className="mt-1.5 text-sm font-extrabold text-[#0F172A]">{jalaliMonths[scheduledDate.month - 1]} {toPersianDigits(scheduledDate.day)}، {toPersianDigits(scheduledDate.year)}</p><p className="mt-1 text-xs text-[#64748B]">{toPersianDigits(String(hour).padStart(2, "0"))}:{toPersianDigits(String(minute).padStart(2, "0"))}</p></div>
                </div>
                <div className="mt-5 space-y-2.5 border-t border-[#EEF2F7] pt-5">
                  <Button type="button" disabled={!canPublish || loading} onClick={() => void createJob(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#CBD5E1]">{publishing ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}انتشار الآن</Button>
                  <Button type="button" disabled={!canPublish || loading} onClick={() => void createJob(false)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-bold text-[#334155] transition hover:border-[#93B4E8] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"><CalendarClock size={17} />زمان‌بندی انتشار</Button>
                  {!canPublish && <p className="px-1 text-center text-[11px] leading-5 text-[#94A3B8]">برای فعال‌شدن دکمه‌ها، ابتدا رسانه را انتخاب و آپلود کنید.</p>}
                  {canPublish && !publishing && <p className="px-1 text-center text-[11px] leading-5 text-[#64748B]">با انتخاب انتشار اکنون، زمان‌بندی نادیده گرفته می‌شود.</p>}
                </div>
              </section>

              {activeJobs.length > 0 && <section className="rounded-3xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.025)] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold">صف انتشار</h2><p className="mt-1 text-xs text-[#64748B]">وضعیت محتواهای در انتظار</p></div><span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-extrabold text-[#1D4ED8]">{toPersianDigits(activeJobs.length)}</span></div>
                <div className="space-y-3">{activeJobs.map((job) => <div key={job.id} className="flex items-start gap-3 rounded-2xl border border-[#EEF2F7] bg-[#FAFCFF] p-3">
                  {job.media[0] ? (job.media[0].type === "IMAGE" ? <img src={job.media[0].publicUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <video src={job.media[0].publicUrl} className="h-12 w-12 shrink-0 rounded-xl object-cover" />) : <div className="h-12 w-12 shrink-0 rounded-xl bg-[#F1F5F9]" />}
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1.5"><span className="text-xs font-extrabold">{typeLabels[job.type]}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">{statusLabels[job.status] || job.status}</span></div><p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">{job.status === "SCHEDULED" ? "انتشار در " + formatDate(job.scheduledAt) : job.status === "PUBLISHING" ? "محتوا در حال انتشار است." : "محتوا در حال پردازش است."}</p></div>
                  {job.status !== "SCHEDULED" && <Loader2 size={15} className="mt-1 shrink-0 animate-spin text-[#64748B]" />}
                </div>)}</div>
              </section>}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
