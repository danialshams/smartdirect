"use client";
import { useCallback,useEffect,useState } from "react";
import { AdminHeading,AdminPanel,AdminAlert } from "@/components/admin/AdminWidgets";

type Item={id:string;contact:string;instagramName:string|null;details:string|null;status:string;createdAt:string;verifiedAt:string|null};
const labels:Record<string,string>={PENDING:"در انتظار بررسی",VERIFYING:"در حال احراز هویت",COMPLETED:"تکمیل‌شده",REJECTED:"بسته‌شده",PROCESSING:"در حال حذف"};
export default function DeletionRequestsPage(){
 const [items,setItems]=useState<Item[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState("");
 const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{
  const r=await fetch("/api/admin/deletion-requests",{cache:"no-store"});
  const data=await r.json();
  if(!r.ok)throw new Error(data.message||"دریافت درخواست‌ها ناموفق بود.");
  setItems(data.data||[]);
 }catch(e){setError(e instanceof Error?e.message:"خطا در دریافت درخواست‌ها");}
 finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function update(item:Item,status:"VERIFYING"|"REJECTED"){
  
  if(status==="REJECTED"&&!window.confirm("درخواست بدون حذف داده بسته شود؟"))return;
  setBusy(item.id);setError("");
  try{const response=await fetch("/api/admin/deletion-requests/"+encodeURIComponent(item.id),{
   method:"PATCH",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({status})});
   const data=await response.json();if(!response.ok)throw new Error(data.message||"خطا در تغییر وضعیت");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"خطا در ثبت وضعیت");}
  finally{setBusy("");}
 }
 async function execute(item:Item){
  if(!window.confirm("اخطار: حساب کاربر، داده‌های مرتبط و فایل‌های ثبت‌شده حذف می‌شوند و قابل بازیابی نیستند. آیا مالکیت حساب را تأیید کرده‌ای؟"))return;
  setBusy(item.id);setError("");
  try{
   const r=await fetch("/api/admin/deletion-requests/"+encodeURIComponent(item.id)+"/execute",{method:"POST"});
   const data=await r.json();
   if(!r.ok)throw new Error(data.message||"حذف انجام نشد.");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"حذف انجام نشد.");}
  finally{setBusy("");}
 }
 return <div>
  <AdminHeading title="درخواست‌های حذف اطلاعات" description="ابتدا مالکیت حساب را تأیید و داده‌های مربوط را به‌صورت امن حذف کنید؛ سپس وضعیت را ثبت کنید."/>
  {error&&<AdminAlert>{error}</AdminAlert>}
  <AdminPanel><p style={{fontSize:13,lineHeight:2,marginBottom:20}}>حذف واقعی فقط پس از احراز هویت مالک و تأیید مدیر انجام می‌شود. فایل‌های ثبت‌شده در فضای ذخیره‌سازی قبل از حذف اطلاعات پایگاه‌داده پاک می‌شوند.</p>
   {loading?<p>در حال دریافت...</p>:items.length===0?<p>درخواستی ثبت نشده است.</p>:
    <div style={{display:"grid",gap:12}}>{items.map(item=><article key={item.id} style={{border:"1px solid #e2e8f0",borderRadius:14,padding:16,display:"grid",gap:10}}>
     <div><strong>{item.contact}</strong> <small>{labels[item.status]||item.status}</small></div>
     <div style={{fontSize:12,opacity:.8}}>کد: <span dir="ltr">{item.id}</span> | {new Date(item.createdAt).toLocaleString("fa-IR")}</div>
     {item.instagramName&&<div style={{fontSize:13}}>اینستاگرام: <span dir="ltr">{item.instagramName}</span></div>}
     {item.verifiedAt&&<small>مالک حساب تأیید شده است.</small>}
     {item.details&&<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.details}</p>}
     {item.status!=="COMPLETED"&&<div style={{display:"flex",flexWrap:"wrap",gap:8}}>
      <button disabled={busy===item.id} onClick={()=>void update(item,"VERIFYING")}>شروع بررسی</button>
      {item.verifiedAt&&item.status==="VERIFYING"&&<button disabled={busy===item.id} onClick={()=>void execute(item)}>حذف واقعی و کامل اطلاعات</button>}
      <button disabled={busy===item.id} onClick={()=>void update(item,"REJECTED")}>بستن درخواست</button>
     </div>}
    </article>)}</div>}
  </AdminPanel>
 </div>;
}
