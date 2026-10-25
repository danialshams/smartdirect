"use client";

import PersistentMenuManager from "./PersistentMenuManager";
import { useDashboardPageAccounts } from "./useDashboardPageAccounts";

export default function DashboardPersistentMenuClient() {
  const accounts = useDashboardPageAccounts();
  return <PersistentMenuManager accounts={accounts} accountsLoading={false} />;
}
