"use client";

import InstagramInbox from "./InstagramInbox";
import { useDashboardPageAccounts } from "./useDashboardPageAccounts";

export default function DashboardInboxClient() {
  const accounts = useDashboardPageAccounts();
  return <InstagramInbox accounts={accounts} accountsLoading={false} />;
}
