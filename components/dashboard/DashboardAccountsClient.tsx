"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
} from "@mui/material";

import AutomationManager from "./AutomationManager";
import IceBreakerManager from "./IceBreakerManager";
import PersistentMenuManager from "./PersistentMenuManager";
import InstagramInbox from "./InstagramInbox";
import InstagramProfileDashboard from "./InstagramProfileDashboard";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");

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

  const handleProfileLoaded = useCallback((name: string | null) => {
    setProfileName(name || "");
  }, []);

  if (loading) {
    if (mode === "inbox" || mode === "comments" || mode === "stories") {
      return null;
    }

    return (
      <Box
        sx={{
          minHeight: 180,
          display: "grid",
          placeItems: "center",
          border: "1px solid #E2E8F0",
          borderRadius: 3,
          bgcolor: "#FFFFFF",
        }}
      >
        <CircularProgress size={24} thickness={4} sx={{ color: "#2563EB" }} />
      </Box>
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

  if (mode === "profile") {
    const activeAccount = accounts.find((account) => account.isConnected);

    if (!activeAccount) {
      return null;
    }

    return (
      <InstagramProfileDashboard
        accountId={activeAccount.id}
        greetingName={profileName || activeAccount.igUsername}
        onProfileLoaded={handleProfileLoaded}
      />
    );
  }

  if (mode === "inbox") {
    return <InstagramInbox accounts={accounts} />;
  }

  if (mode === "comments") {
    return <AutomationManager accounts={accounts} onlyTab="comments" />;
  }

  if (mode === "stories") {
    return <AutomationManager accounts={accounts} onlyTab="stories" />;
  }

  if (mode === "ice-breaker") {
    return <IceBreakerManager accounts={accounts} />;
  }

  if (mode === "persistent-menu") {
    return <PersistentMenuManager accounts={accounts} />;
  }

  return null;
}
