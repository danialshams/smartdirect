"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lightbulb, Share2, AtSign, X, Image as ImageIcon } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import PublishingStoryAutomationSetup, { type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem, type InstagramMedia } from "./automation-form-utils";
import ShareMentionSkeleton from "./ShareMentionSkeleton";
import ResponseModeSwitcher from "./ResponseModeSwitcher";
import CompleteAutomationPicker from "./CompleteAutomationPicker";
import ContentSelectionDialog, { contentLabel, sortContentNewestFirst } from "./ContentSelectionDialog";

type Trigger = "DM_MEDIA_SHARE" | "STORY_MENTION";
type Account = {id:string;igUsername:string;isConnected:boolean};
type Existing = {id:string;triggerType:Trigger;instagramAccountId:string;updatedAt:string;isActive:boolean;mediaId:string|null;mediaIds:string|null;messages:unknown};
const DESCRIPTION = "وقتی کسی پست یا ریلزت را به دایرکت بفرستد یا تو را در استوری منشن کند، پاسخ دلخواهت به‌صورت خودکار اجرا می‌شود.";

function Guide({step,title,hint}:{step:number;title:string;hint:string}){
 return <div className="daira-guide-glass mb-3 flex items-start gap-3 rounded-xl border px-3.5 py-3" style={{background:dairaPalette.guide.background,borderColor:dairaPalette.guide.border,color:dairaPalette.guide.text}}>
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
 const [responseMode,setResponseMode]=useState<"new"|"existing">("new");
 const [previousAutomations,setPreviousAutomations]=useState<Existing[]>([]);
 const [selectedPreviousId,setSelectedPreviousId]=useState("");
 const [showcases,setShowcases]=useState<Showcase[]>([]);
 const [forms,setForms]=useState<FormItem[]>([]);
 const [formTemplates,setFormTemplates]=useState<StoryFormTemplate[]>([]);
 const [pickerOpen,setPickerOpen]=useState(false);
 const [draftSelected,setDraftSelected]=useState<string[]>([]);
 const [refreshingMedia,setRefreshingMedia]=useState(false);
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
     setPreviousAutomations(all.filter((item:Existing)=>item.triggerType==="DM_MEDIA_SHARE" && item.id!==existing?.id));
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
    if(m?.success)setMedia(sortContentNewestFirst((Array.isArray(m.data)?m.data:[]).filter((x:InstagramMedia)=>x.media_product_type!=="STORY")));
    else setMediaError(m?.message||"دریافت پست‌ها و ریلزها ناموفق بود.");
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[id,reload]);

 async function refreshMedia(){
  if(!account)return;
  setRefreshingMedia(true);
  try{
   setMediaError("");
   const response=await fetch("/api/instagram/media?instagramAccountId="+encodeURIComponent(account.id),{cache:"no-store",credentials:"include"});
   const payload=await response.json();
   if(!response.ok||!payload.success)throw new Error(payload.message||"بارگذاری محتوا ناموفق بود.");
   setMedia(sortContentNewestFirst((Array.isArray(payload.data)?payload.data:[]).filter((x:InstagramMedia)=>x.media_product_type!=="STORY")));
  }catch(e){setMediaError(e instanceof Error?e.message:"بارگذاری محتوا ناموفق بود.");}
  finally{setRefreshingMedia(false);}
 }
 async function save(prepared?:MessageDraft){
  if(saving||!account||!responseValid)return;
   if (!original && responseMode === "existing" && !selectedPreviousId) {setError("ابتدا یک پاسخ قبلی انتخاب کن.");return;}
  setSaving(true);setError("");
  try{
   const previous=previousAutomations.find(item=>item.id===selectedPreviousId);
   if(!original && responseMode==="existing" && trigger==="DM_MEDIA_SHARE"){
     if(!previous)throw new Error("پاسخ قبلی انتخاب نشده است.");
     const attach=await fetch("/api/automations/"+encodeURIComponent(previous.id),{
       method:"PATCH",credentials:"include",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({linkMediaOnly:true,triggerType:"DM_MEDIA_SHARE",
         mediaIds:selected,mediaId:selected.length===1?selected[0]:null}),
     });
     const result=await attach.json();
     if(!attach.ok||!result.success)throw new Error(result.error||"اتصال پاسخ قبلی ناموفق بود.");
     setSaved(true);
     window.scrollTo({top:0,behavior:"smooth"});
     return;
   }
   const resolved=prepared||message;
    const response=await fetch("/api/share-mention",{method:original?"PUT":"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    id:original?.id,expectedUpdatedAt:original?.updatedAt,
    instagramAccountId:account.id,triggerType:trigger,
    mediaIds:trigger==="DM_MEDIA_SHARE"?selected:[],isActive:original?.isActive!==false,
    message:resolved,
   })});
   const data=await response.json();
   if(!response.ok||!data?.success)throw new Error(data?.error||"ذخیره پاسخ ناموفق بود.");
   setSaved(true);window.scrollTo({top:0,behavior:"smooth"});
  }catch(e){setError(e instanceof Error?e.message:"ذخیره پاسخ ناموفق بود.");}
  finally{setSaving(false);}
 }

 if(loading)return <ShareMentionSkeleton/>;
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
    <button type="button" onClick={()=>{setDraftSelected(selected);setPickerOpen(true);}}
     className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--daira-primary)] px-4 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" style={{background:dairaPalette.primary.main}}>
     <ImageIcon size={19}/> انتخاب محتوا
    </button>
    <p className="mt-3 text-xs text-slate-500">{selected.length? `${selected.length.toLocaleString("fa-IR")} پست یا ریلز انتخاب شده است.`:"هنوز محتوایی انتخاب نشده است."}</p>
    {selected.length>0&&<div aria-label="محتواهای انتخاب‌شده" className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
      {selected.map(mid=>{
       const item=media.find(x=>x.id===mid);
       const isVideo=item?.media_product_type==="REELS"||item?.media_type==="VIDEO";
       const preview=item?.thumbnail_url||(!isVideo?item?.media_url:null);
       return <div key={mid} className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--daira-border)] bg-[var(--daira-surface-hover)]">
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#EFF3FA]">
         {preview?<img src={preview} alt={item?.caption||"محتوای انتخاب‌شده"} loading="lazy" className="h-full w-full object-cover"/>:<ImageIcon size={22} className="text-slate-400"/>}
        </div>
        <button type="button" onClick={()=>setSelected(list=>list.filter(x=>x!==mid))} className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--daira-border)] bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50" aria-label={"حذف "+(item?contentLabel(item):"محتوا")}><X size={16}/></button>
        <p className="truncate px-2 py-2 text-center text-[11px] font-semibold text-[var(--daira-text-secondary)]">{item?contentLabel(item):"محتوای قبلی"}</p>
       </div>;
      })}
     </div>}
    {selected.some(mid=>!media.some(item=>item.id===mid))&&<p className="mt-2 text-xs leading-6 text-slate-500">پیش‌نمایش برخی محتواهای قبلی در دسترس نیست، اما انتخاب آن‌ها حفظ شده است.</p>}
    {mediaError&&<p role="alert" className="mt-2 text-xs text-red-600">{mediaError}</p>}
   </div>
  </section>}
  {trigger==="STORY_MENTION"&&<section>
   <Guide step={2} title="منشن در استوری دیگران" hint="نیازی به انتخاب استوری نیست. این پاسخ برای منشن جدید پیجت در استوری مخاطبان ارسال می‌شود؛ ریپلای به استوری خودت همچنان در بخش پاسخ به استوری مدیریت می‌شود."/>
   <div className="rounded-2xl border bg-white p-4 text-xs leading-7 text-slate-600" style={{borderColor:dairaPalette.border}}>برای این پیج فقط یک پاسخ به منشن استوری می‌توانی تعریف کنی. ارسال پیام به دریافت رویداد مجاز از Meta وابسته است.</div>
  </section>}
  {!original && trigger==="DM_MEDIA_SHARE" && <section className="space-y-3"><ResponseModeSwitcher value={responseMode} existingAvailable={previousAutomations.some(item=>item.triggerType===trigger)} onChange={next=>{setResponseMode(next);setSelectedPreviousId("");}} disabled={saving}/></section>}
  <section>
   <Guide step={3} title="نوع پاسخ" hint="از همان پاسخ‌های فعلی دایرا استفاده کن: متن، عکس، ویدیو، وویس، ویترین یا فرم چندمرحله‌ای. فایل‌ها فقط وقتی ذخیره شوند که پاسخ ثبت شده باشد باقی می‌مانند."/>
   {responseMode === "existing" && trigger==="DM_MEDIA_SHARE" && !original ? <div className="space-y-3">
      <CompleteAutomationPicker items={previousAutomations.filter(item=>item.triggerType===trigger)}
        selected={previousAutomations.find(item=>item.id===selectedPreviousId)||null}
        onSelect={item=>setSelectedPreviousId(item.id)}
        onChange={()=>setSelectedPreviousId("")} showcases={showcases} forms={forms} kind="SHARE" disabled={saving}/>
      <button type="button" disabled={saving || !selectedPreviousId || !responseValid}
        onClick={()=>void save()} className="daira-complete-reply__select min-h-12 w-full rounded-xl px-4 text-sm font-bold disabled:opacity-50">
        {saving?"در حال ثبت...":"ایجاد پاسخ"}
      </button>
    </div> : <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:dairaPalette.border}}>
    <PublishingStoryAutomationSetup key={original?.id||account.id} message={message} showcases={showcases} forms={forms} formTemplates={formTemplates}
     loadingResources={false} instagramAccountId={account.id} onUpdate={patch=>setMessage(m=>({...m,...patch}))}
     keywordValid={responseValid} storyCreateMode storyEditMode={Boolean(original)} onDraftChange={setShowcaseDraftChanged}
     disabled={saving} hideLibrary hideVideo showFinalSave finalSaveDisabled={saving||!responseValid} onContinue={save}
     finalSaveLabel={original?"ذخیره تغییرات":"ساخت پاسخ خودکار"} finalSaveLoadingLabel="در حال ذخیره..."
     responseTypeTitle="انتخاب نوع پاسخ" responseTypeDescription="پاسخی را انتخاب کن که پس از این تعامل برای مخاطب ارسال شود."
     textPlaceholder="متن پاسخی که برای مخاطب ارسال می‌شود..."/>
   </div>}
  </section>
  {pickerOpen&&<ContentSelectionDialog
   items={media} selectedIds={draftSelected} maxSelected={50} occupiedIds={occupied} error={mediaError}
   onRefresh={()=>void refreshMedia()} refreshing={refreshingMedia}
   onToggle={mid=>setDraftSelected(list=>list.includes(mid)?list.filter(x=>x!==mid):list.length>=50?list:[...list,mid])}
   onClose={()=>setPickerOpen(false)}
   onConfirm={()=>{setSelected(draftSelected);setPickerOpen(false);}}
  />}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">{error}</p>}
 </div>;
}
