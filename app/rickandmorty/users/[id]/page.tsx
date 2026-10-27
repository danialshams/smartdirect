"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowRight} from "lucide-react";
import {AdminAlert,AdminButton,AdminHeading,AdminInput,AdminPanel,AdminSection,AdminSelect,AdminSpinner,AdminStatus,formatDate,planOptions,plans} from "@/components/admin/AdminWidgets";
import {AdminIdentity,AdminInfo,AdminInfoGrid,AdminCardHeader,AdminActionArea,AdminMetrics,AdminListItem} from "@/components/admin/AdminDataView";
import AdminMobileSections from "@/components/admin/AdminMobileSections";

type Subscription={id:string;planKey:string;status:string;source:string;startedAt:string;expiresAt:string;suspendedAt?:string|null;cancelledAt?:string|null;note?:string|null;autoRenew:boolean;createdAt:string;effectiveStatus?:string};
type Detail={id:string;name:string;email:string;isBlocked:boolean;blockedReason:string|null;phone:string|null;phoneVerifiedAt:string|null;smsConsentAt:string|null;createdAt:string;activeAutomations:number;instagramAccounts:{id:string;igUsername:string;isConnected:boolean;createdAt:string;_count:{automations:number}}[];subscriptions:Subscription[];subscription:Subscription|null;tickets:{id:string;subject:string;status:string;priority:string;updatedAt:string}[]};
const fa=(n:number)=>n.toLocaleString("fa-IR");

