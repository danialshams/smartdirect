"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircleReply, Pencil, Plus, Search, Trash2, RefreshCw, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import DirectAutomationSkeleton from "./DirectAutomationSkeleton";
type Account={id:string;isConnected:boolean};
type Rule={id:string;keyword:string|null;triggerType:string;updatedAt:string;createdAt:string;messages?:Array<{messageType:string}>};
const formatted=(value:string|null)=> (value||"").split(/[,،;؛\n]+/).map(x=>x.trim()).filter(Boolean).join("، ");
const typeLabel=(value:string)=>({TEXT:"متن",IMAGE:"عکس",VIDEO:"ویدیو",AUDIO:"وویس",SHOWCASE:"ویترین",FORM:"فرم"}[value]||"پاسخ خودکار");
export default function DirectAutomationList(){
 const router=useRouter();
 const [rules,setRules]=useState<Rule[]>([]);
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [deleting,setDeleting]=useState(false);
 const [target,setTarget]=useState<Rule|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  void(async()=>{
   try{
    const a=await fetch("/api/instagram/accounts",{cache:"no-store",credentials:"include",signal:controller.signal});
    const data=await a.json();
    if(!a.ok||!data.success)throw new Error(data.error||"دریافت پیج ناموفق بود.");
    const account=(Array.isArray(data.accounts)?data.accounts:[]).find((x:Account)=>x.isConnected);
    if(!account)throw new Error("پیج اینستاگرام متصل نیست.");
    const r=await fetch("/api/automations?instagramAccountId="+encodeURIComponent(account.id),{cache:"no-store",credentials:"include",signal:controller.signal});
    const result=await r.json();
    if(!r.ok||!result.success)throw new Error(result.error||"دریافت پاسخ‌ها ناموفق بود.");
    if(!controller.signal.aborted)setRules((Array.isArray(result.data)?result.data:[]).filter((x:Rule)=>x.triggerType==="DM"&&Boolean(x.keyword?.trim())));
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری پاسخ‌های خودکار ناموفق بود.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[refresh]);
 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase("fa-IR");
  return rules.filter(x=>!q||formatted(x.keyword).toLocaleLowerCase("fa-IR").includes(q)||typeLabel(x.messages?.[0]?.messageType||"").includes(q));
 },[rules,search]);
 async function remove(){
  if(!target||deleting)return;
  setDeleting(true);setError("");
  try{
   const response=await fetch("/api/automations/"+encodeURIComponent(target.id),{method:"DELETE",credentials:"include"});
   const data=await response.json();
   if(!response.ok||!data.success)throw new Error(data.error||"حذف پاسخ خودکار ناموفق بود.");
   setRules(old=>old.filter(x=>x.id!==target.id));setTarget(null);
  }catch(e){setError(e instanceof Error?e.message:"حذف پاسخ ناموفق بود.");}
  finally{setDeleting(false);}
 }
 if(loading)return <DirectAutomationSkeleton/>;
 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
  <button type="button" onClick={()=>router.push("/dashboard/direct-automation/new")}
   className="flex min-h-[54px] w-full flex-row-reverse items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-sm transition hover:brightness-95"
   style={{background:dairaPalette.primary.main}}><span>ایجاد پاسخ جدید</span><Plus size={20} aria-hidden="true"/></button>
  <label className="relative block"><Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{color:dairaPalette.text.muted}}/>
   <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو بر اساس کلمه یا نوع پاسخ..."
    aria-label="جستجوی پاسخ خودکار دایرکت" className="min-h-12 w-full rounded-xl border bg-white py-3 pl-4 pr-10 text-base outline-none focus:border-[var(--daira-primary)]"
    style={{borderColor:dairaPalette.border}}/></label>
  {error&&<div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
   {error}<button onClick={()=>setRefresh(x=>x+1)} aria-label="تلاش دوباره"><RefreshCw size={17}/></button></div>}
  {!filtered.length&&!error?<div className="rounded-2xl border bg-white px-5 py-14 text-center" style={{borderColor:dairaPalette.border}}>
   <MessageCircleReply size={28} className="mx-auto mb-3" style={{color:dairaPalette.primary.main}}/>
   <h2 className="text-sm font-bold" style={{color:dairaPalette.text.heading}}>{search?"پاسخی با این عبارت پیدا نشد":"هنوز پاسخ خودکار دایرکت نساخته‌ای"}</h2>
   <p className="mt-2 text-xs leading-6" style={{color:dairaPalette.text.body}}>برای هر کلمه یا مجموعه کلمات کلیدی، یک پاسخ دلخواه بساز.</p>
  </div>:<div className="grid gap-3 sm:grid-cols-2">{filtered.map(rule=><article key={rule.id}
   className="space-y-3 rounded-2xl border bg-white p-4 shadow-[0_3px_12px_rgba(24,35,60,0.025)]"
   style={{borderColor:dairaPalette.border}}>
   <div className="flex min-w-0 items-center gap-3">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{background:dairaPalette.secondary.hoverBackground,color:dairaPalette.primary.main}}><MessageCircleReply size={21}/></span>
    <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold" style={{color:dairaPalette.text.heading}}>{formatted(rule.keyword)}</h3>
    <p className="mt-1 text-[11px]" style={{color:dairaPalette.text.muted}}>پاسخ خودکار دایرکت — {typeLabel(rule.messages?.[0]?.messageType||"TEXT")}</p></div>
   </div>
   <div className="flex items-center justify-between gap-2 border-t pt-3" style={{borderColor:dairaPalette.border}}>
    <span className="text-[10px]" style={{color:dairaPalette.text.muted}}>{new Date(rule.updatedAt||rule.createdAt).toLocaleDateString("fa-IR-u-ca-persian")}</span>
    <div className="flex items-center gap-2">
     <button type="button" onClick={()=>router.push("/dashboard/direct-automation/"+rule.id)}
      className="flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
      style={{borderColor:dairaPalette.secondary.outline,color:dairaPalette.primary.main}}><Pencil size={15}/> ویرایش</button>
     <button type="button" onClick={()=>setTarget(rule)} aria-label={"حذف پاسخ "+formatted(rule.keyword)}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-600"><Trash2 size={16}/></button>
    </div>
   </div>
  </article>)}</div>}
  {target&&<div className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur-sm"
    onMouseDown={e=>{if(e.target===e.currentTarget&&!deleting)setTarget(null);}}>
    <section role="dialog" aria-modal="true" aria-labelledby="direct-delete-title" className="w-full max-w-sm space-y-4 rounded-[24px] bg-white p-5 shadow-2xl">
     <div className="flex items-start justify-between"><h2 id="direct-delete-title" className="font-bold" style={{color:dairaPalette.text.heading}}>حذف پاسخ خودکار دایرکت؟</h2>
      <button disabled={deleting} onClick={()=>setTarget(null)} aria-label="بستن"><X size={18}/></button></div>
     <p className="text-xs leading-6" style={{color:dairaPalette.text.body}}>پاسخ «{formatted(target.keyword)}» حذف می‌شود و دیگر برای کاربران ارسال نخواهد شد.</p>
     <div className="flex gap-2"><button disabled={deleting} onClick={()=>setTarget(null)} className="min-h-11 flex-1 rounded-xl border text-xs font-bold" style={{borderColor:dairaPalette.border}}>انصراف</button>
      <button disabled={deleting} onClick={()=>void remove()} className="min-h-11 flex-1 rounded-xl bg-red-600 text-xs font-bold text-white disabled:opacity-50">{deleting?"در حال حذف...":"حذف پاسخ"}</button></div>
    </section>
   </div>}
 </div>;
}
