"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Send,ArrowRight} from "lucide-react";
import {AdminAlert,AdminButton,AdminFilters,AdminHeading,AdminInput,AdminPanel,AdminSection,AdminPagination,AdminSpinner,AdminTextarea,blankFilters,paramsFromFilters,plans,sendAdminBulkChunks,type Filters,type UserRow} from "@/components/admin/AdminWidgets";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
export default function BulkTicket(){
 const [filters,setFilters]=useState<Filters>(blankFilters),[query,setQuery]=useState(""),[rows,setRows]=useState<UserRow[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<string[]>([]),[excluded,setExcluded]=useState<string[]>([]),[all,setAll]=useState(false);
 const [subject,setSubject]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState(""),[error,setError]=useState(""),[result,setResult]=useState<{succeeded:number;failed:number;processed:number}|null>(null);
 useEffect(()=>{const t=setTimeout(()=>setQuery(filters.q),250);return()=>clearTimeout(t);},[filters.q]);
 const effective=useMemo(()=>({...filters,q:query}),[filters,query]);const key=JSON.stringify(effective);
 useEffect(()=>{const controller=new AbortController();setLoading(true);fetch("/api/admin/users?"+paramsFromFilters(effective,page),{cache:"no-store",signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);return j;}).then(j=>{setRows(j.data||[]);setTotal(j.total||0);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[key,page]);
 const change=(f:Filters)=>{setFilters(f);setPage(1);setSelected([]);setExcluded([]);setAll(false);};
 const chosen=(id:string)=>all?!excluded.includes(id):selected.includes(id);
 const toggle=(id:string,on:boolean)=>{if(all)setExcluded(s=>on?s.filter(x=>x!==id):[...new Set([...s,id])]);else setSelected(s=>on?[...new Set([...s,id])]:s.filter(x=>x!==id));};
 const count=all?Math.max(0,total-excluded.length):selected.length;
 const send=async()=>{
  if(!count||!subject.trim()||!message.trim()||busy)return;
  if(!window.confirm(`برای ${count.toLocaleString("fa-IR")} کاربر تیکت جدید ساخته شود؟`))return;
  setBusy(true);setError("");try{
   const selection=all?{mode:"filtered",filters:effective,excludeUserIds:excluded}:{mode:"ids",userIds:selected};
   const j=await sendAdminBulkChunks({endpoint:"/api/admin/tickets/bulk",selection:selection as never,payload:{subject,message},onProgress:(done,total)=>setProgress(done.toLocaleString("fa-IR")+" از "+total.toLocaleString("fa-IR"))});
   setResult(j);setAll(false);setSelected([]);setExcluded([]);setSubject("");setMessage("");
  }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);setProgress("");}
 };
 return <div><AdminHeading title="ارسال گروهی تیکت" description="برای هر گیرنده یک تیکت اختصاصی ساخته می‌شود."><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/tickets"><ArrowRight size={16}/> تیکت‌ها</Link></AdminHeading>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}{result&&<AdminAlert kind={result.failed?"warning":"success"}>ثبت شد: {result.succeeded} موفق، {result.failed} ناموفق از {result.processed} کاربر</AdminAlert>}
 <AdminMobileSections labels={["انتخاب گیرندگان","متن و ارسال"]}>
 <AdminSection title="۱. گیرندگان" description="کاربران را با فیلتر یا انتخاب دستی مشخص کنید"><AdminPanel><h2>فهرست مخاطبان</h2><AdminFilters value={filters} onChange={change}/><hr className="adm-divider"/><div className="adm-btn-row">{!all&&<AdminButton kind="secondary" disabled={!total} onClick={()=>{setAll(true);setSelected([]);setExcluded([]);}}>{`انتخاب همه نتایج (${total.toLocaleString("fa-IR")})`}</AdminButton>}<AdminButton kind="secondary" disabled={!rows.length} onClick={()=>rows.forEach(u=>toggle(u.id,true))}>انتخاب صفحه</AdminButton>{count>0&&<AdminButton kind="ghost" onClick={()=>{setAll(false);setSelected([]);setExcluded([]);}}>لغو انتخاب‌ها</AdminButton>}<span className="adm-help">انتخاب‌شده: {count.toLocaleString("fa-IR")}</span></div>
 {loading&&rows.length===0?<AdminSpinner/>:<div className="adm-user-grid" style={{marginTop:16}}>{rows.map(u=><label key={u.id} className="adm-ticket-row" style={{cursor:"pointer"}}><span className="adm-btn-row"><input type="checkbox" checked={chosen(u.id)} onChange={e=>toggle(u.id,e.target.checked)}/><strong>{u.name}</strong></span><small>{u.email} · {plans[u.subscription?.planKey||""]||"بدون اشتراک"}</small></label>)}</div>}
 <AdminPagination page={page} total={total} onChange={setPage}/>
 </AdminPanel></AdminSection>
 <AdminSection title="۲. پیام گروهی" description="متن و عنوان هر تیکت مستقل را تعیین کنید"><AdminPanel><h2>محتوای تیکت</h2><div style={{display:"grid",gap:12}}><AdminInput label="عنوان تیکت" maxLength={160} value={subject} onChange={e=>setSubject(e.target.value)} /><AdminTextarea label="متن پیام" maxLength={5000} rows={6} value={message} onChange={e=>setMessage(e.target.value)}/><AdminAlert kind="info">هر تیکت مستقل است و کاربر می‌تواند مستقیماً در پشتیبانی پاسخ دهد.</AdminAlert><AdminButton disabled={!count||!subject.trim()||!message.trim()||busy} onClick={()=>void send()}><Send size={17}/>{busy?"در حال ثبت… "+progress:`ارسال تیکت برای ${count.toLocaleString("fa-IR")} کاربر`}</AdminButton></div></AdminPanel></AdminSection>
 </AdminMobileSections>
 </div>;
}
