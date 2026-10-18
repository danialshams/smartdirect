import type { ReactNode } from "react";

/**
 * Compatibility wrapper for older dashboard pages.
 * Authentication and the persistent shell are handled once by app/dashboard/layout.tsx.
 */
export default function DashboardRoute({ children }: { children: ReactNode }) {
  return children;
}
