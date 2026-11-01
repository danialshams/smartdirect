"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
type State="setup"|"verify"|"ok";
export default function AdminMfaGate({initialState}:{initialState:State}){
 const router=useRouter();
 const [step,setStep]=useState<State>(initialState),[password,setPassword]=useState(""),[secret,setSecret]=useState(""),[code,setCode]=useState(""),[recovery,setRecovery]=useState<string[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [started,setStarted]=useState(false);
 async function act(action:"begin"|"activate"|"verify"){
  if(busy)return;setBusy(true);setError("");
  try{
   const response=await fetch("/api/admin/mfa",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({action,password,code})});
   const data=await response.json();
   if(!response.ok)throw Error(data.message||"عملیات انجام نشد.");
   if(action==="begin"){setSecret(data.secret);setStarted(true);setPassword("");setCode("");}
   if(action==="activate"){setRecovery(data.recoveryCodes||[]);setStep("ok");}
   if(action==="verify"){router.refresh();window.location.href="/rickandmorty";}
  }catch(e){setError(e instanceof Error?e.message:"خطا در ارتباط");}
  finally{setBusy(false);}
 }
 return <div dir="rtl" style={{minHeight:"100svh",display:"grid",placeItems:"center",background:"#f6f9fc",padding:20,color:"#1e324d"}}>
 <main style={{maxWidth:480,width:"100%",padding:28,background:"#fff",border:"1px solid #e2eaf5",borderRadius:20,display:"grid",gap:15,boxShadow:"0 14px 40px #12345609"}}>
  <h1 style={{fontSize:23,margin:0}}>امنیت پنل مدیریت دایرا</h1>
  {step==="setup"&&!started&&<><p style={{lineHeight:2,margin:0}}>برای فعال‌سازی اجباری ورود دومرحله‌ای، رمز عبور حسابت را وارد کن.</p>
    <input autoComplete="current-password" type="password" placeholder="رمز عبور" value={password} onChange={e=>setPassword(e.target.value)} style={{padding:13,border:"1px solid #ccd9e8",borderRadius:10,fontSize:16}}/>
    <button disabled={busy||!password} onClick={()=>void act("begin")} style={{padding:13,background:"#326ce8",color:"white",border:0,borderRadius:10}}>شروع فعال‌سازی</button></>}
  {step==="setup"&&started&&<><p style={{lineHeight:2,margin:0}}>در Google Authenticator یا هر برنامه TOTP، حساب جدید را با کلید زیر وارد کن و کد ۶ رقمی را بنویس.</p>
   <code dir="ltr" style={{textAlign:"center",overflowWrap:"anywhere",padding:14,borderRadius:10,background:"#f1f5fb",fontSize:16}}>{secret}</code>
   <input inputMode="numeric" autoComplete="one-time-code" placeholder="کد برنامه احراز هویت" value={code} maxLength={6} onChange={e=>setCode(e.target.value)} style={{padding:13,border:"1px solid #ccd9e8",borderRadius:10,fontSize:16}}/>
   <button disabled={busy||code.length!==6} onClick={()=>void act("activate")} style={{padding:13,background:"#326ce8",color:"white",border:0,borderRadius:10}}>تأیید و فعال‌سازی</button></>}
  {step==="verify"&&<><p style={{lineHeight:2,margin:0}}>برای ورود به پنل مدیریت، کد برنامه احراز هویت یا یکی از کدهای بازیابی را وارد کن.</p>
   <input autoComplete="one-time-code" placeholder="کد دومرحله‌ای یا بازیابی" value={code} onChange={e=>setCode(e.target.value)} style={{padding:13,border:"1px solid #ccd9e8",borderRadius:10,fontSize:16}}/>
   <button disabled={busy||code.length<6} onClick={()=>void act("verify")} style={{padding:13,background:"#326ce8",color:"white",border:0,borderRadius:10}}>ورود امن به مدیریت</button></>}
  {step==="ok"&&<><p style={{margin:0,lineHeight:2}}>تأیید دومرحله‌ای فعال شد. این کدهای بازیابی فقط همین یک‌بار نمایش داده می‌شوند. آن‌ها را در محل امن، خارج از دایرا نگهداری کن.</p>
   <div dir="ltr" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{recovery.map(x=><code key={x} style={{background:"#f1f5fb",padding:10,textAlign:"center",borderRadius:8}}>{x}</code>)}</div>
   <button onClick={()=>navigator.clipboard?.writeText(recovery.join("\n"))} style={{padding:13,border:"1px solid #dce5f4",background:"#fff",borderRadius:10}}>کپی کدهای بازیابی</button>
   <button onClick={()=>{window.location.href="/rickandmorty";}} style={{padding:13,background:"#326ce8",color:"white",border:0,borderRadius:10}}>ورود به مدیریت</button></>}
  {error&&<p role="alert" style={{color:"#a33d45",margin:0}}>{error}</p>}
  <Link href="/dashboard" style={{color:"#4874cf",fontSize:13,textAlign:"center"}}>بازگشت به داشبورد</Link>
 </main></div>;
}
