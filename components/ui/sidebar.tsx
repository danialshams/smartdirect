"use client"

import * as React from "react"
import { cn } from "cn"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type SidebarContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggleSidebar: () => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
}
const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function SidebarProvider({ children, defaultOpen=true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open,setOpen]=React.useState(defaultOpen)
  const [openMobile,setOpenMobile]=React.useState(false)
  const [isMobile,setIsMobile]=React.useState(false)
  React.useEffect(()=>{ const update=()=>setIsMobile(window.innerWidth<1024); update(); window.addEventListener("resize",update); return()=>window.removeEventListener("resize",update)},[])
  const toggleSidebar=()=>isMobile?setOpenMobile(v=>!v):setOpen(v=>!v)
  return <SidebarContext.Provider value={{open,setOpen,toggleSidebar,openMobile,setOpenMobile,isMobile}}>{children}</SidebarContext.Provider>
}
function useSidebar(){const c=React.useContext(SidebarContext); if(!c) throw new Error("useSidebar must be used within SidebarProvider"); return c}

function Sidebar({side="right",dir="rtl",className,children,...props}:{side?:"left"|"right"; dir?:"rtl"|"ltr"; className?:string; children:React.ReactNode}) {
 const {open,openMobile,setOpenMobile,isMobile}=useSidebar()
 const visible=isMobile?openMobile:open
 return <>
   {isMobile && visible && <button aria-label="بستن منو" onClick={()=>setOpenMobile(false)} className="fixed inset-0 z-40 bg-black/10 lg:hidden"/>}
   <aside dir={dir} data-slot="sidebar" data-side={side} className={cn("fixed inset-y-0 z-50 hidden w-64 border-border bg-white lg:flex",side==="right"?"right-0 border-l":"left-0 border-r",!open&&"lg:w-16",className)} {...props}>{children}</aside>
   {isMobile && visible && <aside dir={dir} data-slot="sidebar-mobile" className={cn("fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] border-l bg-white shadow-xl lg:hidden",className)}>{children}</aside>}
 </>}
function SidebarHeader({className,...props}:React.ComponentProps<"div">){return <div data-slot="sidebar-header" className={cn("p-3",className)} {...props}/>}
function SidebarContent({className,...props}:React.ComponentProps<"div">){return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-4",className)} {...props}/>}
function SidebarFooter({className,...props}:React.ComponentProps<"div">){return <div data-slot="sidebar-footer" className={cn("border-t p-3",className)} {...props}/>}
function SidebarGroup({className,...props}:React.ComponentProps<"div">){return <section data-slot="sidebar-group" className={cn("mb-5",className)} {...props}/>}
function SidebarGroupLabel({className,...props}:React.ComponentProps<"div">){return <div data-slot="sidebar-group-label" className={cn("mb-2 px-3 text-xs font-medium text-muted-foreground",className)} {...props}/>}
function SidebarGroupContent({className,...props}:React.ComponentProps<"div">){return <div data-slot="sidebar-group-content" className={cn(className)} {...props}/>}
function SidebarMenu({className,...props}:React.ComponentProps<"ul">){return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-1",className)} {...props}/>}
function SidebarMenuItem({className,...props}:React.ComponentProps<"li">){return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative",className)} {...props}/>}
function SidebarMenuButton({className,isActive=false,children,...props}:React.ComponentProps<"a"> & {isActive?:boolean}){return <a data-slot="sidebar-menu-button" data-active={isActive} className={cn("flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",isActive&&"bg-primary text-primary-foreground hover:bg-primary/90",className)} {...props}>{children}</a>}
function SidebarTrigger({className,...props}:React.ComponentProps<"button">){const {toggleSidebar}=useSidebar(); return <Button variant="outline" size="icon" className={cn(className)} onClick={toggleSidebar} {...props}><Menu className="size-4 rtl:rotate-180"/><span className="sr-only">باز کردن منو</span></Button>}
function SidebarClose({className,...props}:React.ComponentProps<"button">){const {setOpenMobile}=useSidebar(); return <Button variant="ghost" size="icon" className={className} onClick={()=>setOpenMobile(false)} {...props}><X className="size-4"/></Button>}
function SidebarInset({className,...props}:React.ComponentProps<"main">){return <main data-slot="sidebar-inset" className={cn("relative min-h-svh flex-1 bg-background",className)} {...props}/>}
export { Sidebar, SidebarProvider, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger, SidebarClose, useSidebar }
