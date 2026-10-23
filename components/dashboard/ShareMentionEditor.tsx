"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lightbulb, RefreshCw, Share2, AtSign, Search, X, Image as ImageIcon } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import PublishingStoryAutomationSetup, { type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem, type InstagramMedia } from "./automation-form-utils";
import DirectAutomationSkeleton from "./DirectAutomationSkeleton";

type Trigger = "DM_MEDIA_SHARE" | "STORY_MENTION";
type Account = {id:string;igUsername:string;isConnected:boolean};
type Existing = {id:string;triggerType:Trigger;instagramAccountId:string;updatedAt:string;isActive:boolean;mediaId:string|null;mediaIds:string|null;messages:unknown};
const DESCRIPTION = "وقتی کسی پست یا ریلزت را به دایرکت بفرستد یا تو را در استوری منشن کند، پاسخ دلخواهت به‌صورت خودکار اجرا می‌شود.";
const mediaLabel=(item:InstagramMedia)=>item.media_product_type==="REELS"?"ریلز":item.media_type==="CAROUSEL_ALBUM"?"آلبوم":"پست";

function Guide({step,title,hint}:{step:number;title:string;hint:string}){
 return <div className="mb-3 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{background:dairaPalette.guide.background,borderColor:dairaPalette.guide.border,color:dairaPalette.guide.text}}>
  <Lightbulb size={17} className="mt-1 shrink-0" style={{color:dairaPalette.guide.icon}}/>
  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{background:dairaPalette.guide.icon}}>{new Intl.NumberFormat("fa-IR").format(step)}</span><strong className="text-sm font-extrabold">{title}</strong></div>
   <p className="mt-1 text-xs leading-6">{hint}</p></div>
 </div>;
}

