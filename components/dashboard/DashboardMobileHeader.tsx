"use client";

import { Menu } from "lucide-react";

type DashboardMobileHeaderProps = {
  onOpen: () => void;
};

export default function DashboardMobileHeader({
  onOpen,
}: DashboardMobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:h-16 sm:px-5 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
        aria-label="باز کردن منو"
      >
        <Menu size={18} strokeWidth={1.8} />
      </button>

      <div className="text-sm font-bold tracking-tight text-slate-950">
        SmartDirect
      </div>

      <div className="h-9 w-9" />
    </header>
  );
}
