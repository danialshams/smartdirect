"use client";
import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Link from "next/link";
export type UserRow={id:string;name:string;email:string;createdAt:string;isBlocked:boolean;pagesCount:number;openTickets?:number;activeAutomations?:number;phone?:string|null;phoneVerifiedAt?:string|null;smsConsentAt?:string|null;subscription?:{id:string;planKey:string;status:string;expiresAt:string;effectiveStatus:string}|null;effectiveStatus:string};
export const plans:Record<string,string>={monthly:"ماهانه",yearly:"سالانه",monthly_under_10k:"ماهانه زیر ۱۰هزار",free:"آزمایشی"};
export const statusLabels:Record<string,string>={ACTIVE:"فعال",EXPIRED:"منقضی",SUSPENDED:"تعلیق‌شده",CANCELLED:"لغوشده",NONE:"بدون اشتراک",BLOCKED:"مسدود",OPEN:"باز",IN_PROGRESS:"در حال بررسی",WAITING_USER:"منتظر کاربر",RESOLVED:"حل‌شده",CLOSED:"بسته",LOW:"کم",NORMAL:"عادی",HIGH:"زیاد",URGENT:"فوری"};
export const planOptions=[{value:"",label:"همه اشتراک‌ها"},{value:"monthly",label:plans.monthly},{value:"yearly",label:plans.yearly},{value:"monthly_under_10k",label:plans.monthly_under_10k},{value:"free",label:plans.free}];
export type Filters={q:string;planKey:string;status:string;expiryWithin:string;connection:string;access:string};
export const blankFilters:Filters={q:"",planKey:"",status:"",expiryWithin:"",connection:"",access:""};
export function paramsFromFilters(f:Filters,page=1,pageSize=20){const p=new URLSearchParams({page:String(page),pageSize:String(pageSize)});Object.entries(f).forEach(([k,v])=>{if(v)p.set(k,v);});return p.toString();}
export function formatDate(d?:string|null){return d?new Date(d).toLocaleDateString("fa-IR"):"—";}
export function AdminPanel({children,className=""}:{children:ReactNode;className?:string}){return <section className={"adm-panel "+className}>{children}</section>;}
export function AdminHeading({title,description,children}:{title:string;description?:string;children?:ReactNode}){return <div className="adm-page-heading"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{children&&<div className="adm-heading-actions">{children}</div>}</div>;}
export function AdminButton({children,kind="primary",className="",...rest}:ButtonHTMLAttributes<HTMLButtonElement>&{kind?:"primary"|"secondary"|"danger"|"ghost"}){return <button type="button" {...rest} className={"adm-btn adm-btn-"+kind+" "+className}>{children}</button>;}
export function AdminInput({label,...rest}:InputHTMLAttributes<HTMLInputElement>&{label?:string}){return <label className="adm-field">{label&&<span>{label}</span>}<input {...rest}/></label>;}
export function AdminSelect({label,options,...rest}:SelectHTMLAttributes<HTMLSelectElement>&{label?:string;options:{value:string;label:string}[]}){return <label className="adm-field">{label&&<span>{label}</span>}<select {...rest}>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;}
export function AdminTextarea({label,...rest}:TextareaHTMLAttributes<HTMLTextAreaElement>&{label?:string}){return <label className="adm-field">{label&&<span>{label}</span>}<textarea {...rest}/></label>;}
export function AdminAlert({kind="error",children,onClose}:{kind?:"error"|"success"|"info"|"warning";children:ReactNode;onClose?:()=>void}){return <div className={"adm-alert adm-alert-"+kind} role="status"><span>{children}</span>{onClose&&<button onClick={onClose} aria-label="بستن"><X size={16}/></button>}</div>;}
export function AdminStatus({status}:{status:string}){return <span className="adm-state" data-state={status}>{statusLabels[status]||status}</span>;}
export function AdminSpinner(){return <div className="adm-loading" role="status">در حال بارگذاری اطلاعات…</div>;}
export function AdminModal({title,children,onClose,actions}:{title:string;children:ReactNode;onClose:()=>void;actions?:ReactNode}){
 const [mounted,setMounted]=useState(false);
 const dialogRef=useRef<HTMLElement>(null);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  setMounted(true);
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const focusRequest=window.requestAnimationFrame(()=>closeRef.current?.focus());
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();return;}
   if(event.key!=="Tab"||!dialogRef.current)return;
   const focusable=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
    .filter(node=>node.getClientRects().length>0);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener("keydown",onKey);
  return()=>{window.cancelAnimationFrame(focusRequest);window.removeEventListener("keydown",onKey);document.body.style.overflow=previousOverflow;};
 },[onClose]);
 if(!mounted)return null;
 return createPortal(<div className="adm-modal-overlay adm-portal-root" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={dialogRef} className="adm-modal" role="dialog" aria-modal="true" aria-label={title} dir="rtl">
   <div className="adm-modal-header"><h2>{title}</h2><button ref={closeRef} type="button" className="adm-icon-btn" onClick={onClose} aria-label="بستن"><X size={20}/></button></div>
   <div className="adm-modal-body">{children}</div>
   {actions&&<div className="adm-modal-actions">{actions}</div>}
  </section>
 </div>,document.body);
}
export function AdminFilters({value,onChange}:{value:Filters;onChange:(filters:Filters)=>void}){const set=(k:keyof Filters,v:string)=>onChange({...value,[k]:v});return <div className="adm-filters">
 <AdminInput aria-label="جستجوی کاربران" placeholder="نام، ایمیل یا نام پیج…" value={value.q} onChange={e=>set("q",e.target.value)}/>
 <div className="adm-filter-grid">
  <AdminSelect label="نوع اشتراک" value={value.planKey} onChange={e=>set("planKey",e.target.value)} options={planOptions}/>
  <AdminSelect label="وضعیت اشتراک" value={value.status} onChange={e=>set("status",e.target.value)} options={[{value:"",label:"همه"},{value:"ACTIVE",label:"فعال"},{value:"EXPIRED",label:"منقضی"},{value:"SUSPENDED",label:"تعلیق‌شده"},{value:"CANCELLED",label:"لغوشده"},{value:"NONE",label:"بدون اشتراک"}]}/>
  <AdminSelect label="وضعیت پیج" value={value.connection} onChange={e=>set("connection",e.target.value)} options={[{value:"",label:"همه"},{value:"connected",label:"متصل"},{value:"disconnected",label:"بدون اتصال"}]}/>
  <AdminSelect label="دسترسی" value={value.access} onChange={e=>set("access",e.target.value)} options={[{value:"",label:"همه"},{value:"allowed",label:"مجاز"},{value:"blocked",label:"مسدود"}]}/>
  <AdminSelect label="مانده اعتبار" value={value.expiryWithin} onChange={e=>set("expiryWithin",e.target.value)} options={[{value:"",label:"همه"},{value:"3",label:"کمتر از ۳ روز"},{value:"7",label:"کمتر از ۷ روز"}]}/>
 </div></div>;}