export default function ShareMentionEditor({id}:{id?:string}){
 const [account,setAccount]=useState<Account|null>(null);
 const [trigger,setTrigger]=useState<Trigger>("DM_MEDIA_SHARE");
 const [original,setOriginal]=useState<Existing|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [media,setMedia]=useState<InstagramMedia[]>([]);
 const [mediaError,setMediaError]=useState("");
 const [message,setMessage]=useState<MessageDraft>(()=>createEmptyMessage());
 const [showcases,setShowcases]=useState<Showcase[]>([]);
 const [forms,setForms]=useState<FormItem[]>([]);
 const [formTemplates,setFormTemplates]=useState<StoryFormTemplate[]>([]);
 const [pickerOpen,setPickerOpen]=useState(false);
 const [draftSelected,setDraftSelected]=useState<string[]>([]);
 const [mediaSearch,setMediaSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [saved,setSaved]=useState(false);
 const [error,setError]=useState("");
 const [reload,setReload]=useState(0);
 const [showcaseDraftChanged,setShowcaseDraftChanged]=useState(false);
 const [occupied,setOccupied]=useState<Set<string>>(new Set());
 const responseValid=trigger==="STORY_MENTION"||selected.length>0;
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError("");
  (async()=>{
   try{
    const accounts=await fetch("/api/instagram/accounts",{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json());
    const active=(Array.isArray(accounts.accounts)?accounts.accounts:[]).find((x:Account)=>x.isConnected) as Account|undefined;
    if(!active)throw new Error("ابتدا پیج اینستاگرام را متصل کنید.");
    const q="?instagramAccountId="+encodeURIComponent(active.id);
    const [a,m,sh,fo,sa,automations]=await Promise.all([
      id?fetch("/api/automations/"+encodeURIComponent(id),{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json()):Promise.resolve(null),
      fetch("/api/instagram/media"+q,{cache:"no-store",credentials:"include",signal:controller.signal}).then(async r=>r.ok?r.json():{success:false,message:"بارگذاری محتوا ناموفق بود."}),
      fetch("/api/showcases"+q,{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json()),
      fetch("/api/forms"+q,{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json()),
      fetch("/api/saved-responses"+q,{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json()),
      fetch("/api/automations"+q,{cache:"no-store",credentials:"include",signal:controller.signal}).then(r=>r.json()),
    ]);
    if(id&&(!a?.success||!a?.data))throw new Error(a?.error||"پاسخ موردنظر پیدا نشد.");
    const existing=id?a.data as Existing:null;
    if(existing&&(!["DM_MEDIA_SHARE","STORY_MENTION"].includes(existing.triggerType)||existing.instagramAccountId!==active.id))throw new Error("پاسخ انتخاب‌شده متعلق به این بخش نیست.");
    const all=Array.isArray(automations?.data)?automations.data:[];
    const busy=new Set<string>();
    for(const item of all){
     if(item.triggerType!=="DM_MEDIA_SHARE"||item.id===existing?.id)continue;
     for(const mid of (item.mediaIds||item.mediaId||"").split(","))if(mid)busy.add(mid);
    }
    const templates:StoryFormTemplate[]=[];
    for(const item of all){
     for(const msg of normalizeMessages(item.messages)){
      if(msg.messageType==="FORM"&&msg.text.trim()&&msg.quickReplies.length>=2)
       templates.push({id:"automation:"+item.id+":"+msg.id,title:"فرم — "+msg.text.slice(0,45),text:msg.text,quickReplies:msg.quickReplies});
     }
    }
    for(const item of Array.isArray(sa?.data)?sa.data:[]){
     if(item.messageType!=="FORM")continue;
     const msg=normalizeMessages([item])[0];
     if(msg&&msg.quickReplies.length>=2)templates.push({id:"saved:"+item.id,title:item.title||"فرم ذخیره‌شده",text:msg.text,quickReplies:msg.quickReplies});
    }
    if(controller.signal.aborted)return;
    setAccount(active);
    setOriginal(existing);
    setTrigger(existing?.triggerType||"DM_MEDIA_SHARE");
    setSelected((existing?.mediaIds||existing?.mediaId||"").split(",").filter(Boolean));
    setMessage(existing?normalizeMessages(existing.messages)[0]||createEmptyMessage():createEmptyMessage());
    setOccupied(busy);
    setShowcases(Array.isArray(sh?.data)?sh.data:Array.isArray(sh)?sh:[]);
    setForms(Array.isArray(fo?.data)?fo.data:Array.isArray(fo)?fo:[]);
    setFormTemplates(templates);
    if(m?.success)setMedia((Array.isArray(m.data)?m.data:[]).filter((x:InstagramMedia)=>x.media_product_type!=="STORY"));
    else setMediaError(m?.message||"دریافت پست‌ها و ریلزها ناموفق بود.");
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[id,reload]);

 async function refreshMedia(){
  if(!account)return;
  try{
   setMediaError("");
   const response=await fetch("/api/instagram/media?instagramAccountId="+encodeURIComponent(account.id),{cache:"no-store",credentials:"include"});
   const payload=await response.json();
   if(!response.ok||!payload.success)throw new Error(payload.message||"بارگذاری محتوا ناموفق بود.");
   setMedia((Array.isArray(payload.data)?payload.data:[]).filter((x:InstagramMedia)=>x.media_product_type!=="STORY"));
  }catch(e){setMediaError(e instanceof Error?e.message:"بارگذاری محتوا ناموفق بود.");}
 }
 async function save(prepared?:MessageDraft){
  if(saving||!account||!responseValid)return;
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/share-mention",{method:original?"PUT":"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    id:original?.id,expectedUpdatedAt:original?.updatedAt,
    instagramAccountId:account.id,triggerType:trigger,
    mediaIds:trigger==="DM_MEDIA_SHARE"?selected:[],isActive:true,
    message:prepared||message,
   })});
   const data=await response.json();
   if(!response.ok||!data?.success)throw new Error(data?.error||"ذخیره پاسخ ناموفق بود.");
   setSaved(true);window.scrollTo({top:0,behavior:"smooth"});
  }catch(e){setError(e instanceof Error?e.message:"ذخیره پاسخ ناموفق بود.");}
  finally{setSaving(false);}
 }

 if(loading)return <DirectAutomationSkeleton view="editor"/>;
 if(saved)return <div dir="rtl" className="mx-auto flex min-h-[45vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600"><Check size={30}/></div>
  <h2 className="text-lg font-bold">پاسخ با موفقیت ذخیره شد</h2>
  <p className="text-sm leading-7 text-slate-500">تنظیمات پاسخ به اشتراک‌گذاری و منشن ثبت شد.</p>
  <Link href="/dashboard/share-mention" className="rounded-full px-6 py-3 text-sm font-bold text-white" style={{background:dairaPalette.primary.main}}>مدیریت پاسخ‌ها</Link>
 </div>;
 if(!account)return <div dir="rtl" className="mx-auto max-w-xl space-y-4 rounded-2xl border p-5 text-center"><p role="alert">{error||"پیج متصل نیست."}</p><button onClick={()=>setReload(x=>x+1)} className="rounded-xl bg-blue-600 px-5 py-3 text-white">تلاش دوباره</button></div>;

 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">

  <section>
   <Guide step={1} title="پاسخ به اشتراک‌گذاری و منشن" hint={DESCRIPTION}/>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {([{key:"DM_MEDIA_SHARE",title:"اشتراک‌گذاری پست و ریلز",hint:"وقتی مخاطب محتوای انتخابی را در دایرکت برایت بفرستد.",Icon:Share2},{key:"STORY_MENTION",title:"منشن در استوری",hint:"وقتی مخاطب پیجت را در استوری خودش منشن کند.",Icon:AtSign}] as const).map(item=>
     <button type="button" key={item.key} disabled={Boolean(original)} aria-pressed={trigger===item.key}
      onClick={()=>setTrigger(item.key)} className="flex min-h-28 items-start gap-3 rounded-2xl border bg-white p-4 text-right transition disabled:cursor-not-allowed"
      style={{borderColor:trigger===item.key?dairaPalette.primary.main:dairaPalette.border,background:trigger===item.key?"#F1F6FF":"white"}}>
      <item.Icon size={24} className="mt-1 shrink-0 text-blue-600"/>
      <span><strong className="block text-sm">{item.title}</strong><span className="mt-2 block text-xs leading-6 text-slate-500">{item.hint}</span></span>
      {trigger===item.key&&<Check size={17} className="mr-auto shrink-0 text-blue-600"/>}
     </button>)}
   </div>
  </section>
  {trigger==="DM_MEDIA_SHARE"&&<section>
   <Guide step={2} title="انتخاب پست‌ها و ریلزها" hint="یک یا چند پست یا ریلز از پیج خودت انتخاب کن. پاسخ فقط وقتی اجرا می‌شود که مخاطب یکی از همین محتواها را به دایرکت پیج بفرستد."/>
   <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:dairaPalette.border}}>
    <button type="button" onClick={()=>{setDraftSelected(selected);setMediaSearch("");setPickerOpen(true);}}
     className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#DCE6FF] bg-[#F1F6FF] px-4 text-sm font-bold text-[#2563EB]">
     <ImageIcon size={19}/> انتخاب محتوا
    </button>
    <p className="mt-3 text-xs text-slate-500">{selected.length? `${selected.length.toLocaleString("fa-IR")} پست یا ریلز انتخاب شده است.`:"هنوز محتوایی انتخاب نشده است."}</p>
    {selected.length>0&&<div className="mt-3 flex flex-wrap gap-2">
      {selected.map(mid=>{const item=media.find(x=>x.id===mid);return <span key={mid} className="rounded-lg border bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{item?mediaLabel(item):"محتوای انتخاب‌شده"} <button type="button" onClick={()=>setSelected(list=>list.filter(x=>x!==mid))} className="mr-2 text-red-500" aria-label="حذف محتوا"><X size={13}/></button></span>})}
     </div>}
    {mediaError&&<p role="alert" className="mt-2 text-xs text-red-600">{mediaError}</p>}
   </div>
  </section>}
  {trigger==="STORY_MENTION"&&<section>
   <Guide step={2} title="منشن در استوری دیگران" hint="نیازی به انتخاب استوری نیست. این پاسخ برای منشن جدید پیجت در استوری مخاطبان ارسال می‌شود؛ ریپلای به استوری خودت همچنان در بخش پاسخ به استوری مدیریت می‌شود."/>
   <div className="rounded-2xl border bg-white p-4 text-xs leading-7 text-slate-600" style={{borderColor:dairaPalette.border}}>برای این پیج فقط یک پاسخ به منشن استوری می‌توانی تعریف کنی. ارسال پیام به دریافت رویداد مجاز از Meta وابسته است.</div>
  </section>}
  <section>
   <Guide step={3} title="نوع پاسخ" hint="از همان پاسخ‌های فعلی دایرا استفاده کن: متن، عکس، ویدیو، وویس، ویترین یا فرم چندمرحله‌ای. فایل‌ها فقط وقتی ذخیره شوند که پاسخ ثبت شده باشد باقی می‌مانند."/>
   <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:dairaPalette.border}}>
    <PublishingStoryAutomationSetup key={original?.id||account.id} message={message} showcases={showcases} forms={forms} formTemplates={formTemplates}
     loadingResources={false} instagramAccountId={account.id} onUpdate={patch=>setMessage(m=>({...m,...patch}))}
     keywordValid={responseValid} storyCreateMode storyEditMode={Boolean(original)} onDraftChange={setShowcaseDraftChanged}
     disabled={saving} hideVideo showFinalSave finalSaveDisabled={saving||!responseValid} onContinue={save}
     finalSaveLabel={original?"ذخیره تغییرات":"ساخت پاسخ خودکار"} finalSaveLoadingLabel="در حال ذخیره..."
     responseTypeTitle="انتخاب نوع پاسخ" responseTypeDescription="پاسخی را انتخاب کن که پس از این تعامل برای مخاطب ارسال شود."
     textPlaceholder="متن پاسخی که برای مخاطب ارسال می‌شود..."/>
   </div>
  </section>
  {pickerOpen&&<div className="fixed inset-0 z-[2500] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setPickerOpen(false);}}>
   <div role="dialog" aria-modal="true" aria-label="انتخاب پست و ریلز" dir="rtl" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-[24px]">
    <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] px-4 py-4 sm:px-5"><strong className="text-sm font-extrabold text-[#18233C]">انتخاب محتوا</strong><button type="button" onClick={()=>setPickerOpen(false)} aria-label="بستن" className="rounded-lg p-2 text-slate-500"><X size={20}/></button></div>
    <div className="shrink-0 space-y-2 border-b border-[#E2E8F0] p-4">
      <div className="relative"><Search size={17} className="absolute right-3 top-3.5 text-slate-400"/><input value={mediaSearch} onChange={e=>setMediaSearch(e.target.value)} placeholder="جستجو در توضیحات محتوا" aria-label="جستجوی محتوا" className="min-h-11 w-full rounded-xl border border-[#E2E8F0] bg-white pr-10 pl-3 !text-base outline-none focus:border-[#2563EB]" style={{fontSize:"16px",WebkitTextSizeAdjust:"100%"}}/></div>
      <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{draftSelected.length.toLocaleString("fa-IR")} از ۵۰ انتخاب شده</span><button type="button" onClick={()=>void refreshMedia()} className="flex items-center gap-1 text-xs text-blue-600"><RefreshCw size={14}/>به‌روزرسانی</button></div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
     {media.filter(x=>!mediaSearch.trim()||(x.caption||"").includes(mediaSearch.trim())).length===0&&<p className="py-9 text-center text-sm text-slate-500">{mediaError||"محتوایی پیدا نشد."}</p>}
     <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {media.filter(x=>!mediaSearch.trim()||(x.caption||"").includes(mediaSearch.trim())).map(item=>{const checked=draftSelected.includes(item.id),locked=occupied.has(item.id);return <button key={item.id} type="button" disabled={locked||(!checked&&draftSelected.length>=50)}
       onClick={()=>setDraftSelected(v=>checked?v.filter(x=>x!==item.id):[...v,item.id])} aria-pressed={checked}
       aria-label={mediaLabel(item)+(checked?"، انتخاب‌شده":"")} className="relative aspect-square overflow-hidden rounded-xl border-2 bg-slate-100 disabled:opacity-50" style={{borderColor:checked?"#2563EB":"transparent"}}>
       {item.thumbnail_url||item.media_url?<img src={item.thumbnail_url||item.media_url||""} alt="" className="h-full w-full object-cover"/>:<ImageIcon size={22} className="m-auto text-slate-400"/>}
       <span className="absolute bottom-0 right-0 rounded-tl-lg bg-black/65 px-2 py-1 text-[10px] text-white">{locked?"قبلاً انتخاب شده":mediaLabel(item)}</span>
       {checked&&<span className="absolute left-1 top-1 rounded-full bg-[#2563EB] p-1 text-white"><Check size={15}/></span>}
      </button>})}
     </div>
    </div>
    <div className="flex shrink-0 gap-2 border-t border-[#E2E8F0] bg-white p-4">
     <button type="button" onClick={()=>{setSelected(draftSelected);setPickerOpen(false);}} className="min-h-12 flex-1 rounded-xl bg-[#2563EB] text-sm font-bold text-white">تأیید انتخاب</button>
     <button type="button" onClick={()=>setPickerOpen(false)} className="min-h-12 rounded-xl border border-[#E2E8F0] px-5 text-sm">انصراف</button>
    </div>
   </div>
  </div>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">{error}</p>}
 </div>;
}
