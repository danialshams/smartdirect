"use client";
import {useEffect,useMemo,useState} from "react";
import {MessageSquare,Smartphone} from "lucide-react";
import {AdminAlert,AdminButton,AdminFilters,AdminHeading,AdminPanel,AdminSection,AdminPagination,AdminSpinner,AdminTextarea,blankFilters,paramsFromFilters,type Filters,type UserRow,plans,formatDate} from "@/components/admin/AdminWidgets";
type Draft={id:string;message:string;status:string;targetCount:number;verifiedRecipientCount:number;createdAt:string};
export default function SmsPage(){
 const [filters,setFilters]=useState<Filters>(blankFilters),[query,setQuery]=useState(""),[rows,setRows]=useState<UserRow[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true);
 const [selected,setSelected]=useState<string[]>([]),[excluded,setExcluded]=useState<string[]>([]),[all,setAll]=useState(false);
 const [message,setMessage]=useState(""),[drafts,setDrafts]=useState<Draft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{const t=setTimeout(()=>setQuery(filters.q),280);return()=>clearTimeout(t);},[filters.q]);
 const effective=useMemo(()=>({...filters,q:query}),[filters,query]);const key=JSON.stringify(effective);
 useEffect(()=>{const c=new AbortController();setLoading(true);fetch("/api/admin/users?"+paramsFromFilters(effective,page),{cache:"no-store",signal:c.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);return j;}).then(j=>{setRows(j.data||[]);setTotal(j.total||0);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[key,page]);
 const loadDrafts=async()=>{const r=await fetch("/api/admin/sms",{cache:"no-store"});const j=await r.json();if(r.ok)setDrafts(j.data||[]);};useEffect(()=>{void loadDrafts();},[]);
 const change=(f:Filters)=>{setFilters(f);setPage(1);setSelected([]);setExcluded([]);setAll(false);};
 const chosen=(id:string)=>all?!excluded.includes(id):selected.includes(id);
 const toggle=(id:string,on:boolean)=>{if(all)setExcluded(s=>on?s.filter(x=>x!==id):[...new Set([...s,id])]);else setSelected(s=>on?[...new Set([...s,id])]:s.filter(x=>x!==id));};
 const count=all?Math.max(0,total-excluded.length):selected.length;
 const save=async()=>{if(!count||!message.trim()||busy)return;setBusy(true);setError("");try{
   const selection=all?{mode:"filtered",filters:effective,excludeUserIds:excluded}:{mode:"ids",userIds:selected};
   const r=await fetch("/api/admin/sms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selection,message})});const j=await r.json();if(!r.ok)throw Error(j.message||"ذخیره ناموفق");
   setNotice(`پیش‌نویس ذخیره شد. ${j.verifiedRecipientCount.toLocaleString("fa-IR")} گیرنده با شماره تأییدشده و رضایت ثبت‌شده؛ هیچ پیامکی ارسال نشد.`);setMessage("");await loadDrafts();
 }catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}};
 return <div><AdminHeading title="مدیریت پیامک" description="آماده‌سازی برای اتصال پنل پیامکی در آینده. هنوز هیچ پیامکی ارسال نمی‌شود."/>
 {error&&<AdminAlert onClose={()=>setError("")}>{error}</AdminAlert>}{notice&&<AdminAlert kind="success" onClose={()=>setNotice("")}>{notice}</AdminAlert>}
 <AdminSection title="۱. انتخاب مخاطبان" description="پیش‌نویس فقط برای مخاطبانی که مشخص می‌کنید ذخیره می‌شود"><AdminPanel><AdminAlert kind="warning">سرویس پیامک هنوز خریداری یا متصل نشده است. شماره کاربر باید تأیید شده و رضایت لازم ثبت شده باشد. فقط امکان آماده‌سازی پیش‌نویس وجود دارد.</AdminAlert><h2>انتخاب مخاطبان بر اساس اشتراک یا دلخواه</h2><AdminFilters value={filters} onChange={change}/><div className="adm-btn-row" style={{marginTop:12}}>{!all&&<AdminButton kind="secondary" disabled={!total} onClick={()=>{setAll(true);setSelected([]);setExcluded([]);}}>{`انتخاب همه (${total.toLocaleString("fa-IR")})`}</AdminButton>}{count>0&&<AdminButton kind="ghost" onClick={()=>{setAll(false);setSelected([]);setExcluded([]);}}>لغو انتخاب‌ها</AdminButton>}<span className="adm-help">{count.toLocaleString("fa-IR")} مخاطب انتخاب شده</span></div>
 {loading&&rows.length===0?<AdminSpinner/>:<div className="adm-user-grid" style={{marginTop:14}}>{rows.map(u=><label key={u.id} className="adm-ticket-row" style={{cursor:"pointer"}}><span className="adm-btn-row"><input type="checkbox" checked={chosen(u.id)} onChange={e=>toggle(u.id,e.target.checked)}/><strong>{u.name}</strong></span><small>{plans[u.subscription?.planKey||""]||"بدون اشتراک"} · {u.phoneVerifiedAt&&u.smsConsentAt?"شماره تأییدشده":"شماره قابل استفاده ندارد"}</small></label>)}</div>}
 <AdminPagination page={page} total={total} onChange={setPage}/>
 </AdminPanel></AdminSection>
 <AdminSection title="۲. آماده‌سازی متن" description="متن اینجا ذخیره می‌شود؛ پیامک واقعی ارسال نخواهد شد"><AdminPanel><h2><MessageSquare size={18} style={{display:"inline",marginLeft:8}}/>متن پیامک</h2><AdminTextarea label="متن پیش‌نویس" maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)}/><p className="adm-help">هیچ پیامکی ارسال نمی‌شود. بعد از اتصال ارائه‌دهنده، پیش‌نمایش هزینه و ارسال آزمایشی اضافه خواهد شد.</p><AdminButton disabled={!count||!message.trim()||busy} onClick={()=>void save()}>{busy?"در حال ذخیره…":"ذخیره پیش‌نویس"}</AdminButton></AdminPanel></AdminSection>
 <AdminSection title="۳. تاریخچه پیش‌نویس‌ها" description="فقط پیش‌نویس‌ها و تعداد گیرندگان ذخیره‌شده"><AdminPanel><h2><Smartphone size={18} style={{display:"inline",marginLeft:8}}/>پیش‌نویس‌های ثبت‌شده</h2><div className="adm-ticket-list">{drafts.map(d=><div key={d.id} className="adm-ticket-row"><strong>{d.message}</strong><small>ثبت {formatDate(d.createdAt)} · {d.targetCount.toLocaleString("fa-IR")} انتخاب‌شده · {d.verifiedRecipientCount.toLocaleString("fa-IR")} شماره آماده · ارسال نشده</small></div>)}</div>{!drafts.length&&<p className="adm-muted">پیش‌نویسی ثبت نشده است.</p>}</AdminPanel></AdminSection>
 </div>;
}
