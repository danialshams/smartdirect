"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronLeft, Headset, LayoutDashboard, Menu, MessageSquare, ShieldCheck, Ticket, Users, X, BadgePercent, Smartphone, Activity, History, RadioTower } from "lucide-react";

const items = [
  { href: "/rickandmorty", label: "داشبورد", icon: LayoutDashboard },
  { href: "/rickandmorty/users", label: "کاربران", icon: Users },
  { href: "/rickandmorty/tickets", label: "تیکت‌ها", icon: Ticket },
  { href: "/rickandmorty/meta-monitor", label: "تغییرات Meta", icon: RadioTower },
  { href: "/rickandmorty/tickets/bulk", label: "ارسال گروهی", icon: MessageSquare },
  { href: "/rickandmorty/sms", label: "پیامک", icon: Smartphone },
  { href: "/rickandmorty/coupons", label: "کدهای تخفیف", icon: BadgePercent },
  { href: "/rickandmorty/monitoring", label: "سلامت سیستم", icon: Activity },
  { href: "/rickandmorty/queue", label: "صف پردازش", icon: Activity },
  { href: "/rickandmorty/audit", label: "تاریخچه عملیات", icon: History },
];
type TicketAlert = { id: string; ticketId: string; subject: string; name: string; body: string; createdAt: string };
type TicketSummary = { unreadCount: number; latest: TicketAlert | null; items: TicketAlert[] };
const navGroups=[
 {title:"مرکز مدیریت",hrefs:["/rickandmorty","/rickandmorty/users","/rickandmorty/tickets"]},
 {title:"ارتباطات و خدمات",hrefs:["/rickandmorty/tickets/bulk","/rickandmorty/sms","/rickandmorty/coupons"]},
 {title:"گزارش و نظارت",hrefs:["/rickandmorty/meta-monitor","/rickandmorty/monitoring","/rickandmorty/queue","/rickandmorty/audit"]}
];
function NavItems({ onNavigate, metaUnread }: { onNavigate?: () => void; metaUnread: number }) {
 const path=usePathname();
 const activeHref=items.filter(item=>path===item.href||path.startsWith(item.href+"/")).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
 return <nav aria-label="صفحات مدیریت" className="adm-nav-list">
  {navGroups.map(group=><div className="adm-nav-group" key={group.title}><div className="adm-nav-group-name">{group.title}</div>
   {group.hrefs.map(href=>{const item=items.find(i=>i.href===href)!;const Icon=item.icon,active=activeHref===href;
    return <Link href={item.href} key={href} onClick={onNavigate} aria-current={active?"page":undefined} className={"adm-nav-link "+(active?"is-active":"")}>
     <Icon size={19}/><span>{item.label}</span>
     {href==="/rickandmorty/meta-monitor"&&metaUnread>0&&<span className="adm-meta-badge">{metaUnread>99?"۹۹+":metaUnread.toLocaleString("fa-IR")}</span>}
     {active&&<ChevronLeft size={15} aria-hidden="true"/>}
    </Link>;})}
  </div>)}
 </nav>;
}
export default function AdminShell({ children }: { children: React.ReactNode }) {
 const path=usePathname(), router=useRouter();
 const [metaUnread,setMetaUnread]=useState(0);
 const [menu,setMenu]=useState(false),[bell,setBell]=useState(false),[summary,setSummary]=useState<TicketSummary>({unreadCount:0,latest:null,items:[]}),[toast,setToast]=useState<TicketSummary["latest"]>(null);
 const lastCreated=useRef<number|null>(null),initialized=useRef(false),requesting=useRef(false);
 useEffect(()=>{
  let alive=true;
  const load=async()=>{try{const r=await fetch("/api/admin/meta-monitor/summary",{cache:"no-store"});if(r.ok){const j=await r.json();if(alive)setMetaUnread(Number(j.unreadCount)||0);}}catch{}};
  void load();const t=setInterval(()=>{if(document.visibilityState==="visible")void load();},60000);
  const onUpdate=()=>{void load();};const onVisible=()=>{if(document.visibilityState==="visible")void load();};
  window.addEventListener("admin:meta-updated",onUpdate);document.addEventListener("visibilitychange",onVisible);
  return()=>{alive=false;clearInterval(t);window.removeEventListener("admin:meta-updated",onUpdate);document.removeEventListener("visibilitychange",onVisible);};
 },[]);
 const refresh=async()=>{
  if(requesting.current)return;
  requesting.current=true;
  try{
   const res=await fetch("/api/admin/tickets/summary",{cache:"no-store"});
   if(!res.ok)return;
   const next=await res.json() as TicketSummary;
   const when=next.latest?new Date(next.latest.createdAt).getTime():null;
   if(initialized.current&&when!==null&&lastCreated.current!==null&&when>lastCreated.current) setToast(next.latest);
   if(when!==null&&(!lastCreated.current||when>lastCreated.current))lastCreated.current=when;
   initialized.current=true;setSummary(next);
  }catch{}finally{requesting.current=false;}
 };
 useEffect(()=>{
  let disposed=false, source:EventSource|null=null;
  const load=()=>{if(!disposed)void refresh();};
  load();
  const fallback=setInterval(()=>{if(document.visibilityState==="visible"&&(!source||source.readyState!==EventSource.OPEN))load();},3000);
  const visible=()=>{if(document.visibilityState==="visible")load();};
  document.addEventListener("visibilitychange",visible);
  window.addEventListener("admin:tickets-updated",load);
  if(typeof EventSource!=="undefined"){
    source=new EventSource("/api/admin/tickets/stream");
    source.addEventListener("ticket",load);
    source.onerror=()=>{ /* Stop repeated 503 reconnects on deployments without Redis Pub/Sub. */ source?.close(); source=null; };
  }
  return()=>{disposed=true;clearInterval(fallback);document.removeEventListener("visibilitychange",visible);window.removeEventListener("admin:tickets-updated",load);source?.close();};
 },[]);
 useEffect(()=>{setMenu(false);setBell(false);setToast(null);},[path]);
 useEffect(()=>{if(!menu)return;const prev=document.body.style.overflow;document.body.style.overflow="hidden";const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setMenu(false);};window.addEventListener("keydown",onKey);return()=>{document.body.style.overflow=prev;window.removeEventListener("keydown",onKey);};},[menu]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(null),6500);return()=>clearTimeout(id);},[toast]);
 const current=items.slice().reverse().find(x=>path.startsWith(x.href))?.label||"داشبورد";
 const openTicket=(ticketId:string)=>{setBell(false);setToast(null);router.push("/rickandmorty/tickets/"+ticketId);};
 return <div className="adm-root" dir="rtl">
  <aside className="adm-sidebar"><div className="adm-brand"><div className="adm-brand-symbol">SD</div><div><strong>SmartDirect</strong><small>پنل مدیریت</small></div></div><NavItems metaUnread={metaUnread}/></aside>
  {menu&&<div className="adm-menu-overlay" onClick={()=>setMenu(false)}><div className="adm-mobile-menu" role="dialog" aria-modal="true" aria-label="منوی مدیریت" onClick={e=>e.stopPropagation()}><div className="adm-menu-top"><strong>مدیریت SmartDirect</strong><button className="adm-icon-btn" onClick={()=>setMenu(false)} aria-label="بستن منو"><X/></button></div><NavItems metaUnread={metaUnread} onNavigate={()=>setMenu(false)}/></div></div>}
  <div className="adm-content">
   <header className="adm-header">
    <div className="adm-header-start"><button className="adm-icon-btn adm-mobile-only" onClick={()=>setMenu(true)} aria-expanded={menu} aria-haspopup="dialog" aria-label="باز کردن منو"><Menu size={22}/></button><div className="adm-header-title"><ShieldCheck size={19}/><strong>{current}</strong></div></div>
    <div className="adm-header-end"><div className="adm-bell-wrap">
      <button className="adm-icon-btn adm-bell" aria-label={"اعلان‌های تیکت: "+summary.unreadCount+" پیام خوانده‌نشده"} aria-expanded={bell} onClick={()=>setBell(v=>!v)}><Bell size={21}/>{summary.unreadCount>0&&<span className="adm-bell-count">{summary.unreadCount>99?"۹۹+":summary.unreadCount.toLocaleString("fa-IR")}</span>}</button>
      {bell&&<div className="adm-bell-panel"><div className="adm-bell-heading">پیام‌های خوانده‌نشده ({summary.unreadCount.toLocaleString("fa-IR")})</div><div className="adm-bell-items">{summary.items.length?summary.items.map(item=><button key={item.id} className="adm-bell-entry" onClick={()=>openTicket(item.ticketId)}><strong>{item.subject}</strong><small>{item.name} — {item.body}</small><span>مشاهده تیکت <ChevronLeft size={14}/></span></button>):<div className="adm-muted adm-p-3">پیام جدیدی وجود ندارد.</div>}</div><Link onClick={()=>setBell(false)} href="/rickandmorty/tickets" className="adm-bell-footer">مشاهده تمام تیکت‌ها</Link></div>}
    </div></div>
   </header>
   {toast&&<div className="adm-ticket-toast" role="status"><button onClick={()=>{router.push("/rickandmorty/tickets/"+toast.ticketId);setToast(null);}}><Headset size={22}/><span><strong>تیکت جدید از {toast.name}</strong><small>{toast.subject}</small></span><ChevronLeft size={17}/></button><button className="adm-icon-btn" aria-label="بستن اعلان" onClick={()=>setToast(null)}><X size={17}/></button></div>}
   <main className="adm-main">{children}</main>
   <nav className="adm-bottom-nav" aria-label="دسترسی سریع مدیریت">
    {items.filter(item=>["/rickandmorty","/rickandmorty/users","/rickandmorty/tickets","/rickandmorty/meta-monitor","/rickandmorty/sms"].includes(item.href)).map(item=>{const Icon=item.icon;const active=item.href==="/rickandmorty"?path===item.href:path.startsWith(item.href);return <Link href={item.href} key={item.href} className={"adm-bottom-item "+(active?"is-active":"")}><span className="adm-meta-icon-holder"><Icon size={22}/>{item.href==="/rickandmorty/meta-monitor"&&metaUnread>0&&<span className="adm-meta-count-dot">{metaUnread>99?"۹۹+":metaUnread.toLocaleString("fa-IR")}</span>}</span><span>{item.label}</span></Link>;})}
   </nav>
  </div>
 </div>;
}
