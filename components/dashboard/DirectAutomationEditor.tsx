"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import PublishingStoryAutomationSetup, { type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem } from "./automation-form-utils";
import DirectAutomationSkeleton from "./DirectAutomationSkeleton";
import DirectAutomationSuccess from "./DirectAutomationSuccess";
import { directAutomationHasChanges, responseFingerprint } from "./automation-response-compare";

type Account = {id:string;igUsername:string;isConnected:boolean};
type Automation = {id:string;title?:string|null;triggerType:string;instagramAccountId:string;keyword:string|null;updatedAt:string;messages:unknown};
function wordsFrom(raw:string){
 return Array.from(new Set(raw.split(/[\n,،;؛]+/).map(x=>x.trim().toLocaleLowerCase("fa-IR")).filter(Boolean)));
}
function Guide({step,title,hint}:{step:number;title:string;hint:string}){
 return <div className="daira-guide-glass mb-3 flex items-start gap-3 rounded-xl border px-3.5 py-3"
   style={{background:dairaPalette.guide.background,borderColor:dairaPalette.guide.border,color:dairaPalette.guide.text}}>
   <Lightbulb size={17} className="mt-1 shrink-0" style={{color:dairaPalette.guide.icon}}/>
   <div className="min-w-0 flex-1"><div className="flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{background:dairaPalette.guide.icon}}>{new Intl.NumberFormat("fa-IR").format(step)}</span>
    <strong className="text-sm font-extrabold">{title}</strong></div><p className="mt-1 text-xs leading-6">{hint}</p></div>
 </div>;
}
export default function DirectAutomationEditor({id}:{id?:string}){
 const [account,setAccount]=useState<Account|null>(null);
 const [original,setOriginal]=useState<Automation|null>(null);
 const [keywords,setKeywords]=useState<string[]>([]);
 const [draft,setDraft]=useState("");
 const [message,setMessage]=useState<MessageDraft>(()=>createEmptyMessage());
 const [originalResponseSignature,setOriginalResponseSignature]=useState<string|null>(null);
 const [showcaseDraftChanged,setShowcaseDraftChanged]=useState(false);
 const [showcases,setShowcases]=useState<Showcase[]>([]);
 const [forms,setForms]=useState<FormItem[]>([]);
 const [formTemplates,setFormTemplates]=useState<StoryFormTemplate[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [completed,setCompleted]=useState(false);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const add=()=>{const next=wordsFrom(draft);if(!next.length)return;
  setKeywords(current=>Array.from(new Set([...current,...next])).slice(0,10));setDraft("");};
 const effectiveKeywords=Array.from(new Set([...keywords,...wordsFrom(draft)]));
 const keywordValid=effectiveKeywords.length>0&&effectiveKeywords.length<=10;
 const hasChanges=!original||directAutomationHasChanges({
  originalKeywords:wordsFrom(original.keyword||""),
  currentKeywords:effectiveKeywords,
  originalResponseSignature,
  currentMessage:message,
  showcaseDraftChanged,
 });
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");
  void(async()=>{
   try{
    const response=await fetch("/api/instagram/accounts",{cache:"no-store",credentials:"include",signal:controller.signal});
    const body=await response.json();
    if(!response.ok||!body.success)throw new Error(body.error||"دریافت پیج اینستاگرام ناموفق بود.");
    const active=(Array.isArray(body.accounts)?body.accounts:[]).find((x:Account)=>x.isConnected) as Account|undefined;
    if(!active)throw new Error("ابتدا یک پیج اینستاگرام متصل کنید.");
    let existing:Automation|null=null;
    if(id){
     const detail=await fetch("/api/automations/"+encodeURIComponent(id),{cache:"no-store",credentials:"include",signal:controller.signal});
     const data=await detail.json();
     if(!detail.ok||!data.success)throw new Error(data.error||"پاسخ خودکار پیدا نشد.");
     existing=data.data as Automation;
     if(existing.triggerType!=="DM"||existing.instagramAccountId!==active.id||!existing.keyword?.trim())
      throw new Error("پاسخ انتخاب‌شده مربوط به پاسخ خودکار کلمه‌ای دایرکت نیست.");
    }
    const q="?instagramAccountId="+encodeURIComponent(active.id);
    const [showcaseResponse,formResponse,savedResponse,automationsResponse]=await Promise.all([
     fetch("/api/showcases"+q,{cache:"no-store",credentials:"include",signal:controller.signal}),
     fetch("/api/forms"+q,{cache:"no-store",credentials:"include",signal:controller.signal}),
     fetch("/api/saved-responses"+q,{cache:"no-store",credentials:"include",signal:controller.signal}),
     fetch("/api/automations"+q,{cache:"no-store",credentials:"include",signal:controller.signal}),
    ]);
    const [showcaseData,formData,savedData,automationsData]=await Promise.all([showcaseResponse.json(),formResponse.json(),savedResponse.json(),automationsResponse.json()]);
    const templates:StoryFormTemplate[]=[];
    for(const a of Array.isArray(automationsData?.data)?automationsData.data:[]){
     for(const msg of normalizeMessages(a.messages)){
      if(msg.messageType==="FORM"&&msg.text.trim()&&msg.quickReplies.length>=2)
       templates.push({id:"automation:"+a.id+":"+msg.id,title:"فرم — "+msg.text.slice(0,45),text:msg.text,quickReplies:msg.quickReplies});
     }
    }
    for(const item of Array.isArray(savedData?.data)?savedData.data:[]){
     if(item.messageType!=="FORM")continue;
     const msgs=normalizeMessages([item]);
     if(msgs[0]?.quickReplies.length>=2)templates.push({id:"saved:"+item.id,title:item.title||"فرم ذخیره‌شده",text:msgs[0].text,quickReplies:msgs[0].quickReplies});
    }
    if(!controller.signal.aborted){
     const initialMessage=existing?normalizeMessages(existing.messages)[0]||createEmptyMessage():createEmptyMessage();
     setAccount(active);
     setOriginal(existing);
     setKeywords(existing?wordsFrom(existing.keyword||""):[]);
     setDraft("");
     setMessage(initialMessage);
     setOriginalResponseSignature(existing?responseFingerprint(initialMessage):null);
     setShowcaseDraftChanged(false);
     setShowcases(Array.isArray(showcaseData)?showcaseData:Array.isArray(showcaseData?.data)?showcaseData.data:[]);
     setForms(Array.isArray(formData)?formData:Array.isArray(formData?.data)?formData.data:[]);
     setFormTemplates(templates);
    }
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[id,retry]);
 async function save(prepared?:MessageDraft){
  if(saving||!account||(original&&!hasChanges))return;
  const entries=effectiveKeywords.slice(0,11);
  if(!entries.length||entries.length>10){setError("بین ۱ تا ۱۰ کلمه کلیدی وارد کنید.");return;}
  setSaving(true);setError("");
  try{
   const response=await fetch("/api/direct-automation",{method:original?"PUT":"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:original?.id,expectedUpdatedAt:original?.updatedAt,
     instagramAccountId:account.id,title:("پاسخ دایرکت - "+entries.join("، ")).slice(0,80),keyword:entries.join(","),message:prepared||message})});
   const body=await response.json();
   if(!response.ok||!body.success)throw new Error(body.error||"ذخیره پاسخ خودکار ناموفق بود.");
   setCompleted(true);
   window.scrollTo(0,0);
  }catch(e){setError(e instanceof Error?e.message:"ذخیره ناموفق بود.");}
  finally{setSaving(false);}
 }
 if(loading)return <DirectAutomationSkeleton view="editor"/>;
 if(completed)return <DirectAutomationSuccess isEditing={Boolean(original)}/>;
 if(!account)return <div dir="rtl" className="mx-auto max-w-xl space-y-4 rounded-2xl border p-5 text-center" style={{borderColor:dairaPalette.border}}>
  <p role="alert" className="text-sm" style={{color:dairaPalette.status.error}}>{error||"پیج متصل نیست."}</p>
  <button onClick={()=>setRetry(v=>v+1)} className="rounded-xl px-5 py-3 text-sm text-white" style={{background:dairaPalette.primary.main}}>تلاش دوباره</button></div>;
 return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 py-3 sm:py-4">
   <section><Guide step={1} title="کلمات کلیدی دایرکت"
     hint="اگر مشتری یکی از این کلمات را مستقیماً در دایرکت بفرستد، پاسخ انتخاب‌شده برای او ارسال می‌شود."/>
    <div className="space-y-3 rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:dairaPalette.border}}>
     <div className="flex flex-wrap gap-2">{keywords.map(word=><span key={word} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold"
      style={{background:dairaPalette.secondary.hoverBackground,color:dairaPalette.primary.main}}>
      {word}<button type="button" onClick={()=>setKeywords(current=>current.filter(x=>x!==word))} aria-label={"حذف "+word}><X size={14}/></button></span>)}</div>
     <div className="flex gap-2"><input value={draft} onChange={e=>setDraft(e.target.value)}
       onKeyDown={e=>{if(e.key==="Enter"||e.key===","||e.key==="،"){e.preventDefault();add();}}}
       onBlur={add} maxLength={500} disabled={keywords.length>=10}
       placeholder="مثلاً قیمت، موجودی یا سفارش" aria-label="کلمه کلیدی دایرکت"
       className="min-h-12 min-w-0 flex-1 rounded-xl border bg-white px-3 text-base outline-none" style={{borderColor:dairaPalette.form.border}}/>
      <button type="button" onClick={add} disabled={!draft.trim()||keywords.length>=10}
       className="min-h-12 shrink-0 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
       style={{background:dairaPalette.primary.main}}>افزودن</button></div>
     <p className="text-xs" style={{color:dairaPalette.text.body}}>حداکثر ۱۰ کلمه. هر کلمه فقط می‌تواند به یک پاسخ خودکار دایرکت تعلق داشته باشد.</p>
    </div>
   </section>
   <section><Guide step={2} title="نوع پاسخ خودکار"
    hint="نوع پیام را انتخاب کن و محتوای آن را بساز. همه پاسخ‌ها از موتور پیام‌رسانی فعلی استفاده می‌کنند."/>
    <div className="rounded-2xl border bg-white p-4 sm:p-5" style={{borderColor:dairaPalette.border}}>
     <PublishingStoryAutomationSetup key={original?.id||account.id} message={message} showcases={showcases} forms={forms}
      formTemplates={formTemplates} loadingResources={false} instagramAccountId={account.id} onUpdate={patch=>setMessage(m=>({...m,...patch}))}
      keywordValid={keywordValid} storyCreateMode storyEditMode={Boolean(original)} hideLibrary
      onDraftChange={setShowcaseDraftChanged}
      disabled={saving} showFinalSave finalSaveDisabled={saving||!hasChanges} onContinue={save}
      finalSaveLabel={original?"ذخیره تغییرات":"ساخت پاسخ خودکار دایرکت"}
      finalSaveLoadingLabel="در حال ذخیره..." textPlaceholder="متنی که بعد از دریافت کلمه کلیدی ارسال می‌شود..."/>
    </div>
   </section>
   {error&&<p role="alert" className="rounded-xl border px-4 py-3 text-xs leading-6"
    style={{borderColor:dairaPalette.status.error,background:dairaPalette.background.surface,color:dairaPalette.status.error}}>{error}</p>}
 </div>;
}
