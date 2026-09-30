"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Card, Input, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Search, Users } from "lucide-react";

type UserRow = { id:string; name:string; email:string; role:string; pagesCount:number; createdAt:string; subscription?: { planKey:string; effectiveStatus:string; expiresAt:string } | null };

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows,setRows]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [q,setQ]=useState("");
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);

  const load=async()=>{setLoading(true);try{const r=await fetch(\`/api/admin/users?q=\${encodeURIComponent(q)}&page=\${page}&pageSize=20\`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);setTotal(j.total);}finally{setLoading(false);}};
  useEffect(()=>{load().catch(()=>{});},[q,page]);

  const columns:ColumnsType<UserRow>=[
    {title:"کاربر",key:"user",render:(_,r)=><div className="flex items-center gap-3"><Avatar className="!bg-[#EFF6FF] !text-[#2563EB]">{r.name?.[0]||"U"}</Avatar><div className="min-w-0"><div className="truncate font-medium text-[#0F172A]">{r.name}</div><div className="truncate text-xs text-[#64748B]">{r.email}</div></div></div>},
    {title:"پیج‌های متصل",dataIndex:"pagesCount",width:130,responsive:["sm"]},
    {title:"اشتراک",key:"subscription",width:150,render:(_,r)=>r.subscription?<Tag color={r.subscription.effectiveStatus==="ACTIVE"?"green":"red"}>{r.subscription.effectiveStatus==="ACTIVE"?"فعال":"منقضی"}</Tag>:<Tag>بدون اشتراک</Tag>},
    {title:"انقضا",key:"expiresAt",width:150,responsive:["md"],render:(_,r)=>r.subscription?new Date(r.subscription.expiresAt).toLocaleDateString("fa-IR"):"—"},
    {title:"نقش",dataIndex:"role",width:100,responsive:["lg"],render:v=><Tag color={v==="ADMIN"?"blue":"default"}>{v==="ADMIN"?"مدیر":"کاربر"}</Tag>},
  ];

  return <div className="space-y-5">
    <div><Typography.Title level={3} className="!mb-1 !text-[22px]">کاربران</Typography.Title><Typography.Text className="!text-[#64748B]">اطلاعات کاربران، پیج‌های متصل و اشتراک</Typography.Text></div>
    <Card className="!border-[#E2E8F0] !shadow-none">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><Input allowClear prefix={<Search size={17}/>} placeholder="جستجو بر اساس نام یا ایمیل..." value={q} onChange={e=>{setPage(1);setQ(e.target.value)}} className="sm:max-w-md"/></div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} scroll={{x:560}} onRow={r=>({onClick:()=>router.push(\`/rickandmorty/users/\${r.id}\`),style:{cursor:"pointer"}})} pagination={{current:page,total,pageSize:20,showSizeChanger:false,onChange:setPage,showTotal:t=>\`\${t} کاربر\`}} locale={{emptyText:<div className="py-8"><Users className="mx-auto mb-2 text-[#94A3B8]"/><div>کاربری پیدا نشد</div></div>}}/>
    </Card>
  </div>;
}
