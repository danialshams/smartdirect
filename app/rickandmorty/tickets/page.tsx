"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Input, Select, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Search, Ticket } from "lucide-react";

type Row={id:string;subject:string;status:string;priority:string;createdAt:string;updatedAt:string;user:{name:string;email:string};_count:{messages:number}};
const statusLabels:Record<string,string>={OPEN:"باز",IN_PROGRESS:"در حال بررسی",WAITING_USER:"منتظر کاربر",RESOLVED:"حل‌شده",CLOSED:"بسته"};
const priorityLabels:Record<string,string>={LOW:"کم",NORMAL:"عادی",HIGH:"زیاد",URGENT:"فوری"};

export default function TicketsPage(){
 const router=useRouter();const [rows,setRows]=useState<Row[]>([]);const [loading,setLoading]=useState(true);const [q,setQ]=useState("");const [status,setStatus]=useState("");
 const load=async()=>{setLoading(true);try{const r=await fetch(\`/api/admin/tickets?q=\${encodeURIComponent(q)}&status=\${status}\`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);}finally{setLoading(false);}};
 useEffect(()=>{load().catch(()=>{});},[q,status]);
 const columns:ColumnsType<Row>=[
  {title:"تیکت",key:"ticket",render:(_,r)=><div className="min-w-0"><div className="truncate font-medium">{r.subject}</div><div className="truncate text-xs text-[#64748B]">{r.user.name} · {r.user.email}</div></div>},
  {title:"وضعیت",dataIndex:"status",width:145,render:v=><Tag color={v==="OPEN"?"blue":v==="WAITING_USER"?"orange":v==="CLOSED"?"default":"green"}>{statusLabels[v]||v}</Tag>},
  {title:"اولویت",dataIndex:"priority",width:100,render:v=><Tag color={v==="URGENT"||v==="HIGH"?"red":"default"}>{priorityLabels[v]||v}</Tag>},
  {title:"پیام",key:"messages",width:80,responsive:["sm"],render:(_,r)=>r._count.messages},
  {title:"آخرین تغییر",dataIndex:"updatedAt",width:145,responsive:["md"],render:v=>new Date(v).toLocaleDateString("fa-IR")},
 ];
 return <div className="space-y-5"><div><Typography.Title level={3} className="!mb-1 !text-[22px]">تیکت‌ها</Typography.Title><Typography.Text className="!text-[#64748B]">مدیریت و پاسخ‌گویی به درخواست‌های کاربران</Typography.Text></div>
 <Card className="!border-[#E2E8F0] !shadow-none"><div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]"><Input prefix={<Search size={17}/>} allowClear placeholder="جستجو در عنوان یا کاربر..." value={q} onChange={e=>setQ(e.target.value)}/><Select value={status} onChange={setStatus} options={[{value:"",label:"همه وضعیت‌ها"},...Object.entries(statusLabels).map(([value,label])=>({value,label}))]}/></div><Table rowKey="id" loading={loading} dataSource={rows} columns={columns} scroll={{x:560}} onRow={r=>({onClick:()=>router.push(\`/rickandmorty/tickets/\${r.id}\`),style:{cursor:"pointer"}})} pagination={{pageSize:20,showSizeChanger:false}} locale={{emptyText:<div className="py-8"><Ticket className="mx-auto mb-2 text-[#94A3B8]"/><div>تیکتی پیدا نشد</div></div>}}/></Card></div>;
}
