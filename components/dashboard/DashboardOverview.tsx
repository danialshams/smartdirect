"use client";

import { useCallback, useEffect, useState } from "react";

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

export default function DashboardOverview({
  instagramAccounts,
  instagramStatus,
}: DashboardOverviewProps) {
  const connectedAccounts = instagramAccounts.filter(
    (account) => account.isConnected
  );
  const [accountId, setAccountId] = useState(connectedAccounts[0]?.id || "");
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!connectedAccounts.some((account) => account.id === accountId)) {
      setAccountId(connectedAccounts[0]?.id || "");
    }
  }, [accountId, connectedAccounts]);

  const handleProfileLoaded = useCallback((name: string | null) => {
    setProfileName(name || "");
  }, []);

  if (!connectedAccounts.length) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-white px-5">
        <a
          href="/api/instagram/connect"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-sm font-semibold text-background"
        >
          اتصال پیج
        </a>
      </main>
    );
  }

  const activeAccount =
    connectedAccounts.find((account) => account.id === accountId) ??
    connectedAccounts[0];

  return (
    <div dir="rtl" className="space-y-6 sm:space-y-8">
      {instagramStatus === "connected" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          پیج با موفقیت متصل شد.
        </div>
      )}

      {instagramStatus && instagramStatus !== "connected" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          اتصال پیج انجام نشد. دوباره تلاش کنید.
        </div>
      )}

      <InstagramProfileDashboard
        accountId={accountId}
        onProfileLoaded={handleProfileLoaded}
        greetingName={profileName || activeAccount.igUsername}
      />
    </div>
  );
}
