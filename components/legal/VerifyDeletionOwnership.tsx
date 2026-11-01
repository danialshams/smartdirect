"use client";
import {useState} from "react";
import Link from "next/link";
import {useSession} from "next-auth/react";
export function VerifyDeletionOwnership(){
 const {status}=useSession();
 const [reference,setReference]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 return <section>
  <h2>تأیید مالکیت درخواست حذف</h2>
  {status!=="authenticated"?<p>پس از ثبت درخواست، برای تأیید مالکیت با حساب دایرا وارد شوید. بدون این تأیید، حساب حذف نمی‌شود. <Link href="/login">ورود به حساب</Link></p>:
  <form className="da-delete-form" onSubmit={async e=>{e.preventDefault();setError("");setMessage("");setBusy(true);
   try{const r=await fetch("/api/account/data-deletion/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference,password})});const data=await r.json();if(!r.ok)throw Error(data.message||"خطا در تأیید");setMessage(data.message);setPassword("");}catch(x){setError(x instanceof Error?x.message:"خطا در تأیید");}finally{setBusy(false);}}}>
   <label>کد پیگیری درخواست<input required value={reference} onChange={e=>setReference(e.target.value)} dir="ltr" maxLength={48}/></label>
   <label>رمز عبور حساب دایرا<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <button disabled={busy||!reference||!password}>{busy?"در حال بررسی...":"تأیید مالکیت و ارسال برای حذف"}</button>
   {message&&<p role="status">{message}</p>}
   {error&&<p role="alert" style={{color:"#ad3650"}}>{error}</p>}
  </form>}
 </section>;
}
