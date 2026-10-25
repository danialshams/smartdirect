"use client";

import IceBreakerManager from "./IceBreakerManager";
import { useDashboardPageAccounts } from "./useDashboardPageAccounts";

export default function DashboardIceBreakerClient() {
  const accounts = useDashboardPageAccounts();
  return <IceBreakerManager accounts={accounts} accountsLoading={false} />;
}
