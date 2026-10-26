"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Activity,Database,HardDrive,RefreshCw,Server} from "lucide-react";
import {AdminAlert,AdminButton,AdminHeading,AdminPanel,AdminSection,AdminSpinner} from "@/components/admin/AdminWidgets";
type Check={status?:string;latencyMs?:number;error?:string};
type Snapshot={status:string;checkedAt:string;system?:{database?:Check;redis?:Check};queue?:{status?:string;ready?:number;active?:number;delayed?:number;failed?:number;total?:number};worker?:{status?:string;count?:number};instagramApi?:Check;webhook?:Check;automation?:Check;publishing?:Check};
export default function Monitoring(){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);setError("");try{const r=await fetch("/api/admin/monitoring",{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.message);setData(j.data);}catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const checks=(data?[["پایگاه‌داده",data.system?.database,Database],["Redis",data.system?.redis,HardDrive],["صف‌ها",data.queue,Activity],["پردازشگرها",data.worker,Server],["API اینستاگرام",data.instagramApi,Activity],["وب‌هوک",data.webhook,Activity],["اتوماسیون",data.automation,Activity],["انتشار محتوا",data.publishing,Activity]]:[]) as [string,Check|undefined,typeof Activity][];
 return <div><AdminHeading title="سلامت سیستم" description="وضعیت زیرساخت، وب‌هوک، صف، اتوماسیون و انتشار"><AdminButton kind="secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/> بروزرسانی</AdminButton></AdminHeading>
 {error&&<AdminAlert>{error}</AdminAlert>}{loading&&!data?<AdminSpinner/>:data&&<><AdminAlert kind={data.status==="healthy"?"success":data.status==="degraded"?"warning":"error"}>وضعیت کلی: {data.status} · آخرین بررسی: {new Date(data.checkedAt).toLocaleString("fa-IR")}</AdminAlert><AdminSection title="سرویس‌های اصلی" description="پایش وضعیت اتصال و پردازش"><div className="adm-grid">{checks.map(([label,item,Icon])=><AdminPanel key={label}><div className="adm-stat"><div><small>{label}</small><strong style={{fontSize:16}}>{item?.status||"نامشخص"}</strong>{typeof item?.latencyMs==="number"&&<small>{item.latencyMs} ms</small>}</div><Icon size={25}/></div>{item?.error&&<p className="adm-help">{item.error}</p>}</AdminPanel>)}</div></AdminSection><AdminSection title="صف پردازش" description="وضعیت کارهای در انتظار و کارهای ناموفق"><AdminPanel><h2>جزئیات صف</h2><p className="adm-help">آماده: {data.queue?.ready||0} · فعال: {data.queue?.active||0} · با تأخیر: {data.queue?.delayed||0} · ناموفق: {data.queue?.failed||0}</p><Link href="/dashboard/admin/queue" className="adm-btn adm-btn-secondary">جزئیات و بازیابی Jobها</Link></AdminPanel></AdminSection></>}
 </div>;
}
