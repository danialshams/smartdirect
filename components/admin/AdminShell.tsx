"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgePercent,
  Headphones,
  LayoutDashboard,
  Menu as MenuIcon,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";

const items = [
  { href: "/rickandmorty", label: "داشبورد", icon: LayoutDashboard },
  { href: "/rickandmorty/users", label: "کاربران", icon: Users },
  { href: "/rickandmorty/tickets", label: "تیکت‌ها", icon: Ticket },
  { href: "/rickandmorty/coupons", label: "کدهای تخفیف", icon: BadgePercent },
];

function selectedKey(pathname: string) {
  if (pathname.startsWith("/rickandmorty/users")) return "/rickandmorty/users";
  if (pathname.startsWith("/rickandmorty/tickets")) return "/rickandmorty/tickets";
  if (pathname.startsWith("/rickandmorty/coupons")) return "/rickandmorty/coupons";
  return "/rickandmorty";
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = selectedKey(pathname);

  return (
    <nav className="space-y-1" aria-label="منوی مدیریت">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = active === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={[
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-[#EFF6FF] text-[#2563EB]"
                : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
            ].join(" ")}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentKey = selectedKey(pathname);
  const currentLabel =
    items.find((item) => item.href === currentKey)?.label ?? "داشبورد";

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-[248px] border-l border-[#E2E8F0] bg-white lg:block">
        <div className="flex h-[72px] items-center gap-3 border-b border-[#E2E8F0] px-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#2563EB] text-sm font-bold text-white">
            S
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[#0F172A]">
              SmartDirect
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#64748B]">
              <ShieldCheck size={12} />
              پنل مدیریت
            </div>
          </div>
        </div>

        <div className="px-3 pt-4">
          <AdminNav />
        </div>

        <div className="absolute bottom-4 right-4 left-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-white">
              A
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#0F172A]">
                مدیر سیستم
              </div>
              <div className="text-[10px] text-[#64748B]">ADMIN</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:mr-[248px]">
        <header className="sticky top-0 z-20 h-16 border-b border-[#E2E8F0] bg-white px-3 shadow-[0_1px_8px_rgba(15,23,42,0.03)] sm:px-5 lg:px-8">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg text-[#475569] transition-colors hover:bg-[#F8FAFC] lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="باز کردن منو"
              >
                <MenuIcon size={20} />
              </button>

              <span className="hidden text-sm font-semibold text-[#0F172A] sm:block">
                {currentLabel}
              </span>
            </div>

            <Link
              href="/dashboard"
              className="text-xs text-[#64748B] transition-colors hover:text-[#2563EB]"
            >
              بازگشت به پنل کاربری
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px] animate-[adminFade_.25s_ease-out]">
            {children}
          </div>
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            aria-label="بستن منو"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-[280px] border-l border-[#E2E8F0] bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB] text-xs font-bold text-white">
                  S
                </div>
                پنل مدیریت
              </div>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC]"
                onClick={() => setMobileOpen(false)}
                aria-label="بستن منو"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3">
              <AdminNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
