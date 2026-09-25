"use client"

import Link from "next/link"
import { ChevronDown, CircleUserRound, Link2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

type InstagramAccount = {
  id: string
  igUsername: string
  isConnected: boolean
}

export default function DashboardMobileHeader({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  const activeAccount = instagramAccounts.find((account) => account.isConnected)

  return (
    <header dir="rtl" className="sticky top-0 z-30 flex h-14 items-center justify-center bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-5">
      <div className="absolute right-3 sm:right-5 lg:hidden">
        <SidebarTrigger className="border-0 shadow-none" />
      </div>
      <div className="text-sm font-bold tracking-tight">SmartDirect</div>

      {/* Mobile/tablet account connection control lives outside the header. */}
      <div className="fixed left-0 top-1/2 z-40 -translate-y-1/2 lg:hidden">
        <MobileAccountSheet activeAccount={activeAccount} />
      </div>

      {/* Desktop keeps the account control in the header. */}
      <div className="absolute left-3 hidden lg:block lg:left-5">
        <AccountConnectDropdown activeAccount={activeAccount} />
      </div>
    </header>
  )
}

function MobileAccountSheet({ activeAccount }: { activeAccount?: InstagramAccount }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="اتصال پیج جدید"
          title="اتصال پیج جدید"
          className="flex h-10 w-8 items-center justify-center rounded-r-md border border-l-0 border-border/70 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <Link2 className="size-4" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="h-auto max-h-[70vh] w-[250px] rounded-r-xl border-r border-border/60 px-4 py-5 sm:w-[280px]"
      >
        <SheetHeader className="pr-7">
          <SheetTitle>پیج‌های متصل</SheetTitle>
          <SheetDescription>پیج فعال را مدیریت کنید یا یک پیج جدید متصل کنید.</SheetDescription>
        </SheetHeader>

        <div className="space-y-2">
          {activeAccount ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3">
              <CircleUserRound className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-xs font-medium" dir="ltr">
                  @{activeAccount.igUsername}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">پیج فعال</p>
              </div>
            </div>
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">هنوز پیجی متصل نشده است.</p>
          )}
        </div>

        <Link
          href="/api/instagram/connect"
          className="mt-2 flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-xs font-medium transition-colors hover:bg-muted"
        >
          <Plus className="size-3.5" />
          اتصال پیج جدید
        </Link>
      </SheetContent>
    </Sheet>
  )
}

function AccountConnectDropdown({ activeAccount }: { activeAccount?: InstagramAccount }) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs font-medium text-foreground hover:bg-muted/60">
          <span dir="ltr" className="max-w-32 truncate">{activeAccount ? `@${activeAccount.igUsername}` : "اتصال پیج"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-48 border border-border bg-background p-1.5 shadow-md">
        {activeAccount ? (
          <>
            <DropdownMenuItem disabled className="h-9 cursor-default gap-2 rounded-md px-2.5 text-xs font-medium opacity-100">
              <CircleUserRound className="size-3.5 shrink-0 text-muted-foreground" />
              <span dir="ltr" className="truncate">@{activeAccount.igUsername}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
          </>
        ) : null}
        <DropdownMenuItem asChild className="h-9 cursor-pointer gap-2 rounded-md px-2.5 text-xs font-medium">
          <Link href="/api/instagram/connect">
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            <span>اتصال پیج جدید</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
