import type { ReactNode } from "react";
import { LiveOpticsDefinitions } from "./LiveOptics";

/**
 * No LiquidGlassScene / WebGL snapshot queue. The optical filter is
 * declared in the initial HTML for immediate native Chromium refraction.
 * WebKit/Firefox use a prewarmed full-page visual mirror.
 */
export function LandingGlassBackdrop({ children }: { children: ReactNode }) {
  return <div className="ap-site" id="top" dir="rtl">
    <LiveOpticsDefinitions />
    {children}
  </div>;
}
