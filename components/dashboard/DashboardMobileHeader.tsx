"use client"

import Link from "next/link"
import { ChevronDown, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

type InstagramAccount = {
  id: string
  igUsername: string
  isConnected: boolean
}

export default function DashboardMobileHeader({
  instagramAccounts,
}: {
  instagramAccounts: InstagramAccount[]
}) {
  const activeAccount = instagramAccounts.find((account) => account.isConnected)

  return (
    <header
      dir="rtl"
      className="sticky top-0 z-30 flex h-14 items-center justify-center bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-5"
    >
      <div className="absolute right-3 sm:right-5 lg:hidden">
        <SidebarTrigger
          className="border-0 shadow-none"
        >
          <Menu className="size-4" />
        </SidebarTrigger>
      </div>

      <div className="text-sm font-bold tracking-tight">SmartDirect</div>

      <div className="absolute left-3 sm:left-5">
        <AccountConnectDropdown activeAccount={activeAccount} />
      </div>
    </header>
  )
}

function AccountConnectDropdown({
  activeAccount,
}: {
  activeAccount?: InstagramAccount
}) {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-xs font-medium"
        >
          <span className="max-w-32 truncate">
            {activeAccount ? `@${activeAccount.igUsername}` : "اتصال پیج"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-right text-xs text-muted-foreground">
          {activeAccount ? "پیج متصل" : "اتصال به Instagram"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {activeAccount && (
          <DropdownMenuItem disabled className="cursor-default justify-end text-sm">
            @{activeAccount.igUsername}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild className="cursor-pointer justify-end">
          <Link href="/api/instagram/connect">
            اتصال پیج جدید
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