export function AdminPagination({page,total,pageSize=20,onChange}:{page:number;total:number;pageSize?:number;onChange:(p:number)=>void}){const count=Math.ceil(total/pageSize);return count>1?<div className="adm-pagination"><AdminButton kind="secondary" disabled={page<=1} onClick={()=>onChange(page-1)}>قبلی</AdminButton><span>صفحه {page.toLocaleString("fa-IR")} از {count.toLocaleString("fa-IR")}</span><AdminButton kind="secondary" disabled={page>=count} onClick={()=>onChange(page+1)}>بعدی</AdminButton></div>:null;}
export function AdminUserCard({u,selected,onSelect,href}:{u:UserRow;selected?:boolean;onSelect?:(v:boolean)=>void;href:string}){return <article className="adm-user-card">
 <div className="adm-card-head">{onSelect&&<input type="checkbox" checked={!!selected} onChange={e=>onSelect(e.target.checked)} aria-label={"انتخاب "+u.name}/>}<div className="adm-user-avatar">{u.name?.trim()?.slice(0,1)||"ک"}</div><div className="adm-user-name"><strong>{u.name||"بدون نام"}</strong><small>{u.email}</small></div><AdminStatus status={u.isBlocked?"BLOCKED":u.effectiveStatus}/></div>
 <div className="adm-user-metrics"><div><small>پیج متصل</small><strong>{u.pagesCount.toLocaleString("fa-IR")}</strong></div><div><small>اتوماسیون فعال</small><strong>{(u.activeAutomations??0).toLocaleString("fa-IR")}</strong></div><div><small>تیکت باز</small><strong>{(u.openTickets??0).toLocaleString("fa-IR")}</strong></div></div>
 <div className="adm-card-footer"><span>{plans[u.subscription?.planKey||""]||"بدون اشتراک"} · {formatDate(u.subscription?.expiresAt)}</span><Link href={href} className="adm-card-link">مدیریت کاربر</Link></div>
 </article>;}

/** Snapshot filtered recipients once, then send bounded chunks to avoid serverless timeouts. */
export async function sendAdminBulkChunks(options:{
 endpoint:string;
 selection:{mode:"filtered";filters:Filters;excludeUserIds:string[]} | {mode:"ids";userIds:string[]};
 payload:Record<string,unknown>;
 onProgress?:(processed:number,total:number)=>void;
}):Promise<{processed:number;succeeded:number;failed:number;results:{userId:string;success:boolean;message?:string}[]}> {
 const resolution=await fetch("/api/admin/users/selection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({selection:options.selection})});
 const data=await resolution.json();
 if(!resolution.ok)throw new Error(data.message||"انتخاب کاربران ناموفق بود");
 const ids=data.userIds as string[];
 const aggregate={processed:0,succeeded:0,failed:0,results:[] as {userId:string;success:boolean;message?:string}[]};
 for(let i=0;i<ids.length;i+=100){
  const chunk=ids.slice(i,i+100);
  const res=await fetch(options.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...options.payload,selection:{mode:"ids",userIds:chunk}})});
  const json=await res.json();
  if(!res.ok&&res.status!==207)throw new Error((json.message||"عملیات ناموفق بود")+"؛ "+aggregate.processed+" کاربر پیش‌تر پردازش شده‌اند.");
  aggregate.processed+=Number(json.processed||0);aggregate.succeeded+=Number(json.succeeded||0);aggregate.failed+=Number(json.failed||0);
  if(Array.isArray(json.results))aggregate.results.push(...json.results);
  options.onProgress?.(aggregate.processed,ids.length);
 }
 return aggregate;
}
