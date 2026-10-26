"use client";
import { useCallback,useEffect,useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight,Clock3,Headset,ShieldCheck,UserRound,Zap } from "lucide-react";
import { AdminAlert,AdminButton,AdminHeading,AdminInput,AdminPanel,AdminSection,AdminSelect,AdminSpinner,AdminStatus,formatDate,planOptions,plans } from "@/components/admin/AdminWidgets";
type Subscription={id:string;planKey:string;status:string;source:string;startedAt:string;expiresAt:string;suspendedAt?:string|null;cancelledAt?:string|null;note?:string|null;autoRenew:boolean;createdAt:string;effectiveStatus?:string};
type Detail={id:string;name:string;email:string;isBlocked:boolean;blockedReason:string|null;phone:string|null;phoneVerifiedAt:string|null;smsConsentAt:string|null;createdAt:string;activeAutomations:number;instagramAccounts:{id:string;igUsername:string;isConnected:boolean;createdAt:string;_count:{automations:number}}[];subscriptions:Subscription[];subscription:Subscription|null;tickets:{id:string;subject:string;status:string;priority:string;updatedAt:string}[]};
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
 const active=user.subscription?.effectiveStatus==="ACTIVE";
 return <div>
  <AdminHeading title="جزئیات کاربر" description={user.email}><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/users"><ArrowRight size={16}/> کاربران</Link></AdminHeading>
  {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
  {success&&<AdminAlert kind="success" onClose={()=>setSuccess("")}>{success}</AdminAlert>}
  <AdminSection title="حساب و اشتراک" description="اطلاعات اصلی، دسترسی کاربر و مدیریت اشتراک"><div className="adm-grid-2">
   <AdminPanel><h2><UserRound size={18} style={{display:"inline",marginLeft:8}}/>مشخصات و دسترسی</h2>
    <p><strong>{user.name}</strong></p><p className="adm-help">{user.email} · عضویت {formatDate(user.createdAt)}</p>
    <p className="adm-help">وضعیت حساب: <AdminStatus status={user.isBlocked?"SUSPENDED":"ACTIVE"}/></p>
    <p className="adm-help">پیج متصل: {user.instagramAccounts.filter(x=>x.isConnected).length.toLocaleString("fa-IR")} · اتوماسیون فعال: {user.activeAutomations.toLocaleString("fa-IR")}</p>
    {user.isBlocked&&<p className="adm-help">دلیل مسدودسازی: {user.blockedReason||"ثبت نشده"}</p>}
    <div className="adm-btn-row">{user.isBlocked?<AdminButton disabled={busy} onClick={()=>void call("/api/admin/users/"+id,{isBlocked:false},"PATCH")}>رفع مسدودیت حساب</AdminButton>:<><AdminInput label="علت مسدودسازی" value={reason} onChange={e=>setReason(e.target.value)}/><AdminButton kind="danger" disabled={busy} onClick={()=>{if(window.confirm("دسترسی این کاربر به SmartDirect قطع شود؟"))void call("/api/admin/users/"+id,{isBlocked:true,blockedReason:reason},"PATCH");}}>مسدودکردن حساب</AdminButton></>}</div>
    <hr className="adm-divider"/>
    <AdminInput label="شماره تلفن (اختیاری)" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="مثلاً 09120000000" dir="ltr"/>
    <p className="adm-help">برای پیامک واقعی، شماره باید از طرف کاربر تأیید شده و رضایت لازم ثبت شود. ثبت دستی شماره به معنی تأیید نیست.</p>
    <AdminButton kind="secondary" disabled={busy||phone===(user.phone||"")} onClick={()=>void call("/api/admin/users/"+id,{phone},"PATCH")}>ذخیره شماره</AdminButton>
   </AdminPanel>
   <AdminPanel><h2><ShieldCheck size={18} style={{display:"inline",marginLeft:8}}/>اشتراک فعلی</h2>
    <p className="adm-help">{user.subscription?plans[user.subscription.planKey]||user.subscription.planKey:"بدون اشتراک"} · <AdminStatus status={user.subscription?.effectiveStatus||"NONE"}/></p>
    <p className="adm-help">انقضا: {formatDate(user.subscription?.expiresAt)}</p>
    <div className="adm-grid-2">
     <AdminSelect label="نوع اشتراک" value={plan} onChange={e=>setPlan(e.target.value)} options={planOptions.filter(x=>x.value&&x.value!=="free")}/>
     <AdminInput type="number" label="تغییر مدت (روز)" value={days} onChange={e=>setDays(e.target.value)} min={-3650} max={3650}/>
    </div>
    <p className="adm-help">برای افزایش مدت عدد مثبت و برای کاهش عدد منفی وارد کن. پلن «ماهانه زیر ۱۰هزار» با تعداد فالوور پیج متصل بررسی می‌شود.</p>
    <div className="adm-btn-row">
     <AdminButton disabled={busy} onClick={()=>void sub("save")}>{busy?"در حال ذخیره…":user.subscription?"ذخیره پلن و مدت":"ایجاد اشتراک"}</AdminButton>
     {!active&&<AdminButton disabled={busy} kind="secondary" onClick={()=>void sub("activate")}>فعال‌سازی</AdminButton>}
     {active&&<AdminButton disabled={busy} kind="danger" onClick={()=>{if(window.confirm("اشتراک این کاربر تعلیق شود؟"))void sub("suspend");}}>تعلیق اشتراک</AdminButton>}
     {user.subscription&&<AdminButton disabled={busy} kind="secondary" onClick={()=>{if(window.confirm("اشتراک لغو شود؟"))void sub("cancel");}}>لغو</AdminButton>}
    </div>
    {user.subscription&&<><hr className="adm-divider"/><AdminInput label="یادداشت اشتراک (فقط مدیر)" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/><label className="adm-btn-row adm-help" style={{margin:"12px 0"}}><input type="checkbox" checked={autoRenew} onChange={e=>setAutoRenew(e.target.checked)}/> تمدید خودکار (صرفاً تنظیم وضعیت؛ پرداخت خودکار هنوز فعال نیست)</label><AdminButton kind="secondary" disabled={busy||user.subscription.note===note&&user.subscription.autoRenew===autoRenew} onClick={()=>void call("/api/admin/subscriptions/"+user.subscription!.id,{note,autoRenew},"PATCH")}>ذخیره جزئیات اشتراک</AdminButton></>}
   </AdminPanel>
  </div></AdminSection>
  <AdminSection title="اتصالات و فعالیت" description="پیج‌های اینستاگرام و تعداد پاسخ‌های خودکار"><AdminPanel><h2><Zap size={18} style={{display:"inline",marginLeft:8}}/>پیج‌ها و اتوماسیون‌های فعال</h2>
   <div className="adm-user-grid">{user.instagramAccounts.map(a=><article key={a.id} className="adm-ticket-row"><strong dir="ltr">@{a.igUsername}</strong><span className="adm-help">{a.isConnected?"متصل":"قطع اتصال"} · {a._count.automations.toLocaleString("fa-IR")} اتوماسیون فعال</span></article>)}</div>
   {!user.instagramAccounts.length&&<p className="adm-muted">پیجی ثبت نشده است.</p>}
  </AdminPanel></AdminSection>
  <AdminSection title="پشتیبانی" description="درخواست‌های مربوط به این کاربر"><AdminPanel><h2><Headset size={18} style={{display:"inline",marginLeft:8}}/>تیکت‌های کاربر</h2>
   <div className="adm-ticket-list">{user.tickets.map(t=><Link key={t.id} href={"/rickandmorty/tickets/"+t.id} className="adm-ticket-row"><div className="adm-ticket-row-top"><strong>{t.subject}</strong><AdminStatus status={t.status}/></div><small>{formatDate(t.updatedAt)}</small></Link>)}</div>
   {!user.tickets.length&&<p className="adm-muted">تیکتی ثبت نشده است.</p>}
   <div style={{marginTop:12}}><Link className="adm-card-link" href={"/rickandmorty/tickets?userId="+id}>مشاهده تمام تیکت‌های این کاربر</Link></div>
  </AdminPanel>
  </AdminSection><AdminSection title="سوابق اشتراک" description="تاریخچه تمدید و تغییر وضعیت‌ها"><AdminPanel><h2><Clock3 size={18} style={{display:"inline",marginLeft:8}}/>تاریخچه اشتراک</h2>
   <div className="adm-ticket-list">{user.subscriptions.map(s=><div key={s.id} className="adm-ticket-row"><div className="adm-ticket-row-top"><strong>{plans[s.planKey]||s.planKey}</strong><AdminStatus status={s.status}/></div><small>از {formatDate(s.startedAt)} تا {formatDate(s.expiresAt)} · {s.source}</small>{s.note&&<small>{s.note}</small>}</div>)}</div>
   {!user.subscriptions.length&&<p className="adm-muted">سابقه‌ای وجود ندارد.</p>}
  </AdminPanel></AdminSection>
 </div>;
}
