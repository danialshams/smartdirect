"use client";
import { useState, type FormEvent } from "react";

const statuses:Record<string,string>={
 PENDING:"درخواست ثبت شده و در انتظار بررسی است.",
 VERIFYING:"در حال بررسی و احراز هویت درخواست‌کننده است.",
 COMPLETED:"بررسی درخواست با وضعیت تکمیل‌شده ثبت شده است.",
 REJECTED:"درخواست بسته شده است؛ برای توضیح از پشتیبانی استفاده کنید."
};
export function DataDeletionRequestForm(){
 const [contact,setContact]=useState("");
 const [instagramName,setInstagramName]=useState("");
 const [details,setDetails]=useState("");
 const [website,setWebsite]=useState("");
 const [reference,setReference]=useState("");
 const [lookup,setLookup]=useState("");
 const [lookupStatus,setLookupStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/data-deletion/request",{method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",cache:"no-store",body:JSON.stringify({contact,instagramName,details,website})});
   const data=await response.json();
   if(!response.ok||!data.reference)throw new Error(data.message||"ثبت درخواست ناموفق بود.");
   setReference(data.reference);
   setLookup(data.reference);
  }catch(e){setError(e instanceof Error?e.message:"خطا در ثبت درخواست.");}
  finally{setBusy(false);}
 }
 async function check(){
  if(busy||!lookup.trim())return;
  setBusy(true);setError("");setLookupStatus("");
  try{
   const res=await fetch("/api/data-deletion/request?reference="+encodeURIComponent(lookup.trim()),{cache:"no-store"});
   const data=await res.json();if(!res.ok)throw new Error(data.message||"اطلاعات موجود نیست.");
   setLookupStatus(statuses[data.status]||"وضعیت نامشخص است.");
  }catch(e){setError(e instanceof Error?e.message:"بررسی ناموفق بود.");}
  finally{setBusy(false);}
 }
 return <div className="da-delete-form">
  {reference?<div role="status" className="da-delete-result">درخواست شما ثبت شد. کد پیگیری را نزد خود نگه دارید: <strong dir="ltr">{reference}</strong>. این ثبت به معنی حذف فوری اطلاعات نیست؛ ابتدا هویت و مالکیت حساب بررسی می‌شود.</div>:
  <form onSubmit={send} className="da-delete-form" style={{padding:0,border:0,margin:0}}>
   <label>ایمیل یا شماره تماس مرتبط با حساب
    <input required minLength={8} maxLength={190} autoComplete="email" value={contact} onChange={e=>setContact(e.target.value)} placeholder="ایمیل یا شماره موبایل" />
   </label>
   <label>نام کاربری اینستاگرام (اختیاری)
    <input maxLength={30} dir="ltr" value={instagramName} onChange={e=>setInstagramName(e.target.value)} placeholder="username"/>
   </label>
   <label>توضیحات یا شناسه حساب دایرا (اختیاری)
    <textarea rows={3} maxLength={600} value={details} onChange={e=>setDetails(e.target.value)} placeholder="چه اطلاعاتی را می‌خواهید حذف کنید؟"/>
   </label>
   <div style={{position:"absolute",left:"-9999px",width:"1px",height:"1px",overflow:"hidden"}} aria-hidden="true"><label>وب‌سایت<input tabIndex={-1} autoComplete="off" value={website} onChange={e=>setWebsite(e.target.value)}/></label></div>
   <button type="submit" disabled={busy}>{busy?"در حال ثبت...":"ثبت درخواست حذف اطلاعات"}</button>
  </form>}
  <label>پیگیری درخواست با کد
   <div className="da-delete-form__status"><input value={lookup} onChange={e=>setLookup(e.target.value)} dir="ltr" placeholder="کد پیگیری" maxLength={50}/><button type="button" onClick={()=>void check()} disabled={busy||!lookup.trim()}>بررسی وضعیت</button></div>
  </label>
  {lookupStatus&&<div className="da-delete-result" role="status">{lookupStatus}</div>}
  {error&&<div className="da-delete-result da-delete-result--error" role="alert">{error}</div>}
 </div>;
}
