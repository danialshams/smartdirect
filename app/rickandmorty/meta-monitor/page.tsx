"use client";
import { useEffect,useMemo,useState } from "react";
import { BellRing,BookOpenText,Check,CheckCheck,ExternalLink,RefreshCw } from "lucide-react";
import { AdminAlert,AdminButton,AdminHeading,AdminPanel,AdminPagination,AdminSelect,AdminSpinner } from "@/components/admin/AdminWidgets";
type Notice={id:string;titleFa:string;summaryFa:string;originalTitle:string;sourceUrl:string;category:string;kind:string;apiVersion:string|null;publishedAt:string|null;detectedAt:string;isRead:boolean};
type Source={id:string;label:string;url:string;lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null;lastItemCount:number};
type Result={data:Notice[];total:number;page:number;pageSize:number;unreadCount:number;sources:Source[];run:{lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null}|null};
const categories=["","نسخه API","پاسخ به کامنت","پاسخ به استوری","پاسخ خودکار دایرکت","اشتراک‌گذاری و منشن","پاسخ به لایو","یادآوری هوشمند","صندوق دایرکت","انتشار محتوا","تحلیل پیج","منوی دایرکت و شروع گفتگو","مجوزها و وب‌هوک","سایر تغییرات مرتبط"];
const kinds:Record<string,string>={VERSION:"نسخه جدید API",NEW:"قابلیت جدید",DEPRECATION:"حذف یا منسوخ‌شدن",LIMIT:"تغییر محدودیت",UPDATE:"به‌روزرسانی"};
const date=(d?:string|null)=>d?new Date(d).toLocaleString("fa-IR"):"—";
export default function MetaMonitorPage(){
 const [data,setData]=useState<Result|null>(null),[category,setCategory]=useState(""),[unread,setUnread]=useState(false),[page,setPage]=useState(1);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[translatingId,setTranslatingId]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const params=useMemo(()=>new URLSearchParams({page:String(page),...(category?{category}:{}),...(unread?{unread:"1"}:{})}).toString(),[page,category,unread]);
 const load=async(signal?:AbortSignal)=>{
  const r=await fetch("/api/admin/meta-monitor?"+params,{cache:"no-store",signal});
  const j=await r.json();if(!r.ok)throw Error(j.message||"خطای دریافت خبرها");
  setData(j);
 };
 useEffect(()=>{
  const c=new AbortController();setLoading(true);
  load(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[params]);
 const read=async(id?:string)=>{
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/admin/meta-monitor/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});
   const j=await r.json();if(!r.ok)throw Error(j.message||"ثبت وضعیت ناموفق بود");
   await load();window.dispatchEvent(new Event("admin:meta-updated"));
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 const translate=async(id:string)=>{
  if(translatingId)return;
  setTranslatingId(id);setError("");
  try{
   const r=await fetch("/api/admin/meta-monitor/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
   const j=await r.json();if(!r.ok)throw Error(j.message||"دریافت متن فارسی ناموفق بود");
   setData(v=>v?{...v,data:v.data.map(item=>item.id===id?{...item,titleFa:j.titleFa,summaryFa:j.summaryFa}:item)}:v);
   if(j.notice)setNotice(j.notice);
  }catch(e){setError(e instanceof Error?e.message:"ترجمه در دسترس نیست");}finally{setTranslatingId(null);}
 };
 const refresh=async()=>{
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/admin/meta-monitor/refresh",{method:"POST"});
   const j=await r.json();if(!r.ok)throw Error(j.message||"بررسی منابع ناموفق بود");
   setNotice(j.successful+" منبع از "+j.checked+" منبع بررسی شد؛ "+j.newNotices+" اعلان تازه.");
   await load();window.dispatchEvent(new Event("admin:meta-updated"));
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 return <div>
 <AdminHeading title="تغییرات Meta" description="پایش خودکار مستندات رسمی Meta و امکانات مرتبط با SmartDirect به زبان فارسی">
  <AdminButton disabled={busy} kind="secondary" onClick={()=>void refresh()}><RefreshCw size={17}/>{busy?"در حال بررسی…":"بررسی همین حالا"}</AdminButton>
 </AdminHeading>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
 {notice&&<AdminAlert kind="success" onClose={()=>setNotice("")}>{notice}</AdminAlert>}
 <AdminPanel>
  <div className="adm-meta-stats">
   <div><small>اعلان خوانده‌نشده</small><strong className="adm-meta-unread-number">{data?.unreadCount.toLocaleString("fa-IR")||"۰"}</strong></div>
   <div><small>آخرین بررسی</small><strong>{date(data?.run?.lastCheckedAt)}</strong></div>
   <div><small>آخرین بررسی موفق</small><strong>{date(data?.run?.lastSuccessAt)}</strong></div>
  </div>
  <p className="adm-help">بررسی رسمی روزانه انجام می‌شود. محتوای فارسی، خلاصه دسته‌بندی‌شده است و به معنای تأیید امکان استفاده آن در SmartDirect نیست. هنگام خطای دریافت منابع، وضعیت هر منبع پایین صفحه مشخص است.</p>
 </AdminPanel>
 <AdminPanel>
  <div className="adm-btn-row" style={{justifyContent:"space-between"}}>
   <div className="adm-btn-row" style={{flex:"1"}}>
    <div style={{minWidth:180,flex:"1",maxWidth:330}}><AdminSelect label="بخش SmartDirect" options={categories.map(x=>({value:x,label:x||"همه بخش‌ها"}))} value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}/></div>
    <label className="adm-btn-row adm-help" style={{marginTop:15,cursor:"pointer"}}><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setPage(1);}}/> فقط خوانده‌نشده‌ها</label>
   </div>
   <AdminButton disabled={busy||!data?.unreadCount} kind="secondary" onClick={()=>void read()}><CheckCheck size={17}/> علامت‌گذاری همه به‌عنوان خوانده‌شده</AdminButton>
  </div>
 </AdminPanel>
 {loading&&!data?<AdminSpinner/>:<div className="adm-ticket-list">
  {data?.data.map(n=><article key={n.id} className={"adm-panel adm-meta-notice "+(n.isRead?"":"adm-meta-notice-new")}>
   <div className="adm-ticket-row-top"><div className="adm-btn-row"><span className="adm-state" data-state={n.kind==="DEPRECATION"?"URGENT":n.kind==="VERSION"?"ACTIVE":"OPEN"}>{kinds[n.kind]||"اطلاعیه"}</span><span className="adm-help">{n.category}</span>{!n.isRead&&<span className="adm-meta-dot" aria-label="اعلان جدید"/>}</div><small className="adm-muted">{date(n.publishedAt||n.detectedAt)}</small></div>
   <h2 style={{margin:"5px 0"}}>{n.titleFa}</h2>
   <p className="adm-meta-content">{n.summaryFa}</p>
   {!n.summaryFa.startsWith("ترجمه فارسی متن رسمی")&&<div className="adm-meta-content-note">
    متن کامل این اعلان هنوز ترجمه نشده است. با انتخاب گزینه زیر تلاش می‌کنیم متن واقعیِ منبع رسمی را به فارسی ترجمه کنیم.
    <div className="adm-btn-row" style={{marginTop:9}}>
     <AdminButton kind="secondary" disabled={!!translatingId} onClick={()=>void translate(n.id)}>{translatingId===n.id?"در حال ترجمه…":"دریافت توضیح فارسی از منبع رسمی"}</AdminButton>
    </div>
   </div>}
   <div className="adm-meta-original" dir="ltr">{n.originalTitle}</div>
   <div className="adm-btn-row" style={{marginTop:12}}>
    <a className="adm-btn adm-btn-secondary" href={n.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={()=>{if(!n.isRead)void read(n.id);}}><ExternalLink size={16}/> مشاهده منبع رسمی</a>
    {!n.isRead&&<AdminButton disabled={busy} kind="ghost" onClick={()=>void read(n.id)}><Check size={16}/> خواندم</AdminButton>}
   </div>
  </article>)}
  {!loading&&data?.data.length===0&&<AdminPanel><BookOpenText size={24}/><p className="adm-muted">در این فیلتر اعلانی ثبت نشده است. اگر اولین‌بار است، «بررسی همین حالا» را بزن.</p></AdminPanel>}
 </div>}
 <AdminPagination page={page} total={data?.total||0} onChange={setPage}/>
 <AdminPanel><h2><BellRing size={18} style={{display:"inline",marginLeft:8}}/>وضعیت منابع رسمی</h2>
  {data?.sources.length?data.sources.map(s=><div key={s.id} className="adm-meta-source">
   <div><strong>{s.label}</strong><small className="adm-help">آخرین بررسی موفق: {date(s.lastSuccessAt)}</small></div>
   <span className="adm-state" data-state={s.lastError?"URGENT":"ACTIVE"}>{s.lastError?"خطا در دریافت":"موفق"}</span>
   {s.lastError&&<p className="adm-help">{s.lastError}</p>}
  </div>):<p className="adm-help">هنوز منبعی بررسی نشده است.</p>}
 </AdminPanel>
 </div>;
}
