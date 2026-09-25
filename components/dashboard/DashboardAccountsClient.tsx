"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import AutomationManager from "./AutomationManager";
import IceBreakerManager from "./IceBreakerManager";
import InstagramInbox from "./InstagramInbox";
import InstagramProfileDashboard from "./InstagramProfileDashboard";
import PersistentMenuManager from "./PersistentMenuManager";

type Account = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type Mode =
  | "profile"
  | "inbox"
  | "automations"
  | "ice-breaker"
  | "persistent-menu";

export default function DashboardAccountsClient({
  mode,
}: {
  mode: Mode;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/instagram/accounts", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "خطا در دریافت اکانت‌ها");
        }

        const list = Array.isArray(result.accounts)
          ? result.accounts.map((account: Omit<Account, "createdAt"> & { createdAt?: string }) => ({
              ...account,
              createdAt: account.createdAt ? new Date(account.createdAt) : new Date(),
            }))
          : [];

        setAccounts(list);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "خطا در دریافت اکانت‌ها",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="mx-auto h-5 w-40" />
          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
          <Skeleton className="mx-auto h-4 w-52 max-w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (mode === "profile") {
    const activeAccount = accounts.find((account) => account.isConnected);

    if (!activeAccount) {
      return null;
    }

    return <InstagramProfileDashboard accountId={activeAccount.id} />;
  }

  if (mode === "inbox") {
    return <InstagramInbox accounts={accounts} />;
  }

  if (mode === "automations") {
    return <AutomationManager accounts={accounts} />;
  }

  if (mode === "ice-breaker") {
    return <IceBreakerManager accounts={accounts} />;
  }

  return <PersistentMenuManager accounts={accounts} />;
}
