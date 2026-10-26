"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowRight,Send,Headset} from "lucide-react";
import {AdminAlert,AdminButton,AdminHeading,AdminPanel,AdminSelect,AdminSpinner,AdminStatus,AdminTextarea,formatDate} from "@/components/admin/AdminWidgets";
type Message={id:string;body:string;createdAt:string;senderUserId:string;sender:{name:string;role:string};attachments:{id:string;fileName:string;mimeType:string}[]};
type Ticket={id:string;subject:string;status:string;priority:string;createdAt:string;user:{id:string;name:string;email:string};messages:Message[]};
export default function TicketDetail(){
 const {id}=useParams<{id:string}>();
 const [ticket,setTicket]=useState<Ticket|null>(null),[body,setBody]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const bottom=useRef<HTMLDivElement|null>(null);
 const load=useCallback(async()=>{const r=await fetch("/api/admin/tickets/"+id,{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.message||"خطا در دریافت تیکت");setTicket(j);},[id]);
 useEffect(()=>{let active=true;setLoading(true);load().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[load]);
 useEffect(()=>{if(!ticket)return;void fetch("/api/admin/tickets/"+id+"/read",{method:"POST"}).then(()=>window.dispatchEvent(new Event("admin:tickets-updated"))).catch(()=>{});},[id,ticket?.messages.length]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest"});},[ticket?.messages.length]);
 const patch=async(field:"status"|"priority",value:string)=>{
   setBusy(true);try{const r=await fetch("/api/admin/tickets/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({[field]:value})});const j=await r.json();if(!r.ok)throw Error(j.message||"خطای ویرایش");await load();setNotice("تغییرات ذخیره شد.");}catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 const send=async()=>{
  if(!body.trim()||busy)return;setBusy(true);setError("");
  try{const r=await fetch("/api/admin/tickets/"+id+"/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body:body.trim()})});const j=await r.json();if(!r.ok)throw Error(j.message||"خطا در ارسال");setBody("");await load();setNotice("پاسخ ارسال شد.");}catch(e){setError(e instanceof Error?e.message:"خطا در ارسال");}finally{setBusy(false);}
 };
 if(loading)return <AdminSpinner/>;
 if(!ticket)return <AdminAlert>{error||"تیکت پیدا نشد"}</AdminAlert>;
 return <div><AdminHeading title={ticket.subject} description={ticket.user.name+" · "+ticket.user.email}><Link href="/rickandmorty/tickets" className="adm-btn adm-btn-secondary"><ArrowRight size={16}/> بازگشت</Link></AdminHeading>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}{notice&&<AdminAlert kind="success" onClose={()=>setNotice("")}>{notice}</AdminAlert>}
 <AdminPanel><div className="adm-grid-2"><AdminSelect label="وضعیت تیکت" disabled={busy} value={ticket.status} onChange={e=>void patch("status",e.target.value)} options={[{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر پاسخ کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته‌شده"}]}/><AdminSelect label="اولویت" disabled={busy} value={ticket.priority} onChange={e=>void patch("priority",e.target.value)} options={[{value:"LOW",label:"کم"},{value:"NORMAL",label:"عادی"},{value:"HIGH",label:"زیاد"},{value:"URGENT",label:"فوری"}]}/></div><div style={{marginTop:10}}><Link className="adm-card-link" href={"/rickandmorty/users/"+ticket.user.id}>مشاهده و مدیریت کاربر</Link></div></AdminPanel>
 <AdminPanel><h2><Headset size={18} style={{display:"inline",marginLeft:8}}/>گفت‌وگوی پشتیبانی</h2>
  <div className="adm-chat">{ticket.messages.map(m=><div key={m.id} className={"adm-bubble "+(m.sender.role==="ADMIN"?"mine":"")}><small>{m.sender.role==="ADMIN"?"پشتیبانی":m.sender.name} · {formatDate(m.createdAt)}</small><div style={{whiteSpace:"pre-wrap"}}>{m.body}</div>{m.attachments?.map(a=><a key={a.id} target="_blank" rel="noopener noreferrer" href={"/api/dashboard/tickets/attachments/"+a.id}>{a.mimeType.startsWith("image/")?<img src={"/api/dashboard/tickets/attachments/"+a.id} alt={a.fileName}/>:a.fileName}</a>)}</div>)}<div ref={bottom}/></div>
  <AdminTextarea label="پاسخ مدیر" value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} placeholder="پیام را بنویسید…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}}/>
  <div className="adm-btn-row" style={{justifyContent:"flex-end",marginTop:10}}><AdminButton disabled={!body.trim()||busy} onClick={()=>void send()}><Send size={17}/>{busy?"در حال ارسال…":"ارسال پاسخ"}</AdminButton></div>
 </AdminPanel>
 </div>;
}
