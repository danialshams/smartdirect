"use client";

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
};

export default function DashboardShell({
  user,
  instagramAccounts,
  instagramStatus,
}: DashboardShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] =
    useState(false);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f6f7f9] text-slate-900"
    >
      <DashboardSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="lg:mr-[260px]">
        <DashboardMobileHeader
          onOpen={() => setMobileSidebarOpen(true)}
        />

        <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1450px]">
            <DashboardOverview
              user={user}
              instagramAccounts={instagramAccounts}
              instagramStatus={instagramStatus}
            />
          </div>
        </main>
      </div>
    </div>
  );
}