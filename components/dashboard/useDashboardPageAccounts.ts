"use client";

import { useMemo } from "react";
import { useDashboardAccountId, useDashboardAccounts } from "./DashboardAccountContext";

/**
 * Read-only projection of the authenticated layout's account list.
 * Keep selection order identical to the former DashboardAccountsClient.
 */
export function useDashboardPageAccounts() {
  const selectedId = useDashboardAccountId();
  const accounts = useDashboardAccounts();
  return useMemo(() =>
    selectedId
      ? [...accounts].sort((left, right) =>
          Number(right.id === selectedId) - Number(left.id === selectedId))
      : accounts,
    [accounts, selectedId],
  );
}
