"use client";

import { Menu } from "lucide-react";

type DashboardMobileHeaderProps = {
  onOpen: () => void;
};

export default function DashboardMobileHeader({
  onOpen,
}: DashboardMobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
        aria-label="باز کردن منو"
      >
        <Menu size={20} strokeWidth={1.8} />
      </button>

      <div className="text-sm font-bold">
        SmartDirect
      </div>

      <div className="h-10 w-10" />
    </header>
  );
}