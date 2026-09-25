"use client"
import { SidebarTrigger } from "@/components/ui/sidebar"
export default function DashboardMobileHeader(){return <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-5 lg:hidden"><SidebarTrigger/><div className="text-sm font-bold tracking-tight">SmartDirect</div><div className="size-9"/></header>}
