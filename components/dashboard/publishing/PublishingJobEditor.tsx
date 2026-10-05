"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowRight, CalendarClock, CheckCircle2, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Job = {
  id: string;
  type: "POST" | "CAROUSEL" | "REEL" | "STORY";
  status: string;
  caption: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  media: Array<{ id: string; type: "IMAGE" | "VIDEO"; publicUrl: string | null; fileName: string | null }>;
  commentAutomationId: string | null;
  storyReplyAutomationId: string | null;
  commentTriggerKeywords: string | null;
  commentTriggerResponse: string | null;
  storyReplyTriggerKeywords: string | null;
  storyReplyTriggerResponse: string | null;
  instagramAccount: { igUsername: string | null };
};

type Automation = {
  id: string;
  triggerType: "COMMENT_KEYWORD" | "STORY_REPLY_KEYWORD" | "DM";
  keyword: string | null;
  commentReplyText: string | null;
  replyText: string | null;
  isActive: boolean;
};

const labels = { POST: "پست", CAROUSEL: "آلبوم", REEL: "ریلز", STORY: "استوری" } as const;
const jalaliMonths = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function toPersian(value: number | string) {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" }) : "-";
}
function gregorianToJalali(gy: number, gm: number, gd: number) {
  const jYear = gy - 621;
  const start = new Date(Date.UTC(gy, 2, 21));
  const current = new Date(Date.UTC(gy, gm - 1, gd));
  let jy = jYear;
  if (current < start) jy -= 1;
  const base = new Date(Date.UTC(jy + 621, 2, 21));
  const diff = Math.floor((current.getTime() - base.getTime()) / 86400000);
  if (diff < 186) return { year: jy, month: Math.floor(diff / 31) + 1, day: diff % 31 + 1 };
  return { year: jy, month: Math.floor((diff - 186) / 30) + 7, day: (diff - 186) % 30 + 1 };
}
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const jYear = jy + 1595;
  let days = -355668 + 365 * jYear + Math.floor(jYear / 33) * 8 + Math.floor(((jYear % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days += 1; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const gd = days + 1;
  const monthDays = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = gd; let gm = 1;
  while (remaining > monthDays[gm - 1]) { remaining -= monthDays[gm - 1]; gm += 1; }
  return [gy, gm, remaining];
}
function tehranNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  return {
    year: Number(parts.find(p => p.type === "year")?.value),
    month: Number(parts.find(p => p.type === "month")?.value),
    day: Number(parts.find(p => p.type === "day")?.value),
    hour: Number(parts.find(p => p.type === "hour")?.value),
    minute: Number(parts.find(p => p.type === "minute")?.value),
  };
}
function toDateFromJalali(j: {year:number;month:number;day:number}, hour:number, minute:number) {
  const [gy, gm, gd] = jalaliToGregorian(j.year, j.month, j.day);
  return new Date(Date.UTC(gy, gm - 1, gd, hour, minute) - 3.5 * 60 * 60 * 1000);
}

export default function PublishingJobEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [job, setJob] = useState<Job | null>(null);
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedDate, setSelectedDate] = useState<{year:number;month:number;day:number} | null>(null);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [automationKeyword, setAutomationKeyword] = useState("");
  const [automationText, setAutomationText] = useState("");
  const [automationActive, setAutomationActive] = useState(true);

  const today = useMemo(() => {
    const t = tehranNow();
    return gregorianToJalali(t.year, t.month, t.day);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/instagram/publishing/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "دریافت محتوا ناموفق بود.");
        if (cancelled) return;
        const data = result.data as Job;
        setJob(data);
        setCaption(data.caption ?? "");
        if (data.scheduledAt) {
          const date = new Date(data.scheduledAt);
          const tehran = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tehran", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric", hourCycle:"h23" }).formatToParts(date);
          const get = (type:string) => Number(tehran.find(p => p.type === type)?.value ?? 0);
          setSelectedDate(gregorianToJalali(get("year"), get("month"), get("day")));
          setHour(get("hour")); setMinute(get("minute"));
        } else {
          const t = tehranNow();
          setSelectedDate(today); setHour(t.hour); setMinute(t.minute);
        }

        const automationId = data.commentAutomationId ?? data.storyReplyAutomationId;
        if (automationId) {
          const aResponse = await fetch(`/api/automations/${automationId}`, { cache: "no-store" });
          const aResult = await aResponse.json();
          if (aResponse.ok && aResult.success && !cancelled) {
            const a = aResult.data as Automation;
            setAutomation(a);
            setAutomationKeyword(a.keyword ?? "");
            setAutomationText(data.type === "STORY" ? (a.replyText ?? "") : (a.commentReplyText ?? a.replyText ?? ""));
            setAutomationActive(a.isActive);
          }
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "خطا در دریافت محتوا.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, today]);

  async function save() {
    if (!job) return;
    setSaving(true);
    try {
      if (job.status === "SCHEDULED") {
        if (!selectedDate) throw new Error("تاریخ انتشار را انتخاب کن.");
        const scheduledAt = toDateFromJalali(selectedDate, hour, minute);
        if (scheduledAt.getTime() <= Date.now()) throw new Error("زمان انتشار باید در آینده باشد.");
        const response = await fetch(`/api/instagram/publishing/${job.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: caption.trim() || null, scheduledAt: scheduledAt.toISOString() }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "ویرایش محتوا ناموفق بود.");
        setJob(result.data);
        toast.success("محتوا با موفقیت ویرایش شد.");
      }

      if (automation) {
        const response = await fetch(`/api/automations/${automation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: automationKeyword,
            ...(job.type === "STORY" ? { replyText: automationText } : { commentReplyText: automationText }),
            isActive: automationActive,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "ویرایش Automation ناموفق بود.");
        setAutomation(result.data);
      }

      if (job.status === "PUBLISHED") toast.success("Automation با موفقیت ویرایش شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ویرایش ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAutomation() {
    if (!automation) return;
    if (!window.confirm("Automation این محتوا حذف شود؟")) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/automations/${automation.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "حذف Automation ناموفق بود.");
      setAutomation(null);
      toast.success("Automation با موفقیت حذف شد.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حذف Automation ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  }

  async function cancelScheduled() {
    if (!job) return;
    if (!window.confirm("این محتوای زمان‌بندی‌شده لغو و فایل‌های آن حذف شود؟")) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/instagram/publishing/${job.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "لغو محتوا ناموفق بود.");
      toast.success(result.message || "محتوای زمان‌بندی‌شده حذف شد.");
      router.push("/dashboard/publishing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "لغو محتوا ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div dir="rtl" className="flex min-h-[60vh] items-center justify-center"><Loader2 size={28} className="animate-spin text-[#2563EB]" /></div>;
  }

  if (!job) {
    return <div dir="rtl" className="p-6 text-center text-sm text-[#64748B]">محتوا پیدا نشد.</div>;
  }

  const isPublished = job.status === "PUBLISHED";
  const automationLabel = job.type === "STORY" ? "پاسخ خودکار استوری" : "پاسخ خودکار کامنت";

  return (
    <div dir="rtl" className="min-h-full bg-[#F8FAFC] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.push("/dashboard/publishing")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE]">
            <ArrowRight size={16} /> بازگشت
          </button>
          <div className="text-left">
            <p className="text-xs text-[#64748B]">{job.instagramAccount.igUsername ? `@${job.instagramAccount.igUsername}` : ""}</p>
            <h1 className="text-base font-bold text-[#0F172A]">ویرایش {labels[job.type]}</h1>
          </div>
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">محتوا</h2>
              <p className="mt-1 text-xs text-[#64748B]">{isPublished ? `منتشر شده در ${formatDate(job.publishedAt)}` : `زمان انتشار: ${formatDate(job.scheduledAt)}`}</p>
            </div>
            <span className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-bold text-[#2563EB]">{isPublished ? "منتشر شده" : "زمان‌بندی شده"}</span>
          </div>

          {job.media[0]?.publicUrl && (
            <div className="mx-auto mb-4 w-40 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F1F5F9]">
              {job.media[0].type === "IMAGE" ? <img src={job.media[0].publicUrl} alt={labels[job.type]} className="h-52 w-full object-cover" /> : <video src={job.media[0].publicUrl} controls className="h-52 w-full object-cover" />}
            </div>
          )}

          {isPublished ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs leading-6 text-[#64748B]">
              محتوای منتشرشده از طریق API فعلی SmartDirect قابل ویرایش کپشن یا فایل نیست. در این صفحه فقط Automation مرتبط مدیریت می‌شود.
            </div>
          ) : (
            <>
              <label className="mb-2 block text-sm font-bold text-[#0F172A]">کپشن</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={2200} rows={6} className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-base leading-7 outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/10" />
              <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-center gap-2"><CalendarClock size={17} className="text-[#2563EB]" /><span className="text-sm font-bold text-[#0F172A]">زمان انتشار</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSelectedDate(today)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${selectedDate?.year===today.year&&selectedDate?.month===today.month&&selectedDate?.day===today.day ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-[#E2E8F0] bg-white text-[#334155]"}`}>امروز</button>
                  <button type="button" onClick={() => { const [gy,gm,gd]=jalaliToGregorian(today.year,today.month,today.day); const d=new Date(gy,gm-1,gd+1); setSelectedDate(gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate())); }} className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-sm font-bold text-[#334155]">فردا</button>
                </div>
                {selectedDate && <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-white p-3 text-center text-sm font-bold text-[#0F172A]">{jalaliMonths[selectedDate.month-1]} {toPersian(selectedDate.day)}، {toPersian(selectedDate.year)}</div>}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#64748B]">ساعت<input type="number" min={0} max={23} value={hour} onChange={e=>setHour(Math.max(0,Math.min(23,Number(e.target.value))))} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-base" /></label>
                  <label className="text-xs font-semibold text-[#64748B]">دقیقه<input type="number" min={0} max={59} value={minute} onChange={e=>setMinute(Math.max(0,Math.min(59,Number(e.target.value))))} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 text-base" /></label>
                </div>
              </div>
            </>
          )}
        </section>

        {automation && (
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-sm font-bold text-[#0F172A]">{automationLabel}</h2><p className="mt-1 text-xs text-[#64748B]">Automation مرتبط با این محتوا</p></div>
              <button type="button" onClick={() => void deleteAutomation()} disabled={deleting} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 text-xs font-bold text-[#DC2626] disabled:opacity-50"><Trash2 size={14}/>{deleting ? "در حال حذف..." : "حذف Automation"}</button>
            </div>
            <label className="mb-2 block text-sm font-bold text-[#0F172A]">کلمات کلیدی</label>
            <input value={automationKeyword} onChange={e=>setAutomationKeyword(e.target.value)} className="mb-4 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-base outline-none focus:border-[#2563EB]" />
            <label className="mb-2 block text-sm font-bold text-[#0F172A]">{job.type === "STORY" ? "متن پاسخ استوری" : "متن پاسخ کامنت"}</label>
            <textarea value={automationText} onChange={e=>setAutomationText(e.target.value)} rows={4} className="w-full resize-y rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 text-base leading-7 outline-none focus:border-[#2563EB]" />
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#334155]"><input type="checkbox" checked={automationActive} onChange={e=>setAutomationActive(e.target.checked)} className="h-4 w-4 accent-[#2563EB]" /> فعال باشد</label>
          </section>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {isPublished ? (
            automation && <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 flex-1 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"><span className="inline-flex items-center gap-2">{saving ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {saving ? "در حال ذخیره..." : "ذخیره Automation"}</span></button>
          ) : (
            <>
              <button type="button" onClick={() => void save()} disabled={saving || deleting} className="min-h-11 flex-1 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"><span className="inline-flex items-center gap-2">{saving ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}</span></button>
              <button type="button" onClick={() => void cancelScheduled()} disabled={saving || deleting} className="min-h-11 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 text-sm font-bold text-[#DC2626] hover:bg-[#FEE2E2] disabled:opacity-50"><span className="inline-flex items-center gap-2"><Trash2 size={17}/> {deleting ? "در حال حذف..." : "لغو و حذف محتوا"}</span></button>
            </>
          )}
        </div>

        {!automation && isPublished && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs text-[#64748B]"><CheckCircle2 size={16} className="text-[#16A34A]"/> Automation فعالی برای این محتوا ثبت نشده است.</div>
        )}
      </div>
    </div>
  );
}
