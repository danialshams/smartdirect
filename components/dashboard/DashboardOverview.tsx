"use client";

import { ChevronDown, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

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
  user: { name: string; email: string; role: string; createdAt: Date };
  instagramAccounts: InstagramAccount[];
  instagramStatus: string | null;
};

export default function DashboardOverview({ user, instagramAccounts, instagramStatus }: DashboardOverviewProps) {
  const connectedAccounts = instagramAccounts.filter((account) => account.isConnected);
  const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!connectedAccounts.some((account) => account.id === accountId)) setAccountId(connectedAccounts[0]?.id || "");
  }, [accountId, connectedAccounts]);

  function refreshAll() {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent("smartdirect:refresh"));
    window.setTimeout(() => setRefreshing(false), 900);
  }

  if (!connectedAccounts.length) {
    return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-white px-5"><a href="/api/instagram/connect" className="inline-flex h-12 min-w-[190px] items-center justify-center rounded-xl bg-[#2563eb] px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(37,99,235,0.18)] transition hover:bg-[#1d4ed8]">اتصال پیج</a></main>;
  }

  const activeAccount = connectedAccounts.find((account) => account.id === accountId) ?? connectedAccounts[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {instagramStatus === "connected" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">پیج با موفقیت متصل شد.</div>}
      {instagramStatus && instagramStatus !== "connected" && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">اتصال پیج انجام نشد. دوباره تلاش کنید.</div>}

      <header className="border-b border-slate-200 pb-5 sm:pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">داشبورد</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{user.name ? "سلام، " + user.name : "داشبورد پیج"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">اطلاعات و عملکرد پیج فعال شما در یک نگاه.</p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:min-w-[250px]">
              <button type="button" onClick={() => setAccountMenuOpen((open) => !open)} className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-right transition hover:border-slate-300" aria-expanded={accountMenuOpen}>
                <span className="min-w-0"><span className="block text-[9px] font-medium text-slate-400">پیج فعال</span><span className="mt-0.5 block truncate text-xs font-bold text-slate-800">@{activeAccount.igUsername}</span></span>
                <ChevronDown size={16} className={accountMenuOpen ? "rotate-180 text-slate-500 transition" : "text-slate-400 transition"} />
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-full min-w-[250px] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
                  <p className="px-3 pb-2 pt-1 text-[10px] font-medium text-slate-400">اکانت‌های متصل</p>
                  <div className="space-y-1">
                    {connectedAccounts.map((account) => (
                      <button key={account.id} type="button" onClick={() => { setAccountId(account.id); setAccountMenuOpen(false); }} className={account.id === accountId ? "flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900" : "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"}>
                        <span>@{account.igUsername}</span>{account.id === accountId && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                      </button>
                    ))}
                  </div>
                  <a href="/api/instagram/connect" className="mt-2 flex items-center justify-center gap-2 border-t border-slate-100 px-3 pt-3 text-xs font-semibold text-slate-700 hover:text-slate-950"><Plus size={14} />افزودن اکانت</a>
                </div>
              )}
            </div>
            <button type="button" onClick={refreshAll} disabled={refreshing} aria-label="بروزرسانی اطلاعات" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </header>

      <InstagramProfileDashboard accountId={accountId} />
      <InstagramInsights accountId={accountId} />
      <AdvancedAnalyticsReports accountId={accountId} />
    </div>
  );
}
