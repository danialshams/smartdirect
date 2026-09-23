"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import DashboardSidebar from "./DashboardSidebar";
import DashboardMobileHeader from "./DashboardMobileHeader";
import DashboardOverview from "./DashboardOverview";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardShellProps = {
  user: {
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  instagramAccounts: InstagramAccount[];
  instagramStatus: string | null;
  children?: ReactNode;
};

export default function DashboardShell({
  user,
  instagramAccounts,
  instagramStatus,
  children,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const hasConnectedAccount = instagramAccounts.some(
    (account) => account.isConnected,
  );

  if (!hasConnectedAccount) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-white px-5"
      >
        <a
          href="/api/instagram/connect"
          className="inline-flex h-12 min-w-[190px] items-center justify-center rounded-xl bg-[#2563eb] px-7 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(37,99,235,0.18)] transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          اتصال پیج
        </a>
      </main>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f8fafc] text-slate-900"
    >
      <DashboardSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lg:mr-[264px]">
        <DashboardMobileHeader onOpen={() => setMobileSidebarOpen(true)} />

        <main className="min-h-screen px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
            {children ?? (
              <DashboardOverview
                user={user}
                instagramAccounts={instagramAccounts}
                instagramStatus={instagramStatus}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
