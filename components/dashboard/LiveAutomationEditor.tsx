"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Plus, X } from "lucide-react";
import { dairaPalette } from "@/lib/design-system/palette";
import LiveAutomationSkeleton from "./LiveAutomationSkeleton";
import PublishingStoryAutomationSetup, { type StoryFormTemplate } from "./publishing/PublishingStoryAutomationSetup";
import { createEmptyMessage, normalizeMessages, type MessageDraft, type Showcase, type FormItem } from "./automation-form-utils";

type Account = { id: string; isConnected: boolean; igUsername: string };
type SavedRule = {
  id: string; instagramAccountId: string; keyword: string | null;
  keywordMatchMode: string; liveReplyMode: string; liveReplyKeyword: string | null;
  replyText: string | null; requireFollow: boolean; followGateText: string | null;
  updatedAt: string; messages: unknown;
};
const guide = [
  ["کلمات کلیدی","وقتی بیننده این کلمات را در چت لایو بنویسد، دایرکت ارسال می‌شود."],
  ["نوع پاسخ","دایرکت مستقیم یا پاسخ چندمرحله‌ای را انتخاب کن."],
  ["اولین دایرکت","اولین پیام خصوصی حتماً متن است؛ لینک را می‌توان داخل متن قرار داد."],
  ["اجبار به فالو","اختیاری است؛ وضعیت فالو پیش از ارسال محتوای مرحلهٔ دوم بررسی می‌شود."],
  ["پاسخ بعد از دایرکت","وقتی بیننده کلمه ادامه را تایپ کرد، این پاسخ ارسال می‌شود."],
] as const;
function Section({ index, children }: { index: number; children: React.ReactNode }) {
  const [heading,subtitle] = guide[index];
  return <section className="space-y-2">
    <div className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-3">
      <Lightbulb size={17} className="mt-1 shrink-0 text-[#2563EB]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-white">{new Intl.NumberFormat("fa-IR").format(index+1)}</span>
          <h2 className="text-sm font-bold text-[#1E40AF]">{heading}</h2>
        </div>
        <p className="mt-1 text-xs leading-6 text-[#475569]">{subtitle}</p>
      </div>
    </div>
    <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">{children}</div>
  </section>;
}
const emptyMessage = () => createEmptyMessage();
export default function LiveAutomationEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [account,setAccount] = useState<Account|null>(null);
  const [saved,setSaved] = useState<SavedRule|null>(null);
  const [loading,setLoading] = useState(true);
  const [resourcesLoading,setResourcesLoading] = useState(true);
  const [error,setError] = useState("");
  const [saving,setSaving] = useState(false);
  const [keyword,setKeyword] = useState("");
  const [keywordDraft,setKeywordDraft] = useState("");
  const [keywordMatchMode,setKeywordMatchMode] = useState<"EXACT"|"CONTAINS_ANY">("EXACT");
  const [mode,setMode] = useState<"DIRECT"|"FOLLOWUP">("DIRECT");
  const [firstText,setFirstText] = useState("");
  const [replyKeyword,setReplyKeyword] = useState("ارسال کن");
  const [requireFollow,setRequireFollow] = useState(false);
  const [followGateText,setFollowGateText] = useState("برای دریافت پاسخ ابتدا پیج را فالو کن.");
  const [answer,setAnswer] = useState<MessageDraft>(()=>emptyMessage());
  const [initialSnapshot,setInitialSnapshot] = useState("");
  const [showcaseDirty,setShowcaseDirty] = useState(false);
  const [showcases,setShowcases] = useState<Showcase[]>([]);
  const [forms,setForms] = useState<FormItem[]>([]);
  const [templates,setTemplates] = useState<StoryFormTemplate[]>([]);

  useEffect(()=>{
    const controller = new AbortController();
    void (async()=>{
      try {
        const accounts = await fetch("/api/instagram/accounts",{credentials:"include",cache:"no-store",signal:controller.signal});
        const accountsData = await accounts.json();
        if(!accounts.ok||!accountsData?.success)throw new Error(accountsData?.error||"دریافت پیج ناموفق بود.");
        const active = (Array.isArray(accountsData.accounts)?accountsData.accounts:[]).find((item:Account)=>item.isConnected);
        if(!active)throw new Error("پیج اینستاگرام متصل نیست.");
        if(controller.signal.aborted)return;
        setAccount(active);
        if(id){
          const response = await fetch("/api/live-automation/"+encodeURIComponent(id),{credentials:"include",cache:"no-store",signal:controller.signal});
          const result = await response.json();
          if(!response.ok||!result?.success||!result?.data)throw new Error(result?.error||"پاسخ لایو پیدا نشد.");
          const rule = result.data as SavedRule;
          if(rule.instagramAccountId!==active.id)throw new Error("این پاسخ به پیج فعال تعلق ندارد.");
          const messages = normalizeMessages(rule.messages);
          const initialAnswer = messages[0] || emptyMessage();
          const initial = {
            keyword:rule.keyword||"",keywordMatchMode:rule.keywordMatchMode==="CONTAINS_ANY"?"CONTAINS_ANY":"EXACT",
            mode:rule.liveReplyMode==="FOLLOWUP"?"FOLLOWUP":"DIRECT",
            firstText:rule.replyText||"",replyKeyword:rule.liveReplyKeyword||"ارسال کن",
            requireFollow:Boolean(rule.requireFollow),
            followGateText:rule.followGateText||"برای دریافت پاسخ ابتدا پیج را فالو کن.",
            answer:initialAnswer,
          };
          if(controller.signal.aborted)return;
          setSaved(rule);setKeyword(initial.keyword);setKeywordMatchMode(initial.keywordMatchMode as "EXACT"|"CONTAINS_ANY");
          setMode(initial.mode);setFirstText(initial.firstText);setReplyKeyword(initial.replyKeyword);
          setRequireFollow(initial.requireFollow);setFollowGateText(initial.followGateText);setAnswer(initialAnswer);
          setInitialSnapshot(JSON.stringify(initial));
        }
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"بارگذاری پاسخ خودکار ناموفق بود.");}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();
    return ()=>controller.abort();
  },[id]);

  useEffect(()=>{
    if(!account)return;
    const controller = new AbortController();
    void(async()=>{
      try {
        const key="?instagramAccountId="+encodeURIComponent(account.id);
        const [showcaseResponse,formResponse,automationResponse,savedResponse] = await Promise.all([
          fetch("/api/showcases"+key,{credentials:"include",cache:"no-store",signal:controller.signal}),
          fetch("/api/forms"+key,{credentials:"include",cache:"no-store",signal:controller.signal}),
          fetch("/api/automations"+key,{credentials:"include",cache:"no-store",signal:controller.signal}),
          fetch("/api/saved-responses"+key,{credentials:"include",cache:"no-store",signal:controller.signal}),
        ]);
        const [showcaseData,formData,automationData,savedData] = await Promise.all([
          showcaseResponse.json(),formResponse.json(),automationResponse.json(),savedResponse.json(),
        ]);
        if(controller.signal.aborted)return;
        setShowcases(Array.isArray(showcaseData)?showcaseData:Array.isArray(showcaseData?.data)?showcaseData.data:[]);
        setForms(Array.isArray(formData)?formData:Array.isArray(formData?.data)?formData.data:[]);
        const collected:StoryFormTemplate[]=[];
        for(const row of Array.isArray(automationData?.data)?automationData.data:[]){
          for(const message of normalizeMessages(row.messages)){
            if(message.messageType==="FORM" && message.quickReplies.length>=2)
              collected.push({id:"automation:"+row.id+":"+message.id,title:"فرم — "+message.text.slice(0,46),text:message.text,quickReplies:message.quickReplies});
          }
        }
        for(const raw of Array.isArray(savedData?.data)?savedData.data:[]){
          if(raw?.messageType!=="FORM")continue;
          const msg=normalizeMessages([{...raw,messageType:"FORM"}])[0];
          if(msg?.quickReplies.length>=2)collected.push({id:"saved:"+raw.id,title:raw.title||"فرم ذخیره‌شده",text:msg.text,quickReplies:msg.quickReplies});
        }
        setTemplates(collected);
      }catch(e){if(!controller.signal.aborted)setError((old)=>old|| (e instanceof Error?e.message:"بارگذاری فرم‌ها و ویترین‌ها ناموفق بود."));}
      finally{if(!controller.signal.aborted)setResourcesLoading(false);}
    })();
    return ()=>controller.abort();
  },[account]);

  const snapshot = JSON.stringify({keyword,keywordMatchMode,mode,firstText,replyKeyword,requireFollow,followGateText,answer});
  const dirty = !id || snapshot!==initialSnapshot || showcaseDirty;
  const words = keyword.split(/[,،;؛\n]+/).map((s)=>s.trim()).filter(Boolean);
  const canSave = !saving && !loading && !resourcesLoading && dirty && words.length>0 && words.length<=10 &&
    firstText.trim().length>0 && firstText.trim().length<=1000 &&
    (!requireFollow || (mode==="FOLLOWUP" && followGateText.trim().length>0 && firstText.trim().length+followGateText.trim().length+2<=1000)) &&
    (mode==="DIRECT" || Boolean(replyKeyword.trim()));
  function addKeyword() {
    const value=keywordDraft.trim();if(!value||words.some(x=>x.toLocaleLowerCase()===value.toLocaleLowerCase())||words.length>=10)return;
    setKeyword([...words,value].join(","));setKeywordDraft("");
  }
  async function save(messageOverride?:MessageDraft){
    if(!canSave||!account)return;
    setSaving(true);setError("");
    try{
      const body={
        instagramAccountId:account.id,expectedUpdatedAt:saved?.updatedAt,
        keyword,keywordMatchMode,mode,firstText,replyKeyword,requireFollow,followGateText,
        answer:mode==="FOLLOWUP"?(messageOverride||answer):null,
      };
      const response=await fetch(id?"/api/live-automation/"+encodeURIComponent(id):"/api/live-automation",{
        method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(body),
      });
      const result=await response.json();
      if(!response.ok||!result?.success)throw new Error(result?.error||"ذخیره پاسخ خودکار لایو ناموفق بود.");
      router.push("/dashboard/live-automation",{scroll:true});
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"ذخیره ناموفق بود.");}
    finally{setSaving(false);}
  }
  if(loading)return <LiveAutomationSkeleton variant="editor"/>;
  if(!account)return <div dir="rtl" role="alert" className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error||"پیج متصل نیست."}</div>;

  return <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 pb-10">
    <Section index={0}>
      <div className="flex flex-wrap gap-2">{words.map((word)=>(
        <span key={word} className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-bold text-[#2563EB]">{word}
          <button type="button" aria-label={"حذف "+word} onClick={()=>setKeyword(words.filter(x=>x!==word).join(","))}><X size={14}/></button>
        </span>
      ))}</div>
      <div className="flex items-center gap-2">
        <input aria-label="کلمه کلیدی جدید" value={keywordDraft} onChange={e=>setKeywordDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addKeyword();}}}
          placeholder="مثلاً قیمت یا لینک" className="min-w-0 flex-1 rounded-xl border border-[#CBD5E1] bg-white px-3 py-3 text-base outline-none focus:border-[#2563EB]"/>
        <button type="button" onClick={addKeyword} disabled={!keywordDraft.trim()||words.length>=10}
          className="sd-neutral-button inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#2563EB] px-3 text-xs font-bold text-white disabled:opacity-40"><Plus size={15}/> افزودن</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([{value:"EXACT",label:"مطابقت دقیق"},{value:"CONTAINS_ANY",label:"شامل کلمه"}] as const).map(item=>(
          <button type="button" key={item.value} aria-pressed={keywordMatchMode===item.value} onClick={()=>setKeywordMatchMode(item.value)}
            className={"sd-neutral-button min-h-11 rounded-xl border text-xs font-bold "+(keywordMatchMode===item.value?"border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]":"border-[#CBD5E1] bg-white text-[#475569]")}>{item.label}</button>
        ))}
      </div>
    </Section>
    <Section index={1}>
      <div className="grid gap-2 sm:grid-cols-2">
        {([{value:"DIRECT",title:"پاسخ متنی مستقیم",desc:"فقط یک دایرکت متنی با امکان لینک داخل متن."},{value:"FOLLOWUP",title:"پاسخ چندمرحله‌ای",desc:"اول متن؛ پس از جواب بیننده، عکس، وویس، ویترین یا فرم."}] as const).map(option=>(
          <button key={option.value} type="button" aria-pressed={mode===option.value} onClick={()=>{setMode(option.value);if(option.value==="DIRECT")setRequireFollow(false);}}
            className={"sd-neutral-button min-h-24 space-y-1 rounded-xl border p-3 text-right transition "+(mode===option.value?"border-[#2563EB] bg-[#EFF6FF]":"border-[#CBD5E1] bg-white hover:border-[#93C5FD]")}>
            <strong className="block text-sm text-[#0F172A]">{option.title}</strong><span className="block text-xs leading-5 text-[#64748B]">{option.desc}</span>
          </button>
        ))}
      </div>
    </Section>
    <Section index={2}>
      <label className="block text-xs font-semibold text-[#334155]">متن اولین دایرکت</label>
      <textarea value={firstText} onChange={e=>setFirstText(e.target.value)} maxLength={1000} rows={4}
        placeholder={mode==="DIRECT"?"مثلاً قیمت محصول ۵۹۰ هزار تومان است. لینک سفارش: https://...":"سلام! برای دریافت اطلاعات، همینجا بنویس «ارسال کن»."}
        className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white p-3 text-base leading-7 outline-none focus:border-[#2563EB]"/>
      <p className="text-[11px] text-[#64748B]">{new Intl.NumberFormat("fa-IR").format(firstText.length)} از ۱۰۰۰ کاراکتر</p>
    </Section>
    <Section index={3}>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#0F172A]">اجبار به فالو <span className="text-xs font-normal text-[#64748B]">(اختیاری)</span></span>
        <input type="checkbox" role="switch" checked={requireFollow} onChange={e=>{setRequireFollow(e.target.checked);if(e.target.checked)setMode("FOLLOWUP");}}
          className="daira-form-switch shrink-0 -scale-x-100"/>
      </label>
      {requireFollow&&<div className="space-y-2 border-t border-[#EDF1F6] pt-3">
        <label className="block text-xs font-semibold text-[#334155]">متن درخواست فالو</label>
        <textarea value={followGateText} onChange={e=>setFollowGateText(e.target.value)} rows={2} maxLength={640}
          placeholder="برای دریافت محتوا ابتدا پیج را فالو کن."
          className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white p-3 text-base outline-none focus:border-[#2563EB]"/>
        <p className="text-xs leading-6 text-[#64748B]">بعد از اینکه بیننده به دایرکت پاسخ داد، فالو بررسی می‌شود. تا آن موقع پاسخ اصلی ارسال نمی‌شود.</p>
      </div>}
    </Section>
    {mode==="FOLLOWUP"&&<Section index={4}>
      <label className="block text-xs font-semibold text-[#334155]">کلمه ادامه گفتگو در دایرکت</label>
      <input value={replyKeyword} onChange={e=>setReplyKeyword(e.target.value)} maxLength={100}
        placeholder="ارسال کن" className="w-full rounded-xl border border-[#CBD5E1] bg-white p-3 text-base outline-none focus:border-[#2563EB]"/>
      <p className="text-xs leading-6 text-[#64748B]">بیننده باید خودش این عبارت را در دایرکت بفرستد؛ دکمه‌ای در اولین پیام نمایش داده نمی‌شود.</p>
      <div className="border-t border-[#EDF1F6] pt-4">
        <PublishingStoryAutomationSetup
          message={answer} showcases={showcases} forms={forms} formTemplates={templates}
          loadingResources={resourcesLoading} instagramAccountId={account.id}
          keywordValid={Boolean(replyKeyword.trim())} onUpdate={patch=>setAnswer(current=>({...current,...patch}))}
          onContinue={(override)=>save(override)} storyCreateMode storyEditMode={Boolean(id)}
          onDraftChange={setShowcaseDirty}
          responseTypeTitle="نوع پاسخ" responseTypeDescription="" showFinalSave
          finalSaveDisabled={!canSave} disabled={saving}
          finalSaveLabel={id?"ذخیره تغییرات":"ساخت پاسخ خودکار"}
          finalSaveLoadingLabel="در حال ذخیره..."
          textPlaceholder="متنی که بعد از پاسخ بیننده ارسال می‌شود..."
        />
      </div>
    </Section>}
    {mode==="DIRECT"&&<button type="button" onClick={()=>void save()} disabled={!canSave}
      className="min-h-12 w-full rounded-xl bg-[#2563EB] px-5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40">
      {saving?"در حال ذخیره...":id?"ذخیره تغییرات":"ساخت پاسخ خودکار"}
    </button>}
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-600">{error}</p>}
  </div>;
}
