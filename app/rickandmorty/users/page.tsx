"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import Link from "next/link";
import { Download,ShieldBan,Users, WandSparkles } from "lucide-react";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
import { AdminAlert,AdminButton,AdminFilters,AdminHeading,AdminInput,AdminModal,AdminPagination,AdminPanel,AdminSection,AdminSelect,AdminSpinner,AdminUserCard,blankFilters,paramsFromFilters,planOptions,sendAdminBulkChunks,type Filters,type UserRow } from "@/components/admin/AdminWidgets";
type Action="subscription-adjust"|"subscription-change-plan"|"subscription-suspend"|"subscription-activate"|"access-block"|"access-unblock";
type Result={processed:number;succeeded:number;failed:number;results:{userId:string;success:boolean;message?:string}[]};
export default function UsersPage(){
 const [filters,setFilters]=useState<Filters>(blankFilters);
 const [query,setQuery]=useState(""),[page,setPage]=useState(1),[rows,setRows]=useState<UserRow[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(""),[result,setResult]=useState<Result|null>(null);
 const [selected,setSelected]=useState<string[]>([]),[all,setAll]=useState(false),[excluded,setExcluded]=useState<string[]>([]);
 const [modal,setModal]=useState(false),[action,setAction]=useState<Action>("subscription-adjust"),[days,setDays]=useState("7"),[plan,setPlan]=useState("monthly"),[reason,setReason]=useState(""),[busy,setBusy]=useState(false);
 const [refresh,setRefresh]=useState(0),[progress,setProgress]=useState("");
 useEffect(()=>{const timer=setTimeout(()=>setQuery(filters.q),320);return()=>clearTimeout(timer);},[filters.q]);
 const effective=useMemo(()=>({...filters,q:query}),[filters,query]);
 const filterKey=JSON.stringify(effective);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");
  fetch("/api/admin/users?"+paramsFromFilters(effective,page),{signal:controller.signal,cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message||"خطا در دریافت کاربران");return j;}).then(j=>{setRows(j.data||[]);setTotal(j.total||0);}).catch(e=>{if(!controller.signal.aborted)setError(e.message||"خطای اتصال");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[filterKey,page,refresh]);
 const changeFilters=(v:Filters)=>{setFilters(v);setPage(1);setSelected([]);setAll(false);setExcluded([]);};
 useEffect(()=>{const p=new URLSearchParams(window.location.search);const st=p.get("status"),access=p.get("access");if(st||access)setFilters(v=>({...v,status:st||"",access:access||""}));},[]);
 const count=all?Math.max(0,total-excluded.length):selected.length;
 const chosen=(id:string)=>all?!excluded.includes(id):selected.includes(id);
 const toggle=(id:string,on:boolean)=>{if(all)setExcluded(v=>on?v.filter(x=>x!==id):[...new Set([...v,id])]);else setSelected(v=>on?[...new Set([...v,id])]:v.filter(x=>x!==id));};
 const exportCsv=async()=>{
  try{
   const fetched:UserRow[]=[];for(let p=1;p<=Math.ceil(total/100);p++){const r=await fetch("/api/admin/users?"+paramsFromFilters(effective,p,100),{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.message||"خطای خروجی");fetched.push(...j.data);}
   const picked=fetched.filter(x=>chosen(x.id));if(!picked.length)throw Error("کاربری انتخاب نشده است");
   const esc=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';
   const csv=[["نام","ایمیل","پیج","اتوماسیون فعال","تیکت باز","پلن","وضعیت","تاریخ انقضا"],...picked.map(x=>[x.name,x.email,x.pagesCount,x.activeAutomations,x.openTickets,x.subscription?.planKey,x.effectiveStatus,x.subscription?.expiresAt])].map(a=>a.map(esc).join(",")).join("\r\n");
   const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const el=document.createElement("a");el.href=url;el.download="smartdirect-users.csv";el.click();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"خطای خروجی");}
 };
 const execute=async()=>{
  if(!count||busy)return;
  const label=({ "subscription-adjust":"اصلاح مدت اشتراک","subscription-change-plan":"تغییر پلن","subscription-suspend":"تعلیق اشتراک","subscription-activate":"فعال‌سازی اشتراک","access-block":"مسدودکردن حساب","access-unblock":"رفع مسدودیت" } as Record<Action,string>)[action];
  if(!window.confirm("اجرای "+label+" برای "+count.toLocaleString("fa-IR")+" کاربر؟ این عملیات در گزارش مدیریت ثبت می‌شود."))return;
  setBusy(true);setError("");
  try{
   const selection=all?{mode:"filtered",filters:effective,excludeUserIds:excluded}:{mode:"ids",userIds:selected};
   const j=await sendAdminBulkChunks({endpoint:"/api/admin/users/bulk",selection:selection as never,payload:{action,days:Number(days),planKey:plan,reason},onProgress:(done,total)=>setProgress(done.toLocaleString("fa-IR")+" از "+total.toLocaleString("fa-IR"))});
   setResult(j);setModal(false);setSelected([]);setAll(false);setExcluded([]);setRefresh(n=>n+1);
  }catch(e){setError(e instanceof Error?e.message:"خطای عملیات");}finally{setBusy(false);setProgress("");}
 };
 return <div><AdminHeading title="کاربران" description="مدیریت اشتراک، دسترسی و فعالیت هر کاربر"/>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}
 {result&&<AdminAlert kind={result.failed?"warning":"success"} onClose={()=>setResult(null)}>نتیجه عملیات: {result.succeeded} موفق، {result.failed} ناموفق از {result.processed} کاربر. {result.results.filter(x=>!x.success).slice(0,2).map(x=>x.message).join("؛ ")}</AdminAlert>}
 <AdminMobileSections labels={["فهرست کاربران","فیلتر و عملیات"]}>
 <AdminSection title="فهرست کاربران" description="انتخاب حساب‌ها و مدیریت مستقل یا گروهی">
 {count>0&&<div className="adm-mobile-selection-bar"><strong>{count.toLocaleString("fa-IR")} کاربر انتخاب‌شده</strong><div className="adm-btn-row"><AdminButton onClick={()=>setModal(true)}><WandSparkles size={16}/> عملیات گروهی</AdminButton><AdminButton kind="secondary" onClick={()=>void exportCsv()}><Download size={16}/> خروجی CSV</AdminButton></div></div>}
 {loading&&rows.length===0?<AdminSpinner/>:<div className="adm-user-grid">{rows.map(u=><AdminUserCard key={u.id} u={u} href={"/rickandmorty/users/"+u.id} selected={chosen(u.id)} onSelect={v=>toggle(u.id,v)}/>)}</div>}
 {!loading&&rows.length===0&&<AdminPanel><p className="adm-muted">کاربری با این مشخصات پیدا نشد.</p></AdminPanel>}
 <AdminPagination page={page} total={total} onChange={setPage}/></AdminSection>
 <AdminSection title="جست‌وجو و فیلتر" description="ابتدا کاربران مورد نظر را پیدا کنید؛ سپس عملیات را انجام دهید"><AdminPanel><AdminFilters value={filters} onChange={changeFilters}/><div className="adm-select-toolbar"><div className="adm-btn-row">
  <AdminButton kind="secondary" onClick={()=>{const ids=rows.map(x=>x.id);if(ids.every(id=>chosen(id)))ids.forEach(id=>toggle(id,false));else ids.forEach(id=>toggle(id,true));}} disabled={!rows.length}>انتخاب صفحه</AdminButton>
  {!all&&<AdminButton kind="secondary" disabled={!total} onClick={()=>{setAll(true);setSelected([]);setExcluded([]);}}>{`انتخاب همه نتایج (${total.toLocaleString("fa-IR")})`}</AdminButton>}
  {count>0&&<AdminButton kind="ghost" onClick={()=>{setSelected([]);setExcluded([]);setAll(false);}}>لغو انتخاب‌ها</AdminButton>}
  <span className="adm-help">انتخاب‌شده: {count.toLocaleString("fa-IR")}</span>
  <AdminButton kind="secondary" onClick={()=>void exportCsv()} disabled={!count}><Download size={16}/> خروجی CSV</AdminButton>
  <AdminButton disabled={!count} onClick={()=>setModal(true)}><WandSparkles size={16}/> عملیات گروهی</AdminButton>
 </div></div></AdminPanel></AdminSection>
 </AdminMobileSections>
 {modal&&<AdminModal title={`عملیات گروهی (${count.toLocaleString("fa-IR")} کاربر)`} onClose={()=>!busy&&setModal(false)} actions={<><AdminButton kind="secondary" disabled={busy} onClick={()=>setModal(false)}>انصراف</AdminButton><AdminButton disabled={busy} onClick={()=>void execute()}>{busy?"در حال اجرا… "+progress:"تأیید و اجرا"}</AdminButton></>}>
  <AdminAlert kind="warning">این عملیات فقط روی کاربران انتخاب‌شده اجرا می‌شود. مسدودکردن حساب با تعلیق اشتراک تفاوت دارد.</AdminAlert>
  <AdminSelect label="نوع عملیات" value={action} onChange={e=>setAction(e.target.value as Action)} options={[{value:"subscription-adjust",label:"افزایش یا کاهش روز اشتراک"},{value:"subscription-change-plan",label:"تغییر نوع اشتراک"},{value:"subscription-suspend",label:"تعلیق اشتراک"},{value:"subscription-activate",label:"فعال‌سازی اشتراک"},{value:"access-block",label:"مسدودکردن دسترسی به حساب"},{value:"access-unblock",label:"رفع مسدودیت حساب"}]}/>
  {action==="subscription-adjust"&&<AdminInput label="تغییر تعداد روز (منفی برای کاهش)" type="number" value={days} onChange={e=>setDays(e.target.value)}/>}
  {action==="subscription-change-plan"&&<AdminSelect label="پلن جدید" value={plan} onChange={e=>setPlan(e.target.value)} options={planOptions.filter(x=>x.value&&x.value!=="free")}/>}
  {action==="access-block"&&<AdminInput label="دلیل مسدودسازی (اختیاری)" value={reason} onChange={e=>setReason(e.target.value)} />}
  {plan==="monthly_under_10k"&&action==="subscription-change-plan"&&<p className="adm-help">برای هر کاربر، تعداد فالوور تمام پیج‌های متصل از Meta بررسی می‌شود. اگر قابل تأیید نباشد، آن کاربر تغییر نمی‌کند.</p>}
 </AdminModal>}
 </div>;
}
