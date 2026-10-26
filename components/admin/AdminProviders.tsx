"use client";
import type { ReactNode, CSSProperties } from "react";
import { dairaPalette } from "../../lib/design-system/palette";
/** Admin uses the same Daira tokens and Tailwind as the customer dashboard; no MUI runtime. */
export default function AdminProviders({ children }: { children: ReactNode }) {
  return <div style={{ "--admin-primary": dairaPalette.primary.main } as CSSProperties}>{children}</div>;
}
