"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { Activity,BadgePercent,Bell,Camera,Headset,LockKeyhole,UserRound,Users,RadioTower } from "lucide-react";
import { AdminAlert,AdminHeading,AdminPanel,AdminSpinner } from "@/components/admin/AdminWidgets";
type Stats={users:number;pages:number;activeSubscriptions:number;expiredSubscriptions:number;openTickets:number;activeAutomations:number;blockedUsers:number;unreadTickets:number};
const cards=[{key:"users",label:"کاربران",href:"/rickandmorty/users",icon:UserRound},{key:"pages",label:"پیج‌های متصل",href:"/rickandmorty/users",icon:Camera},{key:"activeSubscriptions",label:"اشتراک فعال",href:"/rickandmorty/users?status=ACTIVE",icon:Users},{key:"openTickets",label:"تیکت‌های باز",href:"/rickandmorty/tickets",icon:Headset},{key:"activeAutomations",label:"اتوماسیون فعال",href:"/rickandmorty/users",icon:Activity},{key:"blockedUsers",label:"کاربران مسدود",href:"/rickandmorty/users?access=blocked",icon:LockKeyhole},{key:"expiredSubscriptions",label:"اشتراک منقضی",href:"/rickandmorty/users?status=EXPIRED",icon:BadgePercent},{key:"unreadTickets",label:"پیام‌های خوانده‌نشده",href:"/rickandmorty/tickets",icon:Bell}] as const;
export default function AdminDashboard(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState("");
 useEffect(()=>{let alive=true;fetch("/api/admin/stats",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);return j;}).then(j=>{if(alive)setStats(j);}).catch(e=>{if(alive)setError(String(e.message));});return()=>{alive=false;};},[]);
 return <div><AdminHeading title="داشبورد مدیریت" description="نمای کلی کاربران، اشتراک‌ها، اتوماسیون‌ها و پشتیبانی"/>
 {error&&<AdminAlert>{error}</AdminAlert>}
 {stats?<div className="adm-grid">{cards.map(item=>{const Icon=item.icon;return <Link key={item.key} href={item.href}><AdminPanel className="adm-stat"><div><small>{item.label}</small><strong>{(stats[item.key]||0).toLocaleString("fa-IR")}</strong></div><Icon size={27}/></AdminPanel></Link>;})}</div>:<AdminSpinner/>}
 <AdminPanel><h2>دسترسی سریع</h2><div className="adm-btn-row"><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/meta-monitor"><RadioTower size={17}/> تغییرات Meta</Link><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/users">مدیریت کاربران</Link><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/tickets">مدیریت تیکت‌ها</Link><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/tickets/bulk">ارسال تیکت گروهی</Link><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/sms">پیامک</Link><Link className="adm-btn adm-btn-secondary" href="/rickandmorty/coupons">کدهای تخفیف</Link></div></AdminPanel>
 </div>;
}
