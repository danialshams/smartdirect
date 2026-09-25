"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Bot, CreditCard, ImagePlus, Inbox, LayoutDashboard, MessageCircle, MessageCircleReply, Menu, Settings, UsersRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarClose, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import SignOutButton from "../../components/auth/SignOutButton"

type DashboardSidebarProps={open?:boolean; onClose?:()=>void}
const menuGroups=[
{label:"نمای کلی",items:[{title:"داشبورد",href:"/dashboard",icon:LayoutDashboard},{title:"تحلیل پیج",href:"/dashboard/insights",icon:BarChart3},{title:"اکانت‌های متصل",href:"/dashboard/accounts",icon:UsersRound}]},
{label:"مدیریت",items:[{title:"انتشار محتوا",href:"/dashboard/publishing",icon:ImagePlus},{title:"کامنت‌ها",href:"/dashboard/comments",icon:MessageCircleReply},{title:"پیام‌ها",href:"/dashboard/inbox",icon:Inbox},{title:"اتوماسیون‌ها",href:"/dashboard/automations",icon:Bot},{title:"Ice Breaker",href:"/dashboard/ice-breaker",icon:MessageCircle},{title:"منوی ثابت",href:"/dashboard/persistent-menu",icon:Menu}]},
{label:"حساب",items:[{title:"اشتراک",href:"/dashboard/subscription",icon:CreditCard},{title:"تنظیمات",href:"/dashboard/settings",icon:Settings}]}
]
export default function DashboardSidebar({onClose}:DashboardSidebarProps){
 const pathname=usePathname()
 const {setOpenMobile}=useSidebar()
 const close=()=>{onClose?.();setOpenMobile(false)}
 return <Sidebar dir="rtl" side="right" className="border-slate-200 bg-white">
   <SidebarHeader>
     <div className="flex items-center justify-between">
       <Link href="/dashboard" onClick={close} className="flex min-w-0 items-center gap-3">
         <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">SD</div>
         <div className="min-w-0"><div className="truncate text-sm font-bold tracking-tight">SmartDirect</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">Instagram Automation</div></div>
       </Link>
       <Button variant="ghost" size="icon" className="lg:hidden" onClick={close} aria-label="بستن"><X/></Button>
     </div>
   </SidebarHeader>
   <SidebarContent>
     {menuGroups.map(group=><SidebarGroup key={group.label}>
       <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
       <SidebarGroupContent><SidebarMenu>{group.items.map(item=>{const Icon=item.icon; const active=item.href==="/dashboard"?pathname==="/dashboard":pathname===item.href||pathname.startsWith(item.href+"/"); return <SidebarMenuItem key={item.href}><SidebarMenuButton href={item.href} isActive={active} onClick={close}><Icon/><span>{item.title}</span></SidebarMenuButton></SidebarMenuItem>})}</SidebarMenu></SidebarGroupContent>
     </SidebarGroup>)}
   </SidebarContent>
   <SidebarFooter><SignOutButton/></SidebarFooter>
 </Sidebar>
}
