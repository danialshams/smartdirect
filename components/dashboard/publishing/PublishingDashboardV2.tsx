"use client";
import { Checkbox } from "@/components/dashboard/DashboardUI"
import { Textarea } from "@/components/dashboard/DashboardUI"
import { Button } from "@/components/dashboard/DashboardUI"
import { Calendar } from "@/components/dashboard/DashboardUI"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/dashboard/DashboardUI"
import { Input } from "@/components/dashboard/DashboardUI"
import { Select } from "@/components/dashboard/DashboardUI"

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
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] px-3 py-4 pb-28 sm:px-5 sm:py-6 lg:px-8 lg:pb-8">
      <div className="mx-auto w-full max-w-6xl">
        {!selectionConfirmed ? (
        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <SectionHeader n="۱" title="نوع محتوا" text="نوع محتوایی را که می‌خواهی در Instagram منتشر کنی انتخاب کن." />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {([["POST","پست",ImagePlus,"#2563EB","#EFF6FF"],["CAROUSEL","آلبوم",Images,"#7C3AED","#F5F3FF"],["REEL","ریلز",Clapperboard,"#D97706","#FFF7ED"],["STORY","استوری",Camera,"#16A34A","#F0FDF4"]] as const).map(([value,label,Icon,accent,soft]) => (
              <Button key={value} type="button" onClick={() => handleTypeChange(value)} className={[
                "group flex min-h-[156px] sm:min-h-[176px] flex-col items-center justify-center gap-4 rounded-[22px] border-2 bg-white p-4 text-center transition-all duration-300",
                "border-[#E2E8F0] hover:-translate-y-0.5 hover:shadow-md"
              ].join(" ")}>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{backgroundColor:soft,color:accent}}><Icon size={28}/></span>
                <span className="text-sm font-bold text-[#0F172A]">{label}</span>
              </Button>
            ))}
          </div>
        </section>
        ) : uploadedMedia.length === 0 ? (
        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <SectionHeader n="۲" title="آپلود محتوا" text={type==="CAROUSEL"?"۲ تا ۱۰ تصویر برای آلبوم انتخاب کن.":type==="REEL"?"یک ویدیوی مناسب ریلز انتخاب کن.":type==="STORY"?"تصویر یا ویدیوی استوری را انتخاب کن.":"تصویر پست را انتخاب کن."} />
          <UploadArea id="publishing-media-upload" accept={accept} multiple={type==="CAROUSEL"} disabled={uploading||publishing} isDragging={isDragging} setIsDragging={setIsDragging} uploading={uploading} uploadIndex={uploadIndex} uploadProgress={uploadProgress} onChange={handleFiles} onDrop={handleDrop} />
          {error && <p className="mt-3 text-xs leading-5 text-[#B91C1C]">{error}</p>}
        </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">{[1,2,3].map((i) => <div key={i} className="animate-pulse rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="mb-5 h-5 w-32 rounded bg-[#E2E8F0]" /><div className="h-12 rounded-xl bg-[#F1F5F9]" /><div className="mt-4 h-24 rounded-xl bg-[#F1F5F9]" /></div>)}</div>
            <div className="h-72 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="h-5 w-28 rounded bg-[#E2E8F0]" /><div className="mt-5 h-32 rounded-xl bg-[#F1F5F9]" /></div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <main className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
                <SectionHeader n="۲" title="رسانه" text={type==="CAROUSEL"?"۲ تا ۱۰ تصویر برای آلبوم انتخاب کن.":type==="REEL"?"یک ویدیوی مناسب ریلز انتخاب کن.":type==="STORY"?"تصویر یا ویدیوی استوری را انتخاب کن.":"تصویر پست را انتخاب کن."} />
                {uploadedMedia.length===0 && media.length===0 ? (
                  <UploadArea id="publishing-media-upload" accept={accept} multiple={type==="CAROUSEL"} disabled={uploading||publishing} isDragging={isDragging} setIsDragging={setIsDragging} uploading={uploading} uploadIndex={uploadIndex} uploadProgress={uploadProgress} onChange={handleFiles} onDrop={handleDrop} />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {uploadedMedia.map((item)=><MediaTile key={item.storageKey} item={item} type={type} onRemove={() => void removeUploaded(item)} ready />)}
                      {media.map((item,index)=><MediaTile key={item.file.name+"-"+item.sortOrder} item={item} type={type} onRemove={() => removeLocal(index)} />)}
                      {type==="CAROUSEL" && uploadedMedia.length<10 && <label htmlFor="publishing-media-upload-more" className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#93C5FD] hover:bg-[#EFF6FF]/50"><Input id="publishing-media-upload-more" type="file" accept={accept} multiple className="sr-only" onChange={handleFiles} disabled={uploading||publishing}/><Plus size={21} className="text-[#2563EB]"/><span className="mt-2 text-xs font-semibold text-[#334155]">افزودن تصویر</span></label>}
                    </div>
                    {uploading && <ProgressBar progress={uploadProgress} label={"در حال آپلود فایل "+toPersianDigits(uploadIndex)} />}
                  </>
                )}
              </section>

              {uploadedMedia.length>0 && type!=="STORY" && <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><SectionHeader n="۳" title="کپشن" text="متن کپشن را برای محتوای منتشرشده بنویس."/><span className="text-[11px] text-[#64748B]">{toPersianDigits(caption.length)} / ۲۲۰۰</span></div>
                <Textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={2200} rows={6} className="w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-sm leading-7 text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" placeholder="کپشن محتوا را بنویسید..." />
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

        )}
      </div>
      {!loading&&uploadedMedia.length>0&&<div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-[#E2E8F0] bg-white/95 p-2.5 shadow-lg backdrop-blur sm:hidden"><div className="grid grid-cols-2 gap-2"><Button type="button" disabled={!canPublish||publishing} onClick={()=>void createJob(true)} className="min-h-11 rounded-xl bg-[#2563EB] px-3 text-xs font-semibold text-white disabled:opacity-50">{publishing?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>} انتشار الآن</Button><Button type="button" disabled={!canPublish||publishing} onClick={()=>void createJob(false)} className="min-h-11 rounded-xl border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#334155] disabled:opacity-50"><CalendarClock size={16}/> زمان‌بندی</Button></div></div>}
    </div>
  );
    </div>
  );
}