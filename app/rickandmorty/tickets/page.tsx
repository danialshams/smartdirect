"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import { Send,Headset } from "lucide-react";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
import { AdminAlert,AdminHeading,AdminPanel,AdminSection,AdminSelect,AdminInput,AdminPagination,AdminSpinner,AdminStatus,formatDate } from "@/components/admin/AdminWidgets";
type Ticket={id:string;subject:string;status:string;priority:string;updatedAt:string;createdAt:string;user:{id:string;name:string;email:string};_count:{messages:number}};
export default function TicketsPage(){
 const [rows,setRows]=useState<Ticket[]>([]),[q,setQ]=useState(""),[query,setQuery]=useState(""),[status,setStatus]=useState(""),[userId,setUserId]=useState(""),[page,setPage]=useState(1),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{const p=new URLSearchParams(window.location.search);setUserId(p.get("userId")||"");},[]);
 useEffect(()=>{const t=setTimeout(()=>setQuery(q),250);return()=>clearTimeout(t);},[q]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);const p=new URLSearchParams({page:String(page),pageSize:"20"});if(query)p.set("q",query);if(status)p.set("status",status);if(userId)p.set("userId",userId);
 fetch("/api/admin/tickets?"+p,{cache:"no-store",signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message||"خطای دریافت");return j;}).then(j=>{setRows(j.data||[]);setTotal(j.total||0);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[query,status,userId,page]);
 return <div><AdminHeading title="تیکت‌های پشتیبانی" description="پیگیری و پاسخ سریع به درخواست‌های کاربران"><Link href="/rickandmorty/tickets/bulk" className="adm-btn adm-btn-primary"><Send size={16}/> ارسال گروهی تیکت</Link></AdminHeading>
 {error&&<AdminAlert>{error}</AdminAlert>}
 <AdminMobileSections labels={["صندوق تیکت‌ها","جست‌وجو و فیلتر"]}>
 <AdminSection title="صندوق تیکت‌ها" description="درخواست‌ها و وضعیت رسیدگی">
 {loading&&rows.length===0?<AdminSpinner/>:<div className="adm-ticket-list">{rows.map(t=><Link key={t.id} href={"/rickandmorty/tickets/"+t.id} className="adm-ticket-row"><div className="adm-ticket-row-top"><strong>{t.subject}</strong><AdminStatus status={t.status}/></div><div className="adm-btn-row"><span className="adm-help">{t.user.name} · {t.user.email}</span><AdminStatus status={t.priority}/></div><small>{formatDate(t.updatedAt)} · {t._count.messages.toLocaleString("fa-IR")} پیام</small></Link>)}</div>}
 {!loading&&!rows.length&&<AdminPanel><Headset size={23}/><p className="adm-muted">تیکتی یافت نشد.</p></AdminPanel>}
 <AdminPagination page={page} total={total} onChange={setPage}/></AdminSection>
 <AdminSection title="فیلتر تیکت‌ها" description="وضعیت و عبارت جست‌وجو"><AdminPanel><div className="adm-grid-2"><AdminInput aria-label="جستجوی تیکت" placeholder="عنوان، نام یا ایمیل کاربر" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/><AdminSelect label="وضعیت" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} options={[{value:"",label:"همه"},{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته"}]}/></div>{userId&&<div className="adm-btn-row" style={{marginTop:10}}><span className="adm-help">فیلتر تیکت‌های یک کاربر فعال است.</span><button className="adm-card-link" onClick={()=>setUserId("")}>حذف فیلتر</button></div>}</AdminPanel></AdminSection>
 </AdminMobileSections>
 </div>;
}
