"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {AtSign,Share2,Plus,Search,Trash2,Pencil,LoaderCircle,Check} from "lucide-react";
import {dairaPalette} from "../../lib/design-system/palette";
import AutoRepliesSkeleton from "./AutoRepliesSkeleton";
type Item={id:string;instagramAccountId:string;triggerType:string;mediaId:string|null;mediaIds:string|null;isActive:boolean;updatedAt:string;messages:Array<{messageType:string;text?:string|null}>};
const title=(type:string)=>type==="STORY_MENTION"?"منشن در استوری":"اشتراک‌گذاری پست و ریلز";
export default function ShareMentionManager(){
 const [accountId,setAccountId]=useState("");
 const [items,setItems]=useState<Item[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [query,setQuery]=useState("");
 const [busy,setBusy]=useState("");
 const [deleteId,setDeleteId]=useState("");
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");
  (async()=>{try{
   const a=await fetch("/api/instagram/accounts",{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json());
   const account=(Array.isArray(a.accounts)?a.accounts:[]).find((v:{isConnected:boolean})=>v.isConnected);
   if(!account)throw new Error("ابتدا یک پیج اینستاگرام متصل کن.");
   const response=await fetch("/api/automations?instagramAccountId="+encodeURIComponent(account.id),{cache:"no-store",credentials:"include",signal:controller.signal});
   const data=await response.json();
   if(!response.ok||!data.success)throw new Error(data.error||"دریافت پاسخ‌ها ناموفق بود.");
   if(!controller.signal.aborted){setAccountId(account.id);setItems((Array.isArray(data.data)?data.data:[]).filter((v:Item)=>["DM_MEDIA_SHARE","STORY_MENTION"].includes(v.triggerType)));}
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"دریافت پاسخ‌ها ناموفق بود.");}
  finally{if(!controller.signal.aborted)setLoading(false);}})();
  return()=>controller.abort();
 },[reload]);
 const filtered=useMemo(()=>items.filter(item=>title(item.triggerType).includes(query.trim())||item.messages.some(m=>(m.text||"").includes(query.trim()))),[items,query]);
 async function change(item:Item,action:"toggle"|"delete"){
  if(busy)return;setBusy(item.id);setError("");
  try{
   const response=await fetch("/api/automations/"+encodeURIComponent(item.id),{
    method:action==="delete"?"DELETE":"PATCH",
    credentials:"include",headers:{"Content-Type":"application/json"},
    ...(action==="toggle"?{body:JSON.stringify({isActive:!item.isActive})}:{}),
   });
   const result=await response.json();
   if(!response.ok||!result.success)throw new Error(result.error||"ثبت تغییر ناموفق بود.");
   setItems(list=>action==="delete"?list.filter(v=>v.id!==item.id):list.map(v=>v.id===item.id?{...v,isActive:!v.isActive}:v));
   setDeleteId("");
   if(action==="toggle")toast.success(item.isActive?"پاسخ غیرفعال شد.":"پاسخ فعال شد.");
  }catch(e){const message=e instanceof Error?e.message:"ثبت تغییر ناموفق بود.";setError(message);toast.error(message);}
  finally{setBusy("");}
 }
 if(loading)return <AutoRepliesSkeleton includeCreateButton />;
 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
  <Link href="/dashboard/share-mention/new" dir="rtl" className="daira-leading-action flex min-h-[54px] w-full flex-row items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white" style={{background:dairaPalette.primary.main}}><span className="flex shrink-0 items-center justify-center" aria-hidden="true"><Plus size={20}/></span><span className="whitespace-nowrap">ایجاد پاسخ جدید</span></Link>
  <>
   <div className="daira-search-field relative flex"><Search size={17} className="shrink-0 text-[var(--daira-search-placeholder)]"/><input className="daira-search-input min-w-0 flex-1 border-0 bg-transparent text-base outline-none" value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو در پاسخ‌ها"/></div>
   {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}<button onClick={()=>setReload(x=>x+1)} className="mr-2 underline">تلاش دوباره</button></p>}
   {!filtered.length&&!error&&<div className="daira-empty-state rounded-2xl border bg-white px-4 py-10 text-center text-sm leading-8 text-slate-500" style={{borderColor:dairaPalette.border}}>{items.length?"پاسخی با جستجوی تو پیدا نشد.":"هنوز پاسخی برای اشتراک‌گذاری یا منشن ساخته نشده است."}</div>}
   <div className="space-y-3">{filtered.map(item=>{
    const mention=item.triggerType==="STORY_MENTION";
    const count=(item.mediaIds||item.mediaId||"").split(",").filter(Boolean).length;
    return <article key={item.id} className="daira-automation-list-card relative rounded-2xl border px-4 pb-4 pt-10">
     <time className="absolute left-4 top-3 text-[11px] font-medium text-[var(--daira-text-secondary)]"
       dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short"})}</time>
     <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--daira-brand-100)] text-[var(--daira-primary)]">{mention?<AtSign size={21}/>:<Share2 size={21}/>}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--daira-heading)]">{title(item.triggerType)}</strong></div>
       <p className="mt-1 text-xs leading-6 text-slate-500">{mention?"پاسخ هنگام منشن‌شدن در استوری دیگران":`متصل به ${count.toLocaleString("fa-IR")} پست یا ریلز`}</p>
       <p className="mt-1 max-w-md truncate text-xs text-slate-500">{item.messages?.[0]?.text||"پاسخ رسانه‌ای یا ویترین"}</p>
      </div>
     </div>
     <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{borderColor:dairaPalette.border}}>
      
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--daira-glass-rim)] bg-[var(--daira-glass-raised)] px-2.5 text-xs font-semibold">
         <input type="checkbox" role="switch" className="daira-form-switch shrink-0 -scale-x-100"
          checked={item.isActive!==false} disabled={busy===item.id} onChange={()=>void change(item,"toggle")}
          aria-label={"فعال‌سازی "+title(item.triggerType)}/>
         <span>{item.isActive!==false?"فعال":"غیرفعال"}</span>
        </label><Link href={"/dashboard/share-mention/"+item.id} className="daira-reply-list-edit">ویرایش <Pencil size={14}/></Link>
       <button type="button" disabled={busy===item.id} onClick={()=>setDeleteId(item.id)} className="daira-reply-list-delete">حذف {busy===item.id?<LoaderCircle size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button></div>
     </div>
     {deleteId===item.id&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-7 text-red-700">این پاسخ حذف شود؟ <div className="mt-2 flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={()=>void change(item,"delete")} className="rounded-lg bg-red-600 px-4 py-2 text-white">حذف پاسخ</button><button type="button" onClick={()=>setDeleteId("")} className="rounded-lg border bg-white px-4 py-2">انصراف</button></div></div>}
    </article>;
   })}</div>
  </>
 </div>;
}