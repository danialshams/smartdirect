"use client";
import { useEffect,useState } from "react";
import {AdminAlert,AdminHeading,AdminPanel,AdminPagination,AdminSection,AdminSpinner,formatDate} from "@/components/admin/AdminWidgets";
type Entry={id:string;action:string;targetType:string;targetId:string;metadata:unknown;createdAt:string;actor:{name:string;email:string}|null};
export default function AuditPage(){
 const [rows,setRows]=useState<Entry[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const c=new AbortController();setLoading(true);fetch("/api/admin/audit?page="+page,{signal:c.signal,cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);return j;}).then(j=>{setRows(j.data||[]);setTotal(j.total||0);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[page]);
 return <div><AdminHeading title="تاریخچه عملیات مدیر" description="ثبت قابل پیگیری تغییرات حساب‌ها، اشتراک‌ها، تیکت‌ها و ارسال‌های گروهی"/>
 {error&&<AdminAlert>{error}</AdminAlert>}<AdminSection title="رویدادهای ثبت‌شده" description="چه کسی، چه تغییری را و چه زمانی انجام داده است">{loading&&rows.length===0?<AdminSpinner/>:<div className="adm-ticket-list">{rows.map(x=><AdminPanel key={x.id}><div className="adm-ticket-row-top"><strong dir="ltr">{x.action}</strong><small className="adm-muted">{formatDate(x.createdAt)}</small></div><p className="adm-help">{x.actor?.name||x.actor?.email||"سیستم"} · {x.targetType} · <span dir="ltr">{x.targetId}</span></p><details><summary className="adm-card-link" style={{cursor:"pointer"}}>جزئیات</summary><pre style={{fontSize:11,whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:10}}>{JSON.stringify(x.metadata??{},null,2)}</pre></details></AdminPanel>)}</div>}
 {!loading&&!rows.length&&<AdminPanel><p className="adm-muted">عملیاتی ثبت نشده است.</p></AdminPanel>}
 <AdminPagination page={page} total={total} pageSize={30} onChange={setPage}/></AdminSection></div>;
}
