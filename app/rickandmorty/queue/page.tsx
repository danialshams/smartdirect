"use client";
import { useCallback,useEffect,useState } from "react";
import { AlertTriangle,RefreshCw,RotateCcw } from "lucide-react";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
import { AdminAlert,AdminButton,AdminHeading,AdminPanel,AdminSection,AdminSpinner } from "@/components/admin/AdminWidgets";

type FailedJob={id:string;jobId:string;type:string;status:string;attempts:number;maxAttempts:number;lastError:string;failedAt:string;requeuedJobId:string|null};
type Result={success:boolean;data:FailedJob[];health:{failed:number;active:number;ready:number;stalledTtlSeconds:number}};
export default function AdminQueuePage(){
 const [snapshot,setSnapshot]=useState<Result|null>(null),[loading,setLoading]=useState(true),[retrying,setRetrying]=useState<string|null>(null),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);
  try{const r=await fetch("/api/admin/queue/failed",{cache:"no-store"});const j=await r.json();
   if(!r.ok||!j.success)throw Error(j.message||"دریافت صف ناموفق بود");
   setSnapshot(j);setError("");
  }catch(e){setError(e instanceof Error?e.message:"خطای دریافت");}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const retry=async(id:string)=>{
  if(retrying)return;
  setRetrying(id);setSuccess("");setError("");
  try{const r=await fetch("/api/admin/queue/failed/"+encodeURIComponent(id)+"/retry",{method:"POST"});const j=await r.json();
   if(!r.ok||!j.success)throw Error(j.message||"تلاش مجدد ناموفق بود");
   setSuccess("کار برای پردازش مجدد ثبت شد.");await load();
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setRetrying(null);}
 };
 return <div>
  <AdminHeading title="صف و بازیابی پردازش" description="مدیریت کارهای ناموفق و وضعیت صف‌های پس‌زمینه">
   <AdminButton kind="secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/> بروزرسانی</AdminButton>
  </AdminHeading>
  {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
  {success&&<AdminAlert kind="success" onClose={()=>setSuccess("")}>{success}</AdminAlert>}
  <AdminMobileSections labels={["کارهای ناموفق","وضعیت صف"]}>
   <AdminSection title="کارهای ناموفق" description="هر کار را مستقل بررسی و در صورت لزوم بازیابی کنید">
    {loading&&!snapshot?<AdminSpinner/>:!snapshot?<AdminPanel><p className="adm-muted">اطلاعات صف در دسترس نیست.</p></AdminPanel>:snapshot.data.length?
     <div className="adm-ticket-list">{snapshot.data.map(job=><AdminPanel key={job.id}>
      <div className="adm-ticket-row-top"><strong>{job.type}</strong><span className="adm-state" data-state="URGENT">ناموفق</span></div>
      <p className="adm-help" dir="ltr" style={{overflowWrap:"anywhere"}}>{job.jobId}</p>
      <details className="adm-meta-original-details"><summary>مشاهده خطای پردازش</summary><p className="adm-help" style={{overflowWrap:"anywhere"}}>{job.lastError}</p></details>
      <div className="adm-ticket-row-top"><small className="adm-help">تلاش {job.attempts.toLocaleString("fa-IR")} از {job.maxAttempts.toLocaleString("fa-IR")} · {new Date(job.failedAt).toLocaleString("fa-IR")}</small>
      <AdminButton kind="secondary" disabled={!!retrying} onClick={()=>void retry(job.id)}><RotateCcw size={16}/>{retrying===job.id?"در حال ثبت…":"تلاش مجدد"}</AdminButton></div>
     </AdminPanel>)}</div>:
     <AdminPanel><div className="adm-empty"><AlertTriangle size={26}/><strong>کار ناموفقی ثبت نشده است</strong></div></AdminPanel>}
   </AdminSection>
   <AdminSection title="وضعیت صف" description="نمای خلاصه صف و زمان بازیابی">
    {snapshot?<div className="adm-grid">{[
     ["ناموفق",snapshot.health.failed],["فعال",snapshot.health.active],["آماده",snapshot.health.ready],["مهلت بازیابی (ثانیه)",snapshot.health.stalledTtlSeconds]
    ].map(([label,value])=><AdminPanel key={label}><div className="adm-stat"><div><small>{label}</small><strong>{Number(value).toLocaleString("fa-IR")}</strong></div></div></AdminPanel>)}</div>:<AdminSpinner/>}
   </AdminSection>
  </AdminMobileSections>
 </div>;
}
