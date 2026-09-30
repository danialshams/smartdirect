"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Select, Skeleton, Tag, Typography, message } from "antd";
import { ArrowRight, Send } from "lucide-react";

type TicketData={id:string;subject:string;status:string;priority:string;createdAt:string;user:{name:string;email:string};messages:{id:string;body:string;createdAt:string;senderUserId:string;sender:{name:string;role:string}}[]};
const statuses=[{value:"OPEN",label:"باز"},{value:"IN_PROGRESS",label:"در حال بررسی"},{value:"WAITING_USER",label:"منتظر کاربر"},{value:"RESOLVED",label:"حل‌شده"},{value:"CLOSED",label:"بسته"}];
const priorities=[{value:"LOW",label:"کم"},{value:"NORMAL",label:"عادی"},{value:"HIGH",label:"زیاد"},{value:"URGENT",label:"فوری"}];

export default function TicketDetailPage(){
 const {id}=useParams<{id:string}>();const router=useRouter();const [ticket,setTicket]=useState<TicketData|null>(null);const [loading,setLoading]=useState(true);const [body,setBody]=useState("");const [busy,setBusy]=useState(false);const [api,holder]=message.useMessage();
 const load=async()=>{setLoading(true);try{const r=await fetch(`/api/admin/tickets/${id}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setTicket(j);}catch(e){api.error(e instanceof Error?e.message:"خطا");}finally{setLoading(false);}};
 useEffect(()=>{if(id)load();},[id]);
 const patch=async(data:Record<string,unknown>)=>{const r=await fetch(`/api/admin/tickets/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.message);setTicket(t=>t?{...t,...j}:t);api.success("ذخیره شد");};
 const send=async()=>{if(!body.trim())return;setBusy(true);try{const r=await fetch(`/api/admin/tickets/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body})});const j=await r.json();if(!r.ok)throw new Error(j.message);setBody("");await load();api.success("پاسخ ارسال شد");}catch(e){api.error(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}};
 if(loading)return <div className="space-y-4"><Skeleton active/><Skeleton active paragraph={{rows:6}}/></div>;
 if(!ticket)return <Alert type="error" message="تیکت پیدا نشد"/>;
 return <>{holder}<div className="space-y-5"><div className="flex items-center gap-2"><Button type="text" icon={<ArrowRight size={18}/>} onClick={()=>router.push("/rickandmorty/tickets")}>بازگشت</Button><div><Typography.Title level={3} className="!mb-1 !text-[22px]">{ticket.subject}</Typography.Title><Typography.Text className="!text-[#64748B]">{ticket.user.name} · {ticket.user.email}</Typography.Text></div></div>
 <Card className="!border-[#E2E8F0] !shadow-none"><div className="grid gap-3 sm:grid-cols-2"><div><Typography.Text type="secondary">وضعیت</Typography.Text><Select className="mt-1 !w-full" value={ticket.status} options={statuses} onChange={v=>patch({status:v}).catch(e=>api.error(e.message))}/></div><div><Typography.Text type="secondary">اولویت</Typography.Text><Select className="mt-1 !w-full" value={ticket.priority} options={priorities} onChange={v=>patch({priority:v}).catch(e=>api.error(e.message))}/></div></div></Card>
 <Card title="گفتگو" className="!border-[#E2E8F0] !shadow-none"><div className="max-h-[55vh] space-y-3 overflow-y-auto pb-4">{ticket.messages.map(m=><div key={m.id} className={`rounded-2xl border p-4 ${m.sender.role==="ADMIN"?"border-[#BFDBFE] bg-[#EFF6FF]":"border-[#E2E8F0] bg-[#F8FAFC]"}`}><div className="mb-1 flex items-center justify-between gap-2"><span className="text-xs font-semibold">{m.sender.name}</span><span className="text-[10px] text-[#64748B]">{new Date(m.createdAt).toLocaleString("fa-IR")}</span></div><div className="whitespace-pre-wrap text-sm leading-7">{m.body}</div></div>)}</div><div className="border-t border-[#E2E8F0] pt-4"><Input.TextArea value={body} onChange={e=>setBody(e.target.value)} placeholder="پاسخ خود را بنویسید..." autoSize={{minRows:3,maxRows:7}}/><div className="mt-3 flex justify-end"><Button type="primary" icon={<Send size={16}/>} loading={busy} onClick={send}>ارسال پاسخ</Button></div></div></Card>
 </div></>;
}
