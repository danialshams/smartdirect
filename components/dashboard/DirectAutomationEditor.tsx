"use client";
import { useDashboardAccountSelection } from "./DashboardAccountContext";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Lightbulb, Plus, Trash2, X } from "lucide-react";
import { dairaPalette } from "../../lib/design-system/palette";
import PublishingStoryAutomationSetup, { type PublishingStoryAutomationSetupHandle, type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, getMessageTypeLabel, normalizeMessages, validateMessages, type MessageDraft, type Showcase, type FormItem } from "./automation-form-utils";
import DirectAutomationSkeleton from "./DirectAutomationSkeleton";
import DirectAutomationSuccess from "./DirectAutomationSuccess";
import { directAutomationHasChanges, responseSequenceFingerprint } from "./automation-response-compare";

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
  const {accounts:dashboardAccounts,accountId:dashboardAccountId,isReady:dashboardReady}=useDashboardAccountSelection();
  const activeDashboardAccount=dashboardAccounts.find(a=>a.id===dashboardAccountId&&a.isConnected);
 const [account,setAccount]=useState<Account|null>(null);
 const [original,setOriginal]=useState<Automation|null>(null);
 const [keywords,setKeywords]=useState<string[]>([]);
 const [draft,setDraft]=useState("");
 const [messages,setMessages]=useState<MessageDraft[]>(()=>[createEmptyMessage()]);
 const messageEditors=useRef<Record<string,PublishingStoryAutomationSetupHandle|null>>({});
 const showcaseHandlers=useRef<Record<string,(changed:boolean)=>void>>({});
 const [originalResponseSignature,setOriginalResponseSignature]=useState<string|null>(null);
 const [showcaseDraftChanged,setShowcaseDraftChanged]=useState<Record<string,boolean>>({});
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
  currentMessage:messages[0],
  currentMessages:messages,
  showcaseDraftChanged:Object.values(showcaseDraftChanged).some(Boolean),
 });
 useEffect(()=>{
  if(!dashboardReady)return;
  const controller=new AbortController();setLoading(true);setError("");
  void(async()=>{
   try{
    const active=activeDashboardAccount;
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
     // Loading all rows keeps existing DM flows intact; older rules still
     // hydrate as a single message.
     const storedMessages=existing?normalizeMessages(existing.messages):[];
     const initialMessages=storedMessages.length?storedMessages:[createEmptyMessage()];
     setAccount(active);
     setOriginal(existing);
     setKeywords(existing?wordsFrom(existing.keyword||""):[]);
     setDraft("");
     setMessages(initialMessages);
     setOriginalResponseSignature(existing?responseSequenceFingerprint(initialMessages):null);
     setShowcaseDraftChanged({});
     messageEditors.current={};
     showcaseHandlers.current={};
     setShowcases(Array.isArray(showcaseData)?showcaseData:Array.isArray(showcaseData?.data)?showcaseData.data:[]);
     setForms(Array.isArray(formData)?formData:Array.isArray(formData?.data)?formData.data:[]);
     setFormTemplates(templates);
    }
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری ناموفق بود.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[id,retry,dashboardReady,activeDashboardAccount?.id]);
  function moveMessage(index:number,direction:-1|1){
    setMessages(current=>{
      const target=index+direction;
      if(target<0||target>=current.length)return current;
      const next=[...current];
      [next[index],next[target]]=[next[target],next[index]];
      return next;
    });
  }
  function getShowcaseDraftHandler(messageId:string){
    if(!showcaseHandlers.current[messageId]){
      showcaseHandlers.current[messageId]=(changed:boolean)=>{
        setShowcaseDraftChanged(current=>current[messageId]===changed
          ?current:{...current,[messageId]:changed});
      };
    }
    return showcaseHandlers.current[messageId];
  }
  async function save(){
    if(saving||!account||(original&&!hasChanges))return;
    const entries=effectiveKeywords.slice(0,11);
    if(!entries.length||entries.length>10){setError("بین ۱ تا ۱۰ کلمه کلیدی وارد کنید.");return;}
    if(!messages.length||messages.length>5){setError("بین ۱ تا ۵ پیام اضافه کنید.");return;}
    if(messages.slice(0,-1).some(item=>item.messageType==="FORM")){
      setError("فرم باید آخرین پیام باشد؛ پس از فرم، سیستم منتظر انتخاب کاربر می‌ماند.");return;
    }
    setSaving(true);setError("");
    try{
      const prepared:MessageDraft[]=[];
      for(const [index,item] of messages.entries()){
        const editor=messageEditors.current[item.id];
        if(!editor){
          throw new Error(`ویرایشگر پیام ${index+1} آماده نیست. دوباره تلاش کنید.`);
        }
        const result=await editor.prepareExternalSave();
        if(!result){
          throw new Error(`پیام ${index+1} ناقص است یا آپلود آن هنوز تمام نشده است.`);
        }
        prepared.push({...result,savedResponseId:null});
      }
      validateMessages(prepared,"DM");
      const response=await fetch("/api/direct-automation",{
        method:original?"PUT":"POST",credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          id:original?.id,expectedUpdatedAt:original?.updatedAt,
          instagramAccountId:account.id,
          title:("پاسخ دایرکت - "+entries.join("، ")).slice(0,80),
          keyword:entries.join(","),
          messages:prepared,
        }),
      });
      const body=await response.json();
      if(!response.ok||!body.success)
        throw new Error(body.error||"ذخیره پاسخ خودکار ناموفق بود.");
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
    <section>
     <Guide step={2} title="پاسخ‌ها به ترتیب ارسال"
      hint="هر نوع پاسخ را به‌صورت یک پیام جداگانه بساز. از بالا به پایین ارسال می‌شوند؛ می‌توانی ترتیب را تغییر بدهی."/>
     <div className="space-y-4">
      {messages.map((item,index)=>(
       <article key={item.id} className="overflow-hidden rounded-2xl border bg-white"
        style={{borderColor:dairaPalette.border}}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
         style={{borderColor:dairaPalette.border,background:dairaPalette.background.surface}}>
         <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold"
           style={{background:dairaPalette.secondary.hoverBackground,color:dairaPalette.primary.main}}>
           {new Intl.NumberFormat("fa-IR").format(index+1)}
          </span>
          <div>
           <h3 className="text-sm font-bold" style={{color:dairaPalette.text.heading}}>
            پیام {new Intl.NumberFormat("fa-IR").format(index+1)}
           </h3>
           <p className="mt-0.5 text-xs" style={{color:dairaPalette.text.body}}>
            {getMessageTypeLabel(item.messageType)}
           </p>
          </div>
         </div>
         <div className="flex items-center gap-1.5">
          <button type="button" title="انتقال پیام به بالا" aria-label={`انتقال پیام ${index+1} به بالا`}
           disabled={saving||index===0} onClick={()=>moveMessage(index,-1)}
           className="flex size-10 items-center justify-center rounded-xl border disabled:opacity-35"
           style={{borderColor:dairaPalette.border,color:dairaPalette.primary.main}}>
           <ArrowUp size={17} aria-hidden="true"/>
          </button>
          <button type="button" title="انتقال پیام به پایین" aria-label={`انتقال پیام ${index+1} به پایین`}
           disabled={saving||index===messages.length-1} onClick={()=>moveMessage(index,1)}
           className="flex size-10 items-center justify-center rounded-xl border disabled:opacity-35"
           style={{borderColor:dairaPalette.border,color:dairaPalette.primary.main}}>
           <ArrowDown size={17} aria-hidden="true"/>
          </button>
          <button type="button" title="حذف پیام" aria-label={`حذف پیام ${index+1}`}
           disabled={saving||messages.length===1} onClick={()=>{
            setMessages(current=>current.filter(message=>message.id!==item.id));
            setShowcaseDraftChanged(current=>{
              const next={...current};delete next[item.id];return next;
            });
           }}
           className="sd-destructive-button flex size-10 items-center justify-center rounded-xl border disabled:opacity-35"
           style={{borderColor:dairaPalette.status.errorBorder,color:dairaPalette.status.errorText}}>
           <Trash2 size={16} aria-hidden="true"/>
          </button>
         </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
         <PublishingStoryAutomationSetup
          key={item.id}
          ref={node=>{messageEditors.current[item.id]=node;}}
          message={item} showcases={showcases} forms={forms} formTemplates={formTemplates}
          loadingResources={false} instagramAccountId={account.id}
          onUpdate={patch=>setMessages(current=>current.map(message=>message.id===item.id
           ?{...message,...patch}:message))}
          keywordValid={keywordValid} storyCreateMode storyEditMode={Boolean(original)}
          hideLibrary onDraftChange={getShowcaseDraftHandler(item.id)}
          disabled={saving} showFinalSave={false} onContinue={()=>undefined}
          responseTypeTitle="نوع پیام"
          responseTypeDescription="متن، عکس، وویس، ویترین یا فرم را انتخاب کن."
          textPlaceholder="متن این پیام دایرکت را بنویس..."
         />
        </div>
       </article>
      ))}
      <button type="button" disabled={saving||messages.length>=5}
       onClick={()=>setMessages(current=>[...current,createEmptyMessage()])}
       className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-bold disabled:opacity-40"
       style={{borderColor:dairaPalette.border,color:dairaPalette.primary.main}}>
       <Plus size={18} aria-hidden="true"/> افزودن پیام بعدی
       <span className="text-xs font-normal">({new Intl.NumberFormat("fa-IR").format(messages.length)} از ۵)</span>
      </button>
      <p className="rounded-xl border p-3 text-xs leading-6"
       style={{borderColor:dairaPalette.border,color:dairaPalette.text.body}}>
       پیام‌ها پشت سر هم، به ترتیب نمایش داده‌شده، ارسال می‌شوند.
       اگر یک پیام «فرم» باشد، باید در انتهای لیست قرار بگیرد؛
       چون ارسال آن تا دریافت انتخاب کاربر منتظر می‌ماند. آپلود ویدیو فعلاً غیرفعال است.
      </p>
      <button type="button" onClick={()=>void save()}
       disabled={saving||!keywordValid||!hasChanges}
       className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
       style={{background:dairaPalette.primary.main}}>
       {saving?"در حال ذخیره...":original?"ذخیره تغییرات":"ساخت پاسخ خودکار دایرکت"}
      </button>
     </div>
    </section>
   {error&&<p role="alert" className="rounded-xl border px-4 py-3 text-xs leading-6"
    style={{borderColor:dairaPalette.status.error,background:dairaPalette.background.surface,color:dairaPalette.status.error}}>{error}</p>}
 </div>;
}
