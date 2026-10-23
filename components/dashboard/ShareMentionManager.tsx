"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
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
  }catch(e){setError(e instanceof Error?e.message:"ثبت تغییر ناموفق بود.");}
  finally{setBusy("");}
 }
 if(loading)return <AutoRepliesSkeleton includeCreateButton />;
 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-4 py-3">
  <Link href="/dashboard/share-mention/new" dir="rtl" className="flex min-h-[54px] w-full flex-row-reverse items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white" style={{background:dairaPalette.primary.main}}><span className="flex shrink-0 items-center justify-center" aria-hidden="true"><Plus size={20}/></span><span className="whitespace-nowrap">ایجاد پاسخ جدید</span></Link>
  <>
   <div className="relative"><Search size={17} className="absolute right-3 top-3.5 text-slate-400"/><input className="daira-search-input min-h-11 w-full rounded-xl border bg-white pr-10 pl-3 !text-base outline-none focus:border-blue-500" style={{borderColor:dairaPalette.border,fontSize:"16px",WebkitTextSizeAdjust:"100%"}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو در پاسخ‌ها"/></div>
   {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}<button onClick={()=>setReload(x=>x+1)} className="mr-2 underline">تلاش دوباره</button></p>}
   {!filtered.length&&!error&&<div className="daira-empty-state rounded-2xl border bg-white px-4 py-10 text-center text-sm leading-8 text-slate-500" style={{borderColor:dairaPalette.border}}>{items.length?"پاسخی با جستجوی تو پیدا نشد.":"هنوز پاسخی برای اشتراک‌گذاری یا منشن ساخته نشده است."}</div>}
   <div className="space-y-3">{filtered.map(item=>{
    const mention=item.triggerType==="STORY_MENTION";
    const count=(item.mediaIds||item.mediaId||"").split(",").filter(Boolean).length;
    return <article key={item.id} className="rounded-2xl border bg-white p-4" style={{borderColor:dairaPalette.border}}>
     <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{mention?<AtSign size={21}/>:<Share2 size={21}/>}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{title(item.triggerType)}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] ${item.isActive?"bg-green-50 text-green-700":"bg-slate-100 text-slate-500"}`}>{item.isActive?"فعال":"غیرفعال"}</span></div>
       <p className="mt-1 text-xs leading-6 text-slate-500">{mention?"پاسخ هنگام منشن‌شدن در استوری دیگران":`متصل به ${count.toLocaleString("fa-IR")} پست یا ریلز`}</p>
       <p className="mt-1 max-w-md truncate text-xs text-slate-500">{item.messages?.[0]?.text||"پاسخ رسانه‌ای یا ویترین"}</p>
      </div>
     </div>
     <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{borderColor:dairaPalette.border}}>
      <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={item.isActive} disabled={busy===item.id} onChange={()=>void change(item,"toggle")} className="accent-blue-600"/>فعال</label>
      <div className="flex gap-2"><Link href={"/dashboard/share-mention/"+item.id} className="inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs text-blue-600" style={{borderColor:dairaPalette.border}}><Pencil size={14}/>ویرایش</Link>
       <button type="button" disabled={busy===item.id} onClick={()=>setDeleteId(item.id)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-100 px-3 text-xs text-red-600">{busy===item.id?<LoaderCircle size={14} className="animate-spin"/>:<Trash2 size={14}/>}حذف</button></div>
     </div>
     {deleteId===item.id&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-7 text-red-700">این پاسخ حذف شود؟ <div className="mt-2 flex gap-2"><button type="button" disabled={Boolean(busy)} onClick={()=>void change(item,"delete")} className="rounded-lg bg-red-600 px-4 py-2 text-white">حذف پاسخ</button><button type="button" onClick={()=>setDeleteId("")} className="rounded-lg border bg-white px-4 py-2">انصراف</button></div></div>}
    </article>;
   })}</div>
  </>
 </div>;
}