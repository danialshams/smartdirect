"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type BackHandler = () => void;

type DashboardBackNavigationValue = {
  registerBackHandler: (handler: BackHandler | null) => void;
  backHandler: BackHandler | null;
};

const DashboardBackNavigationContext = createContext<DashboardBackNavigationValue | null>(null);

export function DashboardBackNavigationProvider({ children }: { children: ReactNode }) {
  const [backHandler, setBackHandler] = useState<BackHandler | null>(null);

  const registerBackHandler = useCallback((handler: BackHandler | null) => {
    setBackHandler(() => handler);
  }, []);

  const value = useMemo(
    () => ({ registerBackHandler, backHandler }),
    [registerBackHandler, backHandler],
  );

  return (
    <DashboardBackNavigationContext.Provider value={value}>
      {children}
    </DashboardBackNavigationContext.Provider>
  );
}

export function useDashboardBackNavigation() {
  const value = useContext(DashboardBackNavigationContext);
  if (!value) {
    throw new Error("useDashboardBackNavigation must be used inside DashboardBackNavigationProvider");
  }
  return value;
}
