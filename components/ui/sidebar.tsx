"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SidebarContextValue = {
  openMobile: boolean
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [openMobile, setOpenMobile] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    setOpenMobile((value) => !value)
  }, [])

  return (
    <SidebarContext.Provider
      value={{ openMobile, setOpenMobile, toggleSidebar, isMobile }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }
  return context
}

function Sidebar({
  side = "right",
  dir = "rtl",
  className,
  children,
  ...props
}: {
  side?: "left" | "right"
  dir?: "rtl" | "ltr"
  className?: string
  children: React.ReactNode
}) {
  const { openMobile, setOpenMobile, isMobile } = useSidebar()

  return (
    <>
      {isMobile && openMobile && (
        <button
          type="button"
          aria-label="بستن منو"
          onClick={() => setOpenMobile(false)}
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        />
      )}

      <aside
        dir={dir}
        data-slot="sidebar"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-50 hidden w-64 flex-col border-slate-200 bg-white lg:flex",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className
        )}
        {...props}
      >
        {children}
      </aside>

      {isMobile && openMobile && (
        <aside
          dir={dir}
          data-slot="sidebar-mobile"
          data-side={side}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(18rem,85vw)] flex-col border-l border-slate-200 bg-white shadow-2xl lg:hidden",
            className
          )}
        >
          {children}
        </aside>
      )}
    </>
  )
}

function SidebarHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("shrink-0 border-b border-slate-100 p-4", className)}
      {...props}
    />
  )
}

function SidebarContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-4", className)}
      {...props}
    />
  )
}

function SidebarFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("mt-auto shrink-0 border-t border-slate-100 p-3", className)}
      {...props}
    />
  )
}

function SidebarGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <section
      data-slot="sidebar-group"
      className={cn("mb-5 last:mb-0", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "mb-2 px-3 text-[11px] font-medium text-slate-400",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-group-content" className={cn(className)} {...props} />
  )
}

function SidebarMenu({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative w-full", className)}
      {...props}
    />
  )
}

function SidebarMenuButton({
  className,
  isActive = false,
  children,
  ...props
}: React.ComponentProps<"a"> & { isActive?: boolean }) {
  return (
    <a
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-600 outline-none transition-colors",
        "hover:bg-slate-50 hover:text-slate-950 focus-visible:bg-slate-50 focus-visible:text-slate-950",
        isActive && "bg-slate-100 text-slate-950",
        className
      )}
      {...props}
    >
      {children}
    </a>
  )
}

function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("lg:hidden", className)}
      onClick={toggleSidebar}
      aria-label="باز کردن منو"
      {...props}
    >
      <Menu className="size-4" />
      <span className="sr-only">باز کردن منو</span>
    </Button>
  )
}

function SidebarClose({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { setOpenMobile } = useSidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setOpenMobile(false)}
      aria-label="بستن منو"
      {...props}
    >
      <X className="size-4" />
    </Button>
  )
}

function SidebarInset({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("relative min-h-svh flex-1 bg-white", className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarClose,
  useSidebar,
}
