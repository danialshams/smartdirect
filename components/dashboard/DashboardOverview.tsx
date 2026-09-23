"use client";

import { Plus, UsersRound } from "lucide-react";
import Link from "next/link";

import AdvancedAnalyticsReports from "./AdvancedAnalyticsReports";
import InstagramInsights from "./InstagramInsights";
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
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {instagramStatus === "connected" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          پیج با موفقیت متصل شد.
        </div>
      )}

      {instagramStatus && instagramStatus !== "connected" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          اتصال پیج انجام نشد. دوباره تلاش کنید.
        </div>
      )}

      <header className="border-b border-slate-200 pb-5 sm:pb-6">
        <p className="text-xs font-medium text-slate-400">داشبورد</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
          {user.name ? "سلام، " + user.name : "داشبورد پیج"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          اطلاعات و عملکرد پیج متصل شما در یک نگاه.
        </p>
      </header>

      <section aria-label="پروفایل پیج">
        <InstagramProfileDashboard accounts={connectedAccounts} />
      </section>

      <section id="insights" className="scroll-mt-6">
        <InstagramInsights />
      </section>

      <section id="reports" className="scroll-mt-6">
        <AdvancedAnalyticsReports />
      </section>

      <section
        id="instagram"
        className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <UsersRound size={19} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-xs text-slate-400">مدیریت اتصال</p>
              <h2 className="mt-0.5 text-base font-bold text-slate-950">
                اکانت‌های متصل
              </h2>
            </div>
          </div>

          <Link
            href="/api/instagram/connect"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Plus size={15} />
            اتصال پیج جدید
          </Link>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {connectedAccounts.map((account) => (
            <div
              key={account.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                IG
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  @{account.igUsername}
                </p>
                <p className="mt-1 truncate text-xs text-slate-400">
                  متصل و فعال
                </p>
              </div>

              <span className="mr-auto h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6">
          <p className="text-xs text-slate-400">
            {new Intl.NumberFormat("fa-IR").format(connectedAccounts.length)} پیج متصل
          </p>
          <Link
            href="/dashboard/accounts"
            className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
          >
            مدیریت اکانت‌ها
          </Link>
        </div>
      </section>
    </div>
  );
}
