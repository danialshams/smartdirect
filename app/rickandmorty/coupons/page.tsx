"use client";

import { useEffect, useState } from "react";
import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { BadgePercent, Plus } from "lucide-react";

type Coupon={id:string;code:string;discountType:string;value:string;currency?:string|null;validFrom:string;expiresAt?:string|null;maxUses?:number|null;maxUsesPerUser:number;usageCount:number;isActive:boolean;createdAt:string};

export default function CouponsPage(){
 const [rows,setRows]=useState<Coupon[]>([]);const [loading,setLoading]=useState(true);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [api,holder]=message.useMessage();const [form]=Form.useForm();
 const load=async()=>{setLoading(true);try{const r=await fetch("/api/admin/coupons",{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.message);setRows(j.data);}catch(e){api.error(e instanceof Error?e.message:"خطا");}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const create=async(v:any)=>{setBusy(true);try{const r=await fetch("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...v,validFrom:v.validFrom?.toISOString(),expiresAt:v.expiresAt?.toISOString()})});const j=await r.json();if(!r.ok)throw new Error(j.message);api.success("کد تخفیف ایجاد شد");setOpen(false);form.resetFields();await load();}catch(e){api.error(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}};
 const toggle=async(c:Coupon)=>{const r=await fetch(`/api/admin/coupons/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:!c.isActive})});const j=await r.json();if(!r.ok){api.error(j.message);return;}setRows(x=>x.map(i=>i.id===c.id?j:i));};
 const columns:ColumnsType<Coupon>=[
  {title:"کد",dataIndex:"code",render:v=><span className="font-mono font-semibold tracking-wide">{v}</span>},
  {title:"تخفیف",key:"discount",render:(_,r)=>r.discountType==="PERCENTAGE"?r.value+"%":r.value+" "+(r.currency||"")},
  {title:"اعتبار",key:"valid",responsive:["sm"],render:(_,r)=>r.expiresAt?new Date(r.validFrom).toLocaleDateString("fa-IR")+" تا "+new Date(r.expiresAt).toLocaleDateString("fa-IR"):"از "+new Date(r.validFrom).toLocaleDateString("fa-IR")+" به بعد"},
  {title:"استفاده",key:"uses",responsive:["md"],render:(_,r)=>String(r.usageCount)+(r.maxUses?" / "+String(r.maxUses):"")},
  {title:"وضعیت",dataIndex:"isActive",render:v=><Tag color={v?"green":"default"}>{v?"فعال":"غیرفعال"}</Tag>},
  {title:"عملیات",key:"action",width:110,render:(_,r)=><Switch size="small" checked={r.isActive} onChange={()=>toggle(r)}/>},
 ];
 return <>{holder}<div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><Typography.Title level={3} className="!mb-1 !text-[22px]">کدهای تخفیف</Typography.Title><Typography.Text className="!text-[#64748B]">ساخت و مدیریت کدهای تخفیف با بازه اعتبار</Typography.Text></div><Button type="primary" icon={<Plus size={17}/>} onClick={()=>setOpen(true)}>کد جدید</Button></div>
 <Card className="!border-[#E2E8F0] !shadow-none"><Table rowKey="id" loading={loading} dataSource={rows} columns={columns} scroll={{x:650}} pagination={{pageSize:20,showSizeChanger:false}} locale={{emptyText:<div className="py-8"><BadgePercent className="mx-auto mb-2 text-[#94A3B8]"/><div>کد تخفیفی ثبت نشده است</div></div>}}/></Card>
 <Modal title="ایجاد کد تخفیف" open={open} onCancel={()=>setOpen(false)} footer={null} destroyOnHidden width={520}><Form form={form} layout="vertical" onFinish={create} initialValues={{discountType:"PERCENTAGE",maxUsesPerUser:1,validFrom:dayjs()}}><Form.Item name="code" label="کد تخفیف" rules={[{required:true,message:"کد را وارد کنید"}]}><Input placeholder="مثلاً SMART30" autoCapitalize="characters"/></Form.Item><div className="grid gap-3 sm:grid-cols-2"><Form.Item name="discountType" label="نوع تخفیف"><Select options={[{value:"PERCENTAGE",label:"درصدی"},{value:"FIXED",label:"مبلغ ثابت"}]}/></Form.Item><Form.Item name="value" label="مقدار" rules={[{required:true,message:"مقدار را وارد کنید"}]}><InputNumber min={0.01} className="!w-full"/></Form.Item></div><div className="grid gap-3 sm:grid-cols-2"><Form.Item name="validFrom" label="شروع اعتبار"><DatePicker showTime className="!w-full"/></Form.Item><Form.Item name="expiresAt" label="پایان اعتبار"><DatePicker showTime className="!w-full"/></Form.Item></div><div className="grid gap-3 sm:grid-cols-2"><Form.Item name="maxUses" label="حداکثر استفاده"><InputNumber min={1} className="!w-full"/></Form.Item><Form.Item name="maxUsesPerUser" label="حداکثر استفاده هر کاربر"><InputNumber min={1} className="!w-full"/></Form.Item></div><Form.Item name="currency" label="واحد پول (برای مبلغ ثابت)"><Input placeholder="IRR"/></Form.Item><Button type="primary" htmlType="submit" loading={busy} block>ایجاد کد تخفیف</Button></Form></Modal>
 </div></>;
}
