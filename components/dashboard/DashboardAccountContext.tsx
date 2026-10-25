"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "daira:active-instagram-account";

export type DashboardAccountInfo = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

type DashboardAccountValue = {
  accounts: DashboardAccountInfo[];
  accountId: string | null;
  isReady: boolean;
  selectAccount: (id: string) => void;
};

const DashboardAccountContext = createContext<DashboardAccountValue>({
  accounts: [],
  accountId: null,
  isReady: false,
  selectAccount: () => {},
});

export function DashboardAccountProvider({
  accountId,
  accountIds,
  accounts = [],
  children,
}: {
  accountId: string | null;
  accountIds?: string[];
  accounts?: DashboardAccountInfo[];
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(accountId);
  const [isReady, setIsReady] = useState(false);
  const allowedIds = useMemo(() => accountIds ?? (accountId ? [accountId] : []), [accountIds, accountId]);
  const allowedKey = allowedIds.join("|");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setSelectedId(stored && allowedIds.includes(stored) ? stored : accountId);
    } catch {
      setSelectedId(accountId);
    }
    setIsReady(true);
    // The key tracks membership without resetting the selection on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, allowedKey]);

  const selectAccount = useCallback((id: string) => {
    if (!allowedIds.includes(id)) return;
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage may be unavailable in restricted browser modes.
    }
  }, [allowedIds]);

  const value = useMemo(
    () => ({ accountId: selectedId && allowedIds.includes(selectedId) ? selectedId : accountId, isReady, selectAccount, accounts }),
    [selectedId, accountId, isReady, selectAccount, allowedIds, accounts],
  );

  return <DashboardAccountContext.Provider value={value}>{children}</DashboardAccountContext.Provider>;
}

export function useDashboardAccountId() {
  return useContext(DashboardAccountContext).accountId;
}

export function useDashboardAccountSelection() {
  return useContext(DashboardAccountContext);
}

/** Accounts are already authenticated and loaded by the server dashboard layout. */
export function useDashboardAccounts() {
  return useContext(DashboardAccountContext).accounts;
}
