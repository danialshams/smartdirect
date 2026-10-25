"use client";


import AutomationManager from "./AutomationManager";
import IceBreakerManager from "./IceBreakerManager";
import PersistentMenuManager from "./PersistentMenuManager";
import InstagramInbox from "./InstagramInbox";
import InstagramProfileDashboard from "./InstagramProfileDashboard";
import { useDashboardAccountId, useDashboardAccounts } from "./DashboardAccountContext";

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
  // Reuse accounts verified by the persistent dashboard layout.
  const accounts = useDashboardAccounts();
  const loading = false;

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
