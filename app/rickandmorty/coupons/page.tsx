"use client";
import {useEffect,useState} from "react";
import {BadgePercent,Plus} from "lucide-react";
import {AdminCardHeader,AdminInfoGrid,AdminInfo,AdminActionArea} from "@/components/admin/AdminDataView";
import {AdminAlert,AdminButton,AdminHeading,AdminInput,AdminModal,AdminPanel,AdminSection,AdminSelect,AdminSpinner,formatDate} from "@/components/admin/AdminWidgets";
type Coupon={id:string;code:string;discountType:string;value:string;currency:string|null;validFrom:string;expiresAt:string|null;maxUses:number|null;maxUsesPerUser:number;usageCount:number;isActive:boolean};
export default function Coupons(){
 const [rows,setRows]=useState<Coupon[]>([]),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [code,setCode]=useState(""),[kind,setKind]=useState("PERCENTAGE"),[value,setValue]=useState(""),[end,setEnd]=useState(""),[maxUses,setMaxUses]=useState(""),[maxUser,setMaxUser]=useState("1");
 const load=async()=>{const r=await fetch("/api/admin/coupons",{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.message||"خطای دریافت کدها");setRows(j.data||[]);};
 useEffect(()=>{let alive=true;load().catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[]);
 const create=async()=>{
  setBusy(true);setError("");try{const r=await fetch("/api/admin/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,discountType:kind,value:Number(value),currency:"IRR",expiresAt:end||null,maxUses:maxUses?Number(maxUses):null,maxUsesPerUser:Number(maxUser)||1})});const j=await r.json();if(!r.ok)throw Error(j.message||"خطای ثبت");setOpen(false);setCode("");setValue("");setEnd("");setNotice("کد تخفیف ساخته شد");await load();}catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
 };
 const toggle=async(c:Coupon)=>{try{const r=await fetch("/api/admin/coupons/"+c.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:!c.isActive})});const j=await r.json();if(!r.ok)throw Error(j.message);setRows(x=>x.map(i=>i.id===c.id?j:i));}catch(e){setError(e instanceof Error?e.message:"خطا");}};
 return <div><AdminHeading title="کدهای تخفیف" description="مدیریت کدهای تخفیف اشتراک‌ها"><AdminButton onClick={()=>setOpen(true)}><Plus size={16}/> کد جدید</AdminButton></AdminHeading>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}{notice&&<AdminAlert kind="success" onClose={()=>setNotice("")}>{notice}</AdminAlert>}
 <AdminSection title="کدهای ثبت‌شده" description="هر کد به‌صورت مستقل فعال یا غیرفعال می‌شود">{loading?<AdminSpinner/>:<div className="adm-user-grid adm-coupon-grid">{rows.map(c=><AdminPanel key={c.id} className="adm-coupon-card">
 <AdminCardHeader title={c.code} aside={<span className="adm-state" data-state={c.isActive?"ACTIVE":"SUSPENDED"}>{c.isActive?"فعال":"غیرفعال"}</span>}/>
 <div className="adm-coupon-value">{c.discountType==="PERCENTAGE"?c.value+"٪":Number(c.value).toLocaleString("fa-IR")+" ریال"}</div>
 <AdminInfoGrid><AdminInfo label="استفاده‌شده">{c.usageCount.toLocaleString("fa-IR")}</AdminInfo><AdminInfo label="سقف استفاده">{c.maxUses?c.maxUses.toLocaleString("fa-IR"):"نامحدود"}</AdminInfo><AdminInfo label="سقف هر کاربر">{c.maxUsesPerUser.toLocaleString("fa-IR")}</AdminInfo><AdminInfo label="اعتبار تا">{formatDate(c.expiresAt)}</AdminInfo></AdminInfoGrid>
 <div className="adm-card-actions"><AdminButton kind="secondary" onClick={()=>void toggle(c)}>{c.isActive?"غیرفعال‌کردن":"فعال‌کردن"}</AdminButton></div>
 </AdminPanel>)}</div>}
 {!loading&&!rows.length&&<AdminPanel><BadgePercent/><p className="adm-muted">کدی وجود ندارد.</p></AdminPanel>}
 </AdminSection>
 {open&&<AdminModal title="ایجاد کد تخفیف" onClose={()=>!busy&&setOpen(false)} actions={<><AdminButton kind="secondary" onClick={()=>setOpen(false)}>انصراف</AdminButton><AdminButton disabled={busy||!code||!value} onClick={()=>void create()}>{busy?"در حال ایجاد…":"ثبت کد"}</AdminButton></>}>
 <AdminInput label="کد" value={code} onChange={e=>setCode(e.target.value)}/>
 <AdminSelect label="نوع تخفیف" value={kind} onChange={e=>setKind(e.target.value)} options={[{value:"PERCENTAGE",label:"درصدی"},{value:"FIXED",label:"مبلغ ثابت (ریال)"}]}/>
 <div className="adm-coupon-form-grid"><AdminInput label="مقدار" type="number" min={1} value={value} onChange={e=>setValue(e.target.value)}/>
 <AdminInput label="حداکثر استفاده کل" type="number" min={1} value={maxUses} onChange={e=>setMaxUses(e.target.value)}/>
 <AdminInput label="حداکثر استفاده هر کاربر" type="number" min={1} value={maxUser} onChange={e=>setMaxUser(e.target.value)}/>
 <AdminInput label="تاریخ پایان (اختیاری)" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div>
 </AdminModal>}
 </div>;
}
