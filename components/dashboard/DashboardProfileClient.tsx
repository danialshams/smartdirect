"use client";

import InstagramProfileDashboard from "./InstagramProfileDashboard";
import { useDashboardPageAccounts } from "./useDashboardPageAccounts";

export default function DashboardProfileClient() {
  const accounts = useDashboardPageAccounts();
  const activeAccount = accounts.find((account) => account.isConnected);
  if (!activeAccount) return null;
  return <InstagramProfileDashboard accountId={activeAccount.id} />;
}