export default function UserDetail(){
 const {id}=useParams<{id:string}>();
 const [user,setUser]=useState<Detail|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const [plan,setPlan]=useState("monthly"),[days,setDays]=useState("0"),[phone,setPhone]=useState(""),[reason,setReason]=useState(""),[note,setNote]=useState(""),[autoRenew,setAutoRenew]=useState(false);
 const load=useCallback(async()=>{const r=await fetch("/api/admin/users/"+id,{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.message||"دریافت اطلاعات ناموفق بود");setUser(j);setPlan(j.subscription?.planKey==="free"?"monthly":j.subscription?.planKey||"monthly");setPhone(j.phone||"");setDays("0");setNote(j.subscription?.note||"");setAutoRenew(!!j.subscription?.autoRenew);},[id]);
 useEffect(()=>{let active=true;setLoading(true);load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[load]);
 const call=async(url:string,body:Record<string,unknown>,method:"PATCH"|"POST")=>{
  setBusy(true);setError("");setSuccess("");
  try{const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.message||"درخواست ناموفق بود");await load();setSuccess("تغییرات با موفقیت ثبت شد.");}
  catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 const sub=(action:string)=>call("/api/admin/users/"+id+"/subscription",{action,planKey:plan,days:Number(days)},"POST");
 if(loading)return <AdminSpinner/>;
 if(!user)return <AdminAlert>{error||"کاربر پیدا نشد"}</AdminAlert>;
 const current=user.subscription,active=current?.effectiveStatus==="ACTIVE";
 const connected=user.instagramAccounts.filter(x=>x.isConnected).length;
 const planChanged=!current||plan!==(current.planKey==="free"?"monthly":current.planKey)||Number(days)!==0;
 return <div className="adm-user-detail">
  <AdminHeading title="مدیریت کاربر"><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/users">کاربران <ArrowRight size={16}/></Link></AdminHeading>
  {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
  {success&&<AdminAlert kind="success" onClose={()=>setSuccess("")}>{success}</AdminAlert>}
  <AdminIdentity initial={user.name?.trim().slice(0,1)||"ک"} title={user.name||"بدون نام"} subtitle={user.email} aside={<AdminStatus status={user.isBlocked?"BLOCKED":"ACTIVE"}/>}/>
  <AdminMobileSections labels={["حساب","اشتراک","پیج‌ها","پشتیبانی","سوابق"]}>
   <AdminSection title="اطلاعات حساب">
    <div className="adm-detail-stack">
     <AdminMetrics items={[{label:"پیج متصل",value:fa(connected)},{label:"پاسخ خودکار فعال",value:fa(user.activeAutomations)},{label:"تیکت پشتیبانی",value:fa(user.tickets.length)}]}/>
     <AdminPanel>
      <AdminCardHeader title="مشخصات" description="اطلاعات هویتی و تماس"/>
      <AdminInfoGrid>
       <AdminInfo label="نام" wide>{user.name||"بدون نام"}</AdminInfo>
       <AdminInfo label="عضویت">{formatDate(user.createdAt)}</AdminInfo>
       <AdminInfo label="دسترسی"><AdminStatus status={user.isBlocked?"BLOCKED":"ACTIVE"}/></AdminInfo>
       <AdminInfo label="ایمیل" wide dir="ltr">{user.email}</AdminInfo>
       <AdminInfo label="شماره موبایل" dir="ltr">{user.phone||"ثبت نشده"}</AdminInfo>
       <AdminInfo label="وضعیت شماره">{user.phoneVerifiedAt?"تأییدشده":"تأییدنشده"}</AdminInfo>
       <AdminInfo label="رضایت پیامک">{user.smsConsentAt?"ثبت‌شده":"ثبت‌نشده"}</AdminInfo>
       <AdminInfo label="پیج‌های متصل">{fa(connected)}</AdminInfo>
      </AdminInfoGrid>
     </AdminPanel>
     <AdminPanel>
      <AdminCardHeader title="ویرایش شماره" description="تغییر اطلاعات تماس حساب"/>
      <div className="adm-action-area"><div className="adm-action-controls">
       <AdminInput label="شماره موبایل" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09120000000" dir="ltr"/>
       <AdminButton disabled={busy||phone===(user.phone||"")} onClick={()=>void call("/api/admin/users/"+id,{phone},"PATCH")}>ذخیره شماره</AdminButton>
      </div><p className="adm-inline-note">ثبت دستی شماره به معنی تأیید مالکیت یا رضایت دریافت پیامک نیست.</p></div>
     </AdminPanel>
     <AdminPanel>
      <AdminCardHeader title="دسترسی حساب" aside={<AdminStatus status={user.isBlocked?"BLOCKED":"ACTIVE"}/>}/>
      {user.isBlocked?<div className="adm-action-area"><AdminInfoGrid><AdminInfo label="دلیل مسدودسازی" wide>{user.blockedReason||"ثبت نشده"}</AdminInfo></AdminInfoGrid><div className="adm-action-controls"><AdminButton disabled={busy} onClick={()=>void call("/api/admin/users/"+id,{isBlocked:false},"PATCH")}>رفع مسدودیت حساب</AdminButton></div></div>:
      <AdminActionArea title="مسدودسازی حساب" description="دسترسی کاربر به پنل قطع می‌شود؛ اشتراک او به‌طور مستقل مدیریت می‌شود." danger>
       <AdminInput label="علت مسدودسازی (اختیاری)" value={reason} onChange={e=>setReason(e.target.value)}/>
       <AdminButton kind="danger" disabled={busy} onClick={()=>{if(window.confirm("دسترسی این کاربر به SmartDirect قطع شود؟"))void call("/api/admin/users/"+id,{isBlocked:true,blockedReason:reason},"PATCH");}}>مسدودکردن حساب</AdminButton>
      </AdminActionArea>}
     </AdminPanel>
    </div>
   </AdminSection>
   <AdminSection title="اشتراک و اعتبار">
    <div className="adm-detail-stack">
     <AdminPanel>
      <AdminCardHeader title="وضعیت اشتراک" aside={<AdminStatus status={current?.effectiveStatus||"NONE"}/>}/>
      <AdminInfoGrid>
       <AdminInfo label="پلن">{current?plans[current.planKey]||current.planKey:"بدون اشتراک"}</AdminInfo>
       <AdminInfo label="تاریخ انقضا">{formatDate(current?.expiresAt)}</AdminInfo>
       <AdminInfo label="شروع اشتراک">{formatDate(current?.startedAt)}</AdminInfo>
       <AdminInfo label="منبع">{current?.source||"—"}</AdminInfo>
      </AdminInfoGrid>
     </AdminPanel>
     <AdminPanel>
      <AdminCardHeader title="تغییر پلن و اعتبار" description="ویرایش مدت و نوع اشتراک"/>
      <div className="adm-form-grid">
       <AdminSelect label="نوع اشتراک" value={plan} onChange={e=>setPlan(e.target.value)} options={planOptions.filter(x=>x.value&&x.value!=="free")}/>
       <AdminInput type="number" label="تغییر روز" value={days} onChange={e=>setDays(e.target.value)} min={-3650} max={3650}/>
      </div>
      <p className="adm-inline-note" style={{margin:"11px 0 15px"}}>عدد مثبت مدت را افزایش و عدد منفی آن را کاهش می‌دهد. شرایط پلن زیر ۱۰هزار فالوور هنگام ثبت بررسی می‌شود.</p>
      <AdminActionArea>
       <AdminButton disabled={busy||!planChanged||!Number.isFinite(Number(days))} onClick={()=>void sub("save")}>{busy?"در حال ذخیره…":current?"ذخیره تغییرات":"ایجاد اشتراک"}</AdminButton>
       {!active&&<AdminButton kind="secondary" disabled={busy} onClick={()=>void sub("activate")}>فعال‌سازی</AdminButton>}
       {active&&<AdminButton kind="danger" disabled={busy} onClick={()=>{if(window.confirm("اشتراک این کاربر تعلیق شود؟"))void sub("suspend");}}>تعلیق</AdminButton>}
       {current&&<AdminButton kind="secondary" disabled={busy} onClick={()=>{if(window.confirm("اشتراک لغو شود؟"))void sub("cancel");}}>لغو اشتراک</AdminButton>}
      </AdminActionArea>
     </AdminPanel>
     {current&&<AdminPanel>
      <AdminCardHeader title="تنظیمات اشتراک" description="تنظیمات داخلی مدیریت"/>
      <div className="adm-detail-stack">
       <AdminInput label="یادداشت مدیر" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/>
       <label className="adm-check-option"><input type="checkbox" checked={autoRenew} onChange={e=>setAutoRenew(e.target.checked)}/><span>تمدید خودکار <small>این گزینه به معنی فعال بودن پرداخت خودکار نیست.</small></span></label>
       <div className="adm-btn-row"><AdminButton kind="secondary" disabled={busy||(current.note||"")===note&&current.autoRenew===autoRenew} onClick={()=>void call("/api/admin/subscriptions/"+current.id,{note,autoRenew},"PATCH")}>ذخیره تنظیمات</AdminButton></div>
      </div>
     </AdminPanel>}
    </div>
   </AdminSection>
   <AdminSection title="پیج‌های اینستاگرام">
    {user.instagramAccounts.length?<div className="adm-entity-list">{user.instagramAccounts.map(a=>
     <AdminListItem key={a.id} title={<span dir="ltr">@{a.igUsername}</span>} aside={<AdminStatus status={a.isConnected?"ACTIVE":"SUSPENDED"}/>}>
      <AdminInfoGrid><AdminInfo label="پاسخ‌های خودکار">{fa(a._count.automations)}</AdminInfo><AdminInfo label="زمان اتصال">{formatDate(a.createdAt)}</AdminInfo></AdminInfoGrid>
     </AdminListItem>)}</div>:<AdminPanel><p className="adm-muted">هیچ پیجی ثبت نشده است.</p></AdminPanel>}
   </AdminSection>
   <AdminSection title="پشتیبانی کاربر">
    <div className="adm-detail-stack">
     <div className="adm-entity-list">{user.tickets.map(t=><Link key={t.id} href={"/rickandmorty/tickets/"+t.id} className="adm-entity-row adm-record-link">
      <div className="adm-entity-line"><div className="adm-entity-title"><strong>{t.subject}</strong><small>{formatDate(t.updatedAt)}</small></div><AdminStatus status={t.status}/></div>
      <div className="adm-entity-footer"><span>اولویت: <AdminStatus status={t.priority}/></span><span className="adm-card-link">مشاهده تیکت</span></div>
     </Link>)}</div>
     {!user.tickets.length&&<AdminPanel><p className="adm-muted">تیکتی ثبت نشده است.</p></AdminPanel>}
     <Link className="adm-btn adm-btn-secondary" href={"/rickandmorty/tickets?userId="+id}>همه تیکت‌های کاربر</Link>
    </div>
   </AdminSection>
   <AdminSection title="تاریخچه اشتراک">
    {user.subscriptions.length?<div className="adm-entity-list">{user.subscriptions.map(s=>
     <AdminListItem key={s.id} title={plans[s.planKey]||s.planKey} aside={<AdminStatus status={s.status}/>}
      footer={<><span>{formatDate(s.startedAt)} تا {formatDate(s.expiresAt)}</span><span>{s.source}</span></>}>
      {s.note&&<details className="adm-meta-original-details"><summary>یادداشت این دوره</summary><p>{s.note}</p></details>}
     </AdminListItem>)}</div>:<AdminPanel><p className="adm-muted">سابقه‌ای وجود ندارد.</p></AdminPanel>}
   </AdminSection>
  </AdminMobileSections>
 </div>;
}
