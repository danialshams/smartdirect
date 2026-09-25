"use client"

import Link from "next/link"
import { ChevronDown, CircleUserRound, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

type InstagramAccount = {
  id: string
  igUsername: string
  isConnected: boolean
}

export default function DashboardMobileHeader({ instagramAccounts }: { instagramAccounts: InstagramAccount[] }) {
  const activeAccount = instagramAccounts.find((account) => account.isConnected)

  return (
    <header dir="rtl" className="sticky top-0 z-30 flex h-14 items-center justify-center bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-5">
      <div className="absolute right-3 flex items-center gap-1 sm:right-5 lg:hidden">
        <SidebarTrigger className="border-0 shadow-none" />
        <AccountConnectDropdown activeAccount={activeAccount} />
      </div>
      <div className="text-sm font-bold tracking-tight">SmartDirect</div>
      <div className="absolute left-3 hidden lg:block lg:left-5">
        <AccountConnectDropdown activeAccount={activeAccount} />
      </div>
    </header>
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
