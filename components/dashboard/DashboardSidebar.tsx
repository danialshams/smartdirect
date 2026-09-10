"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Bot,
    Camera,
    MessageCircle,
    Settings,
    X,
    CreditCard,
} from "lucide-react";

import SignOutButton from "../../components/auth/SignOutButton";

type DashboardSidebarProps = {
    open: boolean;
    onClose: () => void;
};

const menuItems = [
    {
        title: "داشبورد",
        href: "/dashboard",
        icon: BarChart3,
    },
    {
        title: "اتوماسیون‌ها",
        href: "/dashboard#automations",
        icon: Bot,
    },
    {
        title: "پیام‌ها",
        href: "/dashboard#messages",
        icon: MessageCircle,
    },
    {
        title: "اینستاگرام",
        href: "/dashboard#instagram",
        icon: Camera,
    },
    {
        title: "اشتراک",
        href: "/dashboard#subscription",
        icon: CreditCard,
    },
    {
        title: "تنظیمات",
        href: "/dashboard#settings",
        icon: Settings,
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
                    "fixed inset-y-0 right-0 z-50 w-[260px]",
                    "border-l border-slate-200/80 bg-white",
                    "transition-transform duration-300",
                    "lg:translate-x-0",
                    open ? "translate-x-0" : "translate-x-full",
                ].join(" ")}
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-6">
                        <Link
                            href="/dashboard"
                            onClick={onClose}
                            className="flex items-center gap-3"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                                SD
                            </div>

                            <div>
                                <div className="text-[15px] font-bold tracking-tight">
                                    SmartDirect
                                </div>

                                <div className="mt-0.5 text-[10px] text-slate-400">
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
                            <X size={19} strokeWidth={1.8} />
                        </button>
                    </div>

                    <div className="px-4 py-6">
                        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400">
                            مدیریت
                        </p>

                        <nav className="space-y-1">
                            {menuItems.map((item) => {
                                const Icon = item.icon;

                                const isActive =
                                    item.href === "/dashboard"
                                        ? pathname === "/dashboard"
                                        : false;

                                return (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        onClick={onClose}
                                        className={[
                                            "flex items-center gap-3 rounded-xl px-3.5 py-3",
                                            "text-sm transition-all duration-200",
                                            isActive
                                                ? "bg-slate-950 text-white shadow-sm"
                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                        ].join(" ")}
                                    >
                                        <Icon
                                            size={18}
                                            strokeWidth={1.8}
                                        />

                                        <span>{item.title}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="mt-auto border-t border-slate-100 p-4">
                        <SignOutButton />
                    </div>
                </div>
            </aside>
        </>
    );
}