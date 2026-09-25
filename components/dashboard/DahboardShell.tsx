"use client"

import type { ReactNode } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import DashboardSidebar from "./DashboardSidebar"
import DashboardMobileHeader from "./DashboardMobileHeader"
import DashboardOverview from "./DashboardOverview"
import { Button } from "@/components/ui/button"

type InstagramAccount={id:string;igUsername:string;igUserId:string;isConnected:boolean;createdAt:Date}
type DashboardShellProps={user:{name:string;email:string;role:string;createdAt:Date};instagramAccounts:InstagramAccount[];instagramStatus:string|null;children?:ReactNode}
export default function DashboardShell({user,instagramAccounts,instagramStatus,children}:DashboardShellProps){
 const hasConnectedAccount=instagramAccounts.some(account=>account.isConnected)
 if(!hasConnectedAccount) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-5"><Button asChild size="lg"><a href="/api/instagram/connect">اتصال پیج</a></Button></main>
 return <SidebarProvider defaultOpen>
   <DashboardSidebar open onClose={()=>undefined}/>
   <div className="min-w-0 flex-1 lg:mr-64">
     <DashboardMobileHeader/>
     <main className="min-h-screen bg-background px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
       <div className="mx-auto w-full max-w-[1400px]">{children ?? <DashboardOverview user={user} instagramAccounts={instagramAccounts} instagramStatus={instagramStatus}/>}</div>
     </main>
   </div>
 </SidebarProvider>
}
