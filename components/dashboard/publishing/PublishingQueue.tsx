"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleAlert, Image as ImageIcon, LoaderCircle, Pencil, RotateCcw, Trash2, RefreshCw } from "lucide-react";
import PublishingPageSkeleton from "./PublishingPageSkeleton";
import { dairaPalette } from "../../../lib/design-system/palette";

type PublishType = "POST" | "CAROUSEL" | "REEL" | "STORY";
export type PublishingQueueJob = {
  id: string; type: PublishType; status: string; scheduledAt: string | null;
  publishedAt: string | null; createdAt: string; errorMessage: string | null;
  media: Array<{type:"IMAGE"|"VIDEO";publicUrl:string|null}>;
};
type Props = {
  jobs: PublishingQueueJob[];
  loading: boolean;
  error: string;
  onRetry: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};
const labels: Record<PublishType, string> = {POST:"پست",CAROUSEL:"پست اسلایدی",REEL:"ریلز",STORY:"استوری"};
const statuses: Record<string, {text:string;color:string;background:string}> = {
  SCHEDULED:{text:"زمان‌بندی‌شده",color:"#2F61FD",background:"#EFF6FF"},
  PROCESSING:{text:"در حال پردازش",color:"#B45309",background:"#FFF7ED"},
  PUBLISHING:{text:"در حال انتشار",color:"#B45309",background:"#FFF7ED"},
  PUBLISHED:{text:"منتشرشده",color:"#15803D",background:"#F0FDF4"},
  FAILED:{text:"ناموفق",color:"#B91C1C",background:"#FEF2F2"},
  CANCELLED:{text:"لغوشده",color:"#64748B",background:"#F1F5F9"},
  DRAFT:{text:"پیش‌نویس",color:"#64748B",background:"#F1F5F9"},
};
function formattedDate(date: string | null) {
  return date ? new Date(date).toLocaleString("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"}) : "";
}
function Preview({job}:{job:PublishingQueueJob}){
  const media=job.media?.[0];
  return <div className="flex h-[70px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8EDF5] bg-[#F8FAFC]">
    {media?.publicUrl ? (media.type==="IMAGE" ? <img src={media.publicUrl} alt="" loading="lazy" className="h-full w-full object-cover"/> :
      <video src={media.publicUrl} muted playsInline preload="none" className="h-full w-full object-cover" aria-label={"ویدیو "+labels[job.type]}/>)
    : <ImageIcon size={20} color="#94A3B8"/>}
  </div>;
}
export default function PublishingQueue({jobs,loading,error,onRetry,onCancel,onRefresh}:Props){
  const [showHistory,setShowHistory]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [confirmCancel,setConfirmCancel]=useState<string|null>(null);
  const [actionError,setActionError]=useState("");
  const pending=jobs.filter(j=>["SCHEDULED","PROCESSING","PUBLISHING","FAILED","DRAFT"].includes(j.status));
  const history=jobs.filter(j=>["PUBLISHED","CANCELLED"].includes(j.status));
  const shown=(showHistory?history:pending).slice().sort((a,b)=>{
    if(!showHistory && a.status==="SCHEDULED" && b.status==="SCHEDULED")
      return new Date(a.scheduledAt||0).getTime()-new Date(b.scheduledAt||0).getTime();
    return new Date(b.scheduledAt||b.publishedAt||b.createdAt).getTime()-new Date(a.scheduledAt||a.publishedAt||a.createdAt).getTime();
  });
  async function runAction(id:string,operation:"retry"|"cancel"){
    if(busy)return;
    setBusy(id);setActionError("");
    try {
      if(operation==="retry")await onRetry(id);
      else await onCancel(id);
    } catch(e) {setActionError(e instanceof Error?e.message:"عملیات انجام نشد.");}
    finally {setBusy(null);setConfirmCancel(null);}
  }
  if(loading && !jobs.length)return <PublishingPageSkeleton view="queue"/>;
  return <section className="mx-auto w-full max-w-4xl space-y-4 px-1 py-2 sm:px-2" dir="rtl">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-base font-extrabold" style={{color:dairaPalette.text.heading}}>صف انتشار</h2>
        <p className="mt-1 text-xs" style={{color:dairaPalette.text.body}}>مدیریت محتوای زمان‌بندی‌شده و پیگیری نتیجه انتشار</p></div>
      <button type="button" onClick={()=>void onRefresh()} aria-label="به‌روزرسانی صف انتشار"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#2F61FD]"><RefreshCw size={17}/></button>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#EEF3FB] p-1.5" role="group" aria-label="نمای صف">
      {([{key:false,label:"در انتظار",count:pending.length},{key:true,label:"تاریخچه",count:history.length}] as const).map(option=>
        <button key={option.label} type="button" aria-pressed={showHistory===option.key} onClick={()=>setShowHistory(option.key)}
          className={"min-h-11 rounded-lg px-3 text-sm font-semibold transition "+(showHistory===option.key?"bg-white text-[#2F61FD] shadow-sm":"text-[#5A6B87]")}>
          {option.label} <span className="mr-1 text-xs">({option.count.toLocaleString("fa-IR")})</span>
        </button>)}
    </div>
    {(actionError||error)&&<div role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs leading-6 text-[#B91C1C]">{actionError||error}</div>}
    {!shown.length?<div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-[22px] border border-[#E8EDF5] bg-white px-5 text-center">
      <CalendarClock size={26} color="#94A3B8"/>
      <p className="text-sm font-semibold text-[#18233C]">{showHistory?"هنوز سابقه انتشاری وجود ندارد.":"فعلاً محتوایی در صف انتشار نیست."}</p>
      <p className="text-xs text-[#5A6B87]">{showHistory?"نتیجه انتشارهای قبلی در این قسمت نمایش داده می‌شود.":"محتواهای زمان‌بندی‌شده و در حال پردازش اینجا قابل پیگیری هستند."}</p>
    </div>:<div className="space-y-2.5">{shown.map(job=>{
      const status=statuses[job.status]||statuses.DRAFT;
      const busyThis=busy===job.id;
      return <article key={job.id} className="flex min-h-[96px] items-center gap-3 rounded-[22px] border border-[#E8EDF5] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.025)] sm:px-4">
        <Preview job={job}/>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[#18233C]">{labels[job.type]}</p>
            <span className="rounded-lg px-2 py-1 text-[10px] font-semibold" style={{color:status.color,background:status.background}}>{status.text}</span>
          </div>
          <p className="text-[11px] text-[#5A6B87]">{job.status==="PUBLISHED"?"منتشرشده در ":job.scheduledAt?"زمان انتشار: ":"ساخته‌شده در "}{formattedDate(job.status==="PUBLISHED"?job.publishedAt:job.scheduledAt||job.createdAt)}</p>
          {job.status==="FAILED"&&job.errorMessage&&<p className="line-clamp-2 text-[11px] leading-5 text-[#B91C1C]">{job.errorMessage}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          {["SCHEDULED","DRAFT"].includes(job.status) && <Link href={"/dashboard/publishing/"+encodeURIComponent(job.id)} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-[#DBEAFE] bg-white px-2 text-[11px] font-semibold text-[#2F61FD]"><Pencil size={13}/><span>ویرایش</span></Link>}
          {job.status==="FAILED"&&<button type="button" disabled={busyThis} onClick={()=>void runAction(job.id,"retry")} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-2 text-[11px] font-semibold text-[#2F61FD] disabled:opacity-50">{busyThis?<LoaderCircle size={13} className="animate-spin"/>:<RotateCcw size={13}/>}تلاش مجدد</button>}
          {job.status==="SCHEDULED"&&<button type="button" disabled={busyThis} onClick={()=>setConfirmCancel(job.id)} className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-[#FECACA] bg-white px-2 text-[11px] font-semibold text-[#B91C1C] disabled:opacity-50"><Trash2 size={13}/>لغو</button>}
        </div>
      </article>;
    })}</div>}
    {confirmCancel&&<div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#18233C]/40 px-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setConfirmCancel(null);}}>
      <div role="dialog" aria-modal="true" aria-label="لغو انتشار" className="w-full max-w-sm space-y-4 rounded-[24px] bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2 text-[#B91C1C]"><CircleAlert size={20}/><h3 className="font-bold">لغو انتشار زمان‌بندی‌شده</h3></div>
        <p className="text-xs leading-7 text-[#5A6B87]">محتوای زمان‌بندی‌شده لغو می‌شود و ممکن است فایل‌های آن طبق سیاست نگهداری حذف شوند.</p>
        <div className="grid grid-cols-2 gap-2"><button disabled={Boolean(busy)} onClick={()=>setConfirmCancel(null)} className="min-h-11 rounded-xl border border-[#E2E8F0] text-sm font-semibold">انصراف</button>
          <button disabled={Boolean(busy)} onClick={()=>void runAction(confirmCancel,"cancel")} className="min-h-11 rounded-xl bg-[#B91C1C] text-sm font-semibold text-white">تأیید لغو</button></div>
      </div>
    </div>}
  </section>;
}
