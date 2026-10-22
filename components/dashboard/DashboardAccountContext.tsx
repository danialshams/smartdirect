"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "daira:active-instagram-account";

type DashboardAccountValue = {
  accountId: string | null;
  isReady: boolean;
  selectAccount: (id: string) => void;
};

const DashboardAccountContext = createContext<DashboardAccountValue>({
  accountId: null,
  isReady: false,
  selectAccount: () => {},
});

export function DashboardAccountProvider({
  accountId,
  accountIds,
  children,
}: {
  accountId: string | null;
  accountIds?: string[];
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
    () => ({ accountId: selectedId && allowedIds.includes(selectedId) ? selectedId : accountId, isReady, selectAccount }),
    [selectedId, accountId, isReady, selectAccount, allowedIds],
  );

  return <DashboardAccountContext.Provider value={value}>{children}</DashboardAccountContext.Provider>;
}

export function useDashboardAccountId() {
  return useContext(DashboardAccountContext).accountId;
}

export function useDashboardAccountSelection() {
  return useContext(DashboardAccountContext);
}
