"use client";

import { createContext, useContext, type ReactNode } from "react";

const DashboardAccountContext = createContext<string | null>(null);

export function DashboardAccountProvider({ accountId, children }: { accountId: string | null; children: ReactNode }) {
  return <DashboardAccountContext.Provider value={accountId}>{children}</DashboardAccountContext.Provider>;
}

export function useDashboardAccountId() {
  return useContext(DashboardAccountContext);
}
