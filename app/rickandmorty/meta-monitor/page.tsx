"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {BellRing,BookOpenText,Check,CheckCheck,ExternalLink,RefreshCw,Archive,CalendarClock} from "lucide-react";
import {AdminAlert,AdminButton,AdminHeading,AdminPanel,AdminPagination,AdminSection,AdminSelect,AdminSpinner} from "@/components/admin/AdminWidgets";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
type Notice={id:string;titleFa:string;summaryFa:string;originalTitle:string;sourceUrl:string;category:string;kind:string;apiVersion:string|null;publishedAt:string|null;detectedAt:string;isRead:boolean};
type Source={id:string;label:string;url:string;lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null;lastItemCount:number};
type Result={data:Notice[];total:number;page:number;pageSize:number;unreadCount:number;archiveCount:number;sources:Source[];run:{lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null}|null};
const categories=["","نسخه API","پاسخ به کامنت","پاسخ به استوری","پاسخ خودکار دایرکت","اشتراک‌گذاری و منشن","پاسخ به لایو","یادآوری هوشمند","صندوق دایرکت","انتشار محتوا","تحلیل پیج","منوی دایرکت و شروع گفتگو","مجوزها و وب‌هوک","سایر تغییرات مرتبط"];
const kinds:Record<string,string>={VERSION:"نسخه جدید API",NEW:"قابلیت جدید",DEPRECATION:"حذف قابلیت",LIMIT:"تغییر محدودیت",UPDATE:"به‌روزرسانی"};
const date=(d?:string|null)=>d?new Date(d).toLocaleDateString("fa-IR",{year:"numeric",month:"long",day:"numeric"}):"تاریخ نامشخص";
export default function MetaMonitorPage(){
 const [data,setData]=useState<Result|null>(null),[category,setCategory]=useState(""),[unread,setUnread]=useState(false),[scope,setScope]=useState<"current"|"archive">("current"),[page,setPage]=useState(1);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[translatingId,setTranslatingId]=useState<string|null>(null),[translationError,setTranslationError]=useState<Record<string,string>>({}),[translatedNow,setTranslatedNow]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const params=useMemo(()=>new URLSearchParams({page:String(page),scope,...(category?{category}:{}),...(unread?{unread:"1"}:{})}).toString(),[page,category,unread,scope]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const res=await fetch("/api/admin/meta-monitor?"+params,{cache:"no-store",signal});
  const json=await res.json();if(!res.ok)throw Error(json.message||"دریافت خبرها ناموفق بود");
  setData(json as Result);
 },[params]);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);
  load(controller.signal).catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[load]);
 const read=async(id?:string)=>{
  if(busy)return;setBusy(true);setError("");
  try{
   const response=await fetch("/api/admin/meta-monitor/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});
   const result=await response.json();if(!response.ok)throw Error(result.message||"ثبت وضعیت ناموفق بود");
   await load();window.dispatchEvent(new Event("admin:meta-updated"));
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 const translate=async(id:string)=>{
  if(translatingId)return;
  setTranslatingId(id);setTranslationError(v=>({...v,[id]:""}));
  try{
   const response=await fetch("/api/admin/meta-monitor/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
   const result=await response.json();if(!response.ok)throw Error(result.message||"توضیح فارسی در دسترس نیست");
   setData(previous=>previous?{...previous,data:previous.data.map(item=>item.id===id?{...item,titleFa:result.titleFa,summaryFa:result.summaryFa}:item)}:previous);
   setTranslatedNow(id);
  }catch(e){setTranslationError(v=>({...v,[id]:e instanceof Error?e.message:"ترجمه ناموفق بود"}));}finally{setTranslatingId(null);}
 };
 const refresh=async()=>{
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{
   const res=await fetch("/api/admin/meta-monitor/refresh",{method:"POST"});
   const result=await res.json();if(!res.ok)throw Error(result.message||"بررسی رسمی ناموفق بود");
   setNotice("بررسی "+result.successful+" منبع از "+result.checked+" منبع انجام شد. "+result.newNotices+" خبر تازه شناسایی شد.");
   await load();window.dispatchEvent(new Event("admin:meta-updated"));
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 return <div className="adm-meta-layout">
  <AdminHeading title="تغییرات Meta" description="خبرهای رسمی مرتبط با امکانات SmartDirect؛ فقط تغییرات معتبر و جدید در نمای اصلی">
   <AdminButton kind="secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={17}/>{busy?"در حال بررسی…":"بررسی منابع رسمی"}</AdminButton>
  </AdminHeading>
  {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
  {notice&&<AdminAlert kind="success" onClose={()=>setNotice("")}>{notice}</AdminAlert>}
  <AdminMobileSections labels={["تغییرات جدید","وضعیت رصد","منابع رسمی"]}>
  <AdminSection title="اخبار و تغییرات" description="انتخاب کنید فقط خبرهای جدید را ببینید یا به آرشیو مراجعه کنید">
   <AdminPanel>
    <div className="adm-meta-view-tabs" role="group" aria-label="نوع اخبار">
     <button type="button" className={"adm-meta-view-tab "+(scope==="current"?"is-active":"")} aria-pressed={scope==="current"} onClick={()=>{setScope("current");setPage(1);}}>خبرهای جدید</button>
     <button type="button" className={"adm-meta-view-tab "+(scope==="archive"?"is-active":"")} aria-pressed={scope==="archive"} onClick={()=>{setScope("archive");setPage(1);setUnread(false);}}><Archive size={16}/> آرشیو قدیمی</button>
    </div>
    <div className="adm-meta-filter-row">
     <div className="adm-meta-filter-fields">
      <AdminSelect label="قابلیت SmartDirect" options={categories.map(x=>({value:x,label:x||"همه بخش‌ها"}))} value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}/>
      {scope==="current"&&<label className="adm-meta-unread-filter"><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setPage(1);}}/> فقط خوانده‌نشده‌ها</label>}
     </div>
     <div className="adm-meta-list-counter">{(data?.total??0).toLocaleString("fa-IR")} مورد در این فیلتر</div>
    </div>
   </AdminPanel>
   {loading&&!data?<AdminSpinner/>:<div className="adm-ticket-list">
    {data?.data.map(n=><article key={n.id} className={"adm-panel adm-meta-notice "+(!n.isRead&&scope==="current"?"adm-meta-notice-new":"")}>
     <div className="adm-meta-notice-header">
      <div className="adm-btn-row"><span className="adm-state" data-state={n.kind==="DEPRECATION"?"URGENT":n.kind==="VERSION"?"ACTIVE":"OPEN"}>{kinds[n.kind]||"اطلاعیه"}</span><span className="adm-meta-category">{n.category}</span>{!n.isRead&&scope==="current"&&<span className="adm-meta-dot" aria-label="جدید"/>}</div>
      <span className="adm-help"><CalendarClock size={15}/> {date(n.publishedAt)}</span>
     </div>
     <h2>{n.titleFa}</h2>
     <p className="adm-meta-feature"><strong>بخش مرتبط:</strong> {n.category}</p>
     {scope==="current"?<>
      {n.summaryFa.startsWith("چه چیزی در مستندات Meta")?
       <details className="adm-meta-explanation" open={translatedNow===n.id}><summary>مشاهده توضیح فارسی این تغییر</summary><div className="adm-meta-translation">{n.summaryFa}</div></details>:
       <div className="adm-meta-translation-pending">
        <p>جزئیات معتبر این اطلاعیه هنوز به فارسی آماده نشده است. متن ناقص یا خبر دیگری به‌جای آن نمایش داده نمی‌شود.</p>
        <AdminButton kind="secondary" disabled={!!translatingId} aria-busy={translatingId===n.id} onClick={()=>void translate(n.id)}>{translatingId===n.id?"در حال دریافت و ترجمه متن همین خبر…":"دریافت توضیح کامل فارسی"}</AdminButton>
        {translationError[n.id]&&<div role="alert" className="adm-meta-translate-error"><strong>دریافت توضیح انجام نشد</strong><p>{translationError[n.id]}</p><p>هیچ مطلب قدیمی یا نامرتبطی جایگزین این خبر نمی‌شود.</p></div>}
       </div>}
     </>:<p className="adm-help">این مورد قدیمی یا بدون تاریخ معتبر است و فقط برای مراجعه به سوابق نگهداری می‌شود. دریافت توضیح جدید برای آرشیو غیرفعال است.</p>}
     <details className="adm-meta-original-details"><summary>عنوان اصلی انگلیسی</summary><div dir="ltr" className="adm-meta-original">{n.originalTitle}</div></details>
     <div className="adm-meta-notice-actions">
      <a className="adm-btn adm-btn-secondary" href={n.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> مستند رسمی Meta</a>
      {!n.isRead&&<AdminButton kind="ghost" disabled={busy} onClick={()=>void read(n.id)}><Check size={17}/> علامت‌گذاری به‌عنوان خوانده‌شده</AdminButton>}
     </div>
    </article>)}
    {!loading&&data?.data.length===0&&<AdminPanel><div className="adm-empty">
     <BookOpenText size={31}/><strong>{scope==="archive"?"موردی در آرشیو پیدا نشد":"خبر جدیدی برای نمایش نیست"}</strong>
     <p>{scope==="archive"?"آرشیو این فیلتر خالی است.":"فقط اطلاعیه‌های معتبر و تازه نمایش داده می‌شوند. برای مشاهده سوابق می‌توانید به آرشیو بروید."}</p>
    </div></AdminPanel>}
   </div>}
   <AdminPagination page={page} total={data?.total||0} onChange={setPage}/>
   {scope==="current"&&(data?.unreadCount??0)>0&&<div className="adm-meta-readall"><div><strong>مدیریت اعلان‌های جدید</strong><p>با این گزینه، عدد قرمز اعلان‌ها پاک می‌شود.</p></div>
    <AdminButton kind="secondary" disabled={busy} onClick={()=>void read()}><CheckCheck size={17}/> علامت‌گذاری همه به‌عنوان خوانده‌شده</AdminButton>
   </div>}
  </AdminSection>
  <AdminSection title="وضعیت رصد" description="آخرین دریافت از منابع رسمی Meta">
   <AdminPanel>
    <div className="adm-meta-stats">
     <div><small>خبر تازه خوانده‌نشده</small><strong className="adm-meta-unread-number">{(data?.unreadCount??0).toLocaleString("fa-IR")}</strong></div>
     <div><small>آخرین بررسی منابع</small><strong>{data?.run?.lastCheckedAt?new Date(data.run.lastCheckedAt).toLocaleString("fa-IR"):"هنوز انجام نشده"}</strong></div>
     <div><small>مطالب قدیمی در آرشیو</small><strong>{(data?.archiveCount??0).toLocaleString("fa-IR")}</strong></div>
    </div>
    <p className="adm-help" style={{marginTop:18}}>منابع رسمی روزانه بررسی می‌شوند. خبرهای بدون تاریخ معتبر یا قدیمی به‌عنوان اعلان جدید نمایش داده نمی‌شوند. متن ترجمه‌شده صرفاً توضیح مستندات است و به معنی فعال‌شدن قابلیت در SmartDirect نیست.</p>
   </AdminPanel>
  </AdminSection>
  <AdminSection title="سلامت منابع رسمی" description="اگر دسترسی یک منبع قطع شود، وضعیت آن به‌صورت شفاف نمایش داده می‌شود">
   <AdminPanel><details className="adm-meta-source-collapse"><summary><BellRing size={18}/> مشاهده وضعیت منابع</summary>
    {data?.sources.length?data.sources.map(s=><div key={s.id} className="adm-meta-source"><div><strong>{s.label}</strong><small className="adm-help">آخرین موفقیت: {s.lastSuccessAt?new Date(s.lastSuccessAt).toLocaleString("fa-IR"):"هنوز نامشخص"}</small></div>
     <span className="adm-state" data-state={s.lastError?"URGENT":"ACTIVE"}>{s.lastError?"خطا در دریافت":"موفق"}</span>{s.lastError&&<p className="adm-help">{s.lastError}</p>}
    </div>):<p className="adm-help">هنوز منبعی بررسی نشده است.</p>}
   </details></AdminPanel>
  </AdminSection>
  </AdminMobileSections>
 </div>;
}