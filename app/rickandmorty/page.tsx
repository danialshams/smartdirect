"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { Activity,BadgePercent,Bell,Camera,Headset,LockKeyhole,UserRound,Users,RadioTower } from "lucide-react";
import { AdminAlert,AdminHeading,AdminPanel,AdminSection,AdminSpinner } from "@/components/admin/AdminWidgets";
import AdminMobileSections from "@/components/admin/AdminMobileSections";
import {AdminCardHeader} from "@/components/admin/AdminDataView";
type Stats={users:number;pages:number;activeSubscriptions:number;expiredSubscriptions:number;openTickets:number;activeAutomations:number;blockedUsers:number;unreadTickets:number};
const cards=[{key:"users",label:"کاربران",href:"/rickandmorty/users",icon:UserRound},{key:"pages",label:"پیج‌های متصل",href:"/rickandmorty/users",icon:Camera},{key:"activeSubscriptions",label:"اشتراک فعال",href:"/rickandmorty/users?status=ACTIVE",icon:Users},{key:"openTickets",label:"تیکت‌های باز",href:"/rickandmorty/tickets",icon:Headset},{key:"activeAutomations",label:"اتوماسیون فعال",href:"/rickandmorty/users",icon:Activity},{key:"blockedUsers",label:"کاربران مسدود",href:"/rickandmorty/users?access=blocked",icon:LockKeyhole},{key:"expiredSubscriptions",label:"اشتراک منقضی",href:"/rickandmorty/users?status=EXPIRED",icon:BadgePercent},{key:"unreadTickets",label:"پیام‌های خوانده‌نشده",href:"/rickandmorty/tickets",icon:Bell}] as const;
export default function AdminDashboard(){
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState("");
 useEffect(()=>{let alive=true;fetch("/api/admin/stats",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.message);return j;}).then(j=>{if(alive)setStats(j);}).catch(e=>{if(alive)setError(String(e.message));});return()=>{alive=false;};},[]);
 return <div><AdminHeading title="داشبورد مدیریت" description="نمای کلی کاربران، اشتراک‌ها، اتوماسیون‌ها و پشتیبانی"/>
 {error&&<AdminAlert>{error}</AdminAlert>}
 {stats?<AdminMobileSections labels={["نمای کلی","وضعیت عملیات","دسترسی سریع"]}><AdminSection title="نمای کلی" description="مهم‌ترین شاخص‌هایی که هر روز نیاز دارید"><div className="adm-grid adm-home-stats-grid">{cards.slice(0,4).map(item=>{const Icon=item.icon;return <Link key={item.key} href={item.href}><AdminPanel className="adm-stat"><div><small>{item.label}</small><strong>{(stats[item.key]||0).toLocaleString("fa-IR")}</strong></div><Icon size={27}/></AdminPanel></Link>;})}</div></AdminSection>
 <AdminSection title="وضعیت عملیات" description="فعالیت‌ها و مواردی که نیازمند توجه هستند"><div className="adm-grid adm-home-stats-grid">{cards.slice(4).map(item=>{const Icon=item.icon;return <Link key={item.key} href={item.href}><AdminPanel className="adm-stat"><div><small>{item.label}</small><strong>{(stats[item.key]||0).toLocaleString("fa-IR")}</strong></div><Icon size={27}/></AdminPanel></Link>;})}</div></AdminSection>
 <AdminSection title="دسترسی سریع" description="پرکاربردترین کارهای مدیریت"><AdminPanel><AdminCardHeader title="ابزارهای مدیریت"/><div className="adm-shortcut-grid">
 <Link className="adm-shortcut-tile" href="/rickandmorty/meta-monitor"><span>تغییرات Meta</span><RadioTower size={19}/></Link>
 <Link className="adm-shortcut-tile" href="/rickandmorty/users"><span>کاربران</span><UserRound size={19}/></Link>
 <Link className="adm-shortcut-tile" href="/rickandmorty/tickets"><span>تیکت‌ها</span><Headset size={19}/></Link>
 <Link className="adm-shortcut-tile" href="/rickandmorty/tickets/bulk"><span>تیکت گروهی</span><Bell size={19}/></Link>
 <Link className="adm-shortcut-tile" href="/rickandmorty/sms"><span>پیامک‌ها</span><Activity size={19}/></Link>
 <Link className="adm-shortcut-tile" href="/rickandmorty/coupons"><span>تخفیف‌ها</span><BadgePercent size={19}/></Link>
 </div></AdminPanel></AdminSection></AdminMobileSections>:<AdminSpinner/>}
 </div>;
}
