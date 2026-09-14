"use client";

import {
    Activity,
    Bot,
    Camera,
    MessageCircle,
    Plus,
    Sparkles,
    Users,
} from "lucide-react";
import Link from "next/link";

import AutomationManager from "./AutomationManager";
import IceBreakerManager from "./IceBreakerManager";
import InstagramInsights from "./InstagramInsights";
import PersistentMenuManager from "./PersistentMenuManager";
import InstagramContentAnalytics from "./InstagramContentAnalytics";
import AdvancedAnalyticsReports from "./AdvancedAnalyticsReports";
import InstagramProfileDashboard from "./InstagramProfileDashboard";

type InstagramAccount = {
    id: string;
    igUsername: string;
    igUserId: string;
    isConnected: boolean;
    createdAt: Date;
};

type DashboardOverviewProps = {
    user: {
        name: string;
        email: string;
        role: string;
        createdAt: Date;
    };
    instagramAccounts: InstagramAccount[];
    instagramStatus: string | null;
};

export default function DashboardOverview({
    user,
    instagramAccounts,
    instagramStatus,
}: DashboardOverviewProps) {
    const connectedAccounts = instagramAccounts.filter(
        (account) => account.isConnected,
    ).length;

    return (
        <div className="space-y-7">
            {instagramStatus === "connected" && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    اکانت اینستاگرام با موفقیت متصل شد.
                </div>
            )}

            {instagramStatus && instagramStatus !== "connected" && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                    اتصال اکانت اینستاگرام با خطا مواجه شد. دوباره تلاش کنید.
                </div>
            )}

            <section className="relative overflow-hidden rounded-[30px] bg-slate-950 px-6 py-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:px-8 lg:px-10 lg:py-10">
                <div className="relative z-10 max-w-2xl">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300">
                        <Sparkles size={13} />
                        پنل مدیریت SmartDirect
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                        سلام، {user.name || "کاربر"}.
                    </h1>

                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                        اتوماسیون پاسخ‌گویی اینستاگرام را از یک نقطه مدیریت کنید؛ از کامنت و دایرکت تا پاسخ به استوری و اجرای Flow های خودکار.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                        <a href="#automations" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                            <Bot size={17} />
                            مدیریت اتوماسیون‌ها
                        </a>
                        <Link href="/api/instagram/connect" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                            <Plus size={17} />
                            اتصال پیج جدید
                        </Link>
                    </div>
                </div>

                <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full border border-white/5" />
                <div className="pointer-events-none absolute -left-8 -top-12 h-48 w-48 rounded-full border border-white/5" />
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="پیج‌های متصل" value={connectedAccounts} description="اکانت فعال اینستاگرام" icon={Camera} />
                <StatCard title="اتوماسیون‌ها" value="—" description="در حال بارگذاری" icon={Bot} />
                <StatCard title="پیام‌ها" value="—" description="زیرساخت پیام‌رسانی" icon={MessageCircle} />
                <StatCard title="وضعیت سرویس" value="فعال" description="سیستم آماده دریافت رویداد" icon={Activity} success />
            </section>

            <InstagramProfileDashboard accounts={instagramAccounts} />
            <InstagramInsights />
            <AdvancedAnalyticsReports />
            <InstagramContentAnalytics />
            <section id="instagram" className="scroll-mt-24">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">INSTAGRAM</p>
                        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">اکانت‌های متصل</h2>
                    </div>
                    <Link href="/api/instagram/connect" className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                        <Plus size={16} />
                        افزودن اکانت
                    </Link>
                </div>

                {instagramAccounts.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                            <Camera size={25} strokeWidth={1.7} />
                        </div>
                        <h3 className="mt-5 text-base font-bold text-slate-800">هنوز پیجی متصل نشده است</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">برای شروع، اکانت Professional اینستاگرام خود را به SmartDirect متصل کنید.</p>
                        <Link href="/api/instagram/connect" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                            <Camera size={17} />
                            اتصال اینستاگرام
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {instagramAccounts.map((account) => (
                            <InstagramAccountCard key={account.id} account={account} />
                        ))}
                    </div>
                )}
            </section>

            <section id="automations" className="scroll-mt-24">
                <AutomationManager accounts={instagramAccounts} />
            </section>

            <section id="ice-breakers" className="scroll-mt-24">
                <IceBreakerManager accounts={instagramAccounts} />
            </section>

            <section id="persistent-menu" className="scroll-mt-24">
                <PersistentMenuManager accounts={instagramAccounts} />
            </section>

            <section id="messages" className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <MessageCircle size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">پیام‌ها</h2>
                        <p className="mt-1 text-sm text-slate-400">مدیریت گفتگوها در مرحله بعدی اضافه می‌شود.</p>
                    </div>
                </div>
            </section>

            <section id="subscription" className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Users size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-900">اشتراک</h2>
                        <p className="mt-1 text-sm text-slate-400">سیستم اشتراک ماهانه در مراحل بعدی فعال می‌شود.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}

function StatCard({
    title,
    value,
    description,
    icon: Icon,
    success = false,
}: {
    title: string;
    value: string | number;
    description: string;
    icon: typeof Activity;
    success?: boolean;
}) {
    return (
        <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
            <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={19} strokeWidth={1.8} />
                </div>
                {success && (
                    <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        فعال
                    </span>
                )}
            </div>
            <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{title}</p>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
    );
}

function InstagramAccountCard({ account }: { account: InstagramAccount }) {
    return (
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">IG</div>
                    <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">@{account.igUsername}</p>
                        <p className="mt-1 truncate text-xs text-slate-400">ID: {account.igUserId}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${account.isConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {account.isConnected ? "متصل" : "قطع شده"}
                </span>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[11px] text-slate-400">تاریخ اتصال</p>
                <p className="mt-1 text-xs font-medium text-slate-600">{new Intl.DateTimeFormat("fa-IR").format(new Date(account.createdAt))}</p>
            </div>
        </div>
    );
}
