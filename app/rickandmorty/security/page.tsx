"use client";
import {useEffect,useState} from "react";
import {AdminHeading,AdminPanel,AdminAlert} from "@/components/admin/AdminWidgets";
export default function AdminSecurityPage(){
 const [remaining,setRemaining]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[migrated,setMigrated]=useState(0);
 useEffect(()=>{fetch("/api/admin/security/meta-token-migration",{cache:"no-store"}).then(r=>r.json()).then(x=>{if(typeof x.remaining==="number")setRemaining(x.remaining);}).catch(()=>setError("وضعیت توکن‌ها در دسترس نیست."));},[]);
 async function migrate(){
  if(!window.confirm("توکن‌های متای ذخیره‌شده با رمزنگاری AES-GCM به‌صورت مرحله‌ای به‌روزرسانی شوند؟ این فرایند اتصال پیج‌ها را قطع نمی‌کند."))return;
  setBusy(true);setError("");
  try{
   let left=remaining??0,done=0;
   for(let i=0;i<12&&left>0;i++){
    const res=await fetch("/api/admin/security/meta-token-migration",{method:"POST"});
    const data=await res.json();if(!res.ok)throw Error(data.message||"مهاجرت ناموفق بود.");
    done+=data.changed;left=data.remaining;
    if(data.changed===0)break;
   }
   setMigrated(done);setRemaining(left);
  }catch(e){setError(e instanceof Error?e.message:"خطای مهاجرت");}finally{setBusy(false);}
 }
 return <div><AdminHeading title="امنیت مدیریت" description="تأیید دومرحله‌ای برای دسترسی به این بخش و همه عملیات مدیریت الزامی است."/>
  {error&&<AdminAlert>{error}</AdminAlert>}
  <AdminPanel>
   <h2 style={{fontWeight:800,marginBottom:12}}>رمزنگاری توکن‌های متا</h2>
   <p style={{lineHeight:2}}>از این پس توکن‌های جدید و تمدیدشده به‌صورت رمزنگاری‌شده ذخیره می‌شوند. برای تبدیل توکن‌های قدیمی بدون قطع پیج‌ها، این عملیات را اجرا کن.</p>
   <p>توکن‌های نیازمند مهاجرت: <strong>{remaining===null?"در حال بررسی":remaining.toLocaleString("fa-IR")}</strong></p>
   {migrated>0&&<p role="status">تعداد تبدیل‌شده در این اجرا: {migrated.toLocaleString("fa-IR")}</p>}
   <button type="button" disabled={busy||!remaining} onClick={()=>void migrate()} style={{border:0,borderRadius:11,background:"#346ce8",color:"white",padding:"12px 18px",marginTop:12,cursor:"pointer"}}>
    {busy?"در حال تبدیل...":remaining===0?"همه توکن‌ها رمزنگاری شده‌اند":"شروع مهاجرت امن توکن‌ها"}
   </button>
  </AdminPanel>
 </div>;
}
