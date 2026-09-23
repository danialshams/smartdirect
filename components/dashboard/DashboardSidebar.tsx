"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileBarChart,
  ImagePlus,
  Inbox,
  LayoutDashboard,
  MessageCircle,
  MessageCircleReply,
  Menu,
  Settings,
  UsersRound,
  X,
  UserRound,
} from "lucide-react";

import SignOutButton from "../../components/auth/SignOutButton";

type DashboardSidebarProps = {
  open: boolean;
  onClose: () => void;
};

const menuGroups = [
  {
    label: "نمای کلی",
    items: [
      { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard },
      { title: "پروفایل پیج", href: "/dashboard/profile", icon: UserRound },
      { title: "تحلیل پیج", href: "/dashboard/insights", icon: BarChart3 },
      { title: "گزارش‌ها", href: "/dashboard/reports", icon: FileBarChart },
      { title: "تحلیل محتوا", href: "/dashboard/content-analytics", icon: BarChart3 },
      { title: "اکانت‌های متصل", href: "/dashboard/accounts", icon: UsersRound },
    ],
  },
  {
    label: "مدیریت",
    items: [
      { title: "انتشار محتوا", href: "/dashboard/publishing", icon: ImagePlus },
      { title: "کامنت‌ها", href: "/dashboard/comments", icon: MessageCircleReply },
      { title: "پیام‌ها", href: "/dashboard/inbox", icon: Inbox },
      { title: "اتوماسیون‌ها", href: "/dashboard/automations", icon: Bot },
      { title: "Ice Breaker", href: "/dashboard/ice-breaker", icon: MessageCircle },
      { title: "منوی ثابت", href: "/dashboard/persistent-menu", icon: Menu },
    ],
  },
  {
    label: "حساب",
    items: [
      { title: "اشتراک", href: "/dashboard/subscription", icon: CreditCard },
      { title: "تنظیمات", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export default function DashboardSidebar({
  open,
  onClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="بستن منو"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 right-0 z-50 w-[264px]",
          "border-l border-slate-200 bg-white",
          "transition-transform duration-300",
          "lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <Link
              href="/dashboard"
              onClick={onClose}
              className="flex min-w-0 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-xs font-bold text-white">
                SD
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight text-slate-950">
                  SmartDirect
                </div>
                <div className="mt-0.5 truncate text-[10px] text-slate-400">
                  Instagram Automation
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 lg:hidden"
              aria-label="بستن"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
            <div className="space-y-6">
              {menuGroups.map((group) => (
                <section key={group.label}>
                  <p className="mb-2 px-3 text-[10px] font-semibold text-slate-400">
                    {group.label}
                  </p>

                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname === item.href ||
                            pathname.startsWith(item.href + "/");

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={[
                            "flex items-center gap-3 rounded-lg px-3 py-2.5",
                            "text-[13px] font-medium transition-colors",
                            isActive
                              ? "bg-slate-950 text-white"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                          ].join(" ")}
                        >
                          <Icon size={17} strokeWidth={1.8} />
                          <span>{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </nav>

          <div className="border-t border-slate-100 p-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
