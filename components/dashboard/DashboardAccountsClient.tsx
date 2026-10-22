"use client";

import { DashboardLoading } from "@/components/dashboard/DashboardUI";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,

} from "@mui/material";

import AutomationManager from "./AutomationManager";
import IceBreakerManager from "./IceBreakerManager";
import PersistentMenuManager from "./PersistentMenuManager";
import InstagramInbox from "./InstagramInbox";
import InstagramProfileDashboard from "./InstagramProfileDashboard";
import { useDashboardAccountId } from "./DashboardAccountContext";

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
  | "comments"
  | "stories"
  | "ice-breaker"
  | "persistent-menu";

export default function DashboardAccountsClient({
  mode,
}: {
  mode: Mode;
}) {
  const selectedDashboardAccountId = useDashboardAccountId();
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
          ? result.accounts.map(
              (
                account: Omit<Account, "createdAt"> & {
                  createdAt?: string;
                },
              ) => ({
                ...account,
                createdAt: account.createdAt
                  ? new Date(account.createdAt)
                  : new Date(),
              }),
            )
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

  if (loading && mode !== "inbox" && mode !== "ice-breaker" && mode !== "persistent-menu") {
    return (
      <DashboardLoading label="در حال دریافت پیج‌های متصل..." className="min-h-[180px]" />
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{
          border: "1px solid #FECACA",
          bgcolor: "#FEF2F2",
          color: "#991B1B",
          "& .MuiAlert-icon": { color: "#DC2626" },
        }}
      >
        {error}
      </Alert>
    );
  }

  const orderedAccounts = selectedDashboardAccountId
    ? [...accounts].sort((left, right) => Number(right.id === selectedDashboardAccountId) - Number(left.id === selectedDashboardAccountId))
    : accounts;

  if (mode === "profile") {
    const activeAccount = accounts.find((account) => account.id === selectedDashboardAccountId && account.isConnected)
      ?? accounts.find((account) => account.isConnected);

    if (!activeAccount) {
      return null;
    }

    return (
      <InstagramProfileDashboard
        accountId={activeAccount.id}
      />
    );
  }

  if (mode === "inbox") {
    return <InstagramInbox accounts={orderedAccounts} accountsLoading={loading} />;
  }

  if (mode === "comments") {
    return <AutomationManager accounts={orderedAccounts} onlyTab="comments" />;
  }

  if (mode === "stories") {
    return <AutomationManager accounts={orderedAccounts} onlyTab="stories" />;
  }

  if (mode === "ice-breaker") {
    return <IceBreakerManager accounts={orderedAccounts} accountsLoading={loading} />;
  }

  if (mode === "persistent-menu") {
    return <PersistentMenuManager accounts={orderedAccounts} accountsLoading={loading} />;
  }

  return null;
}
