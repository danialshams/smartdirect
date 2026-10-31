"use client";

import type { ReactNode } from "react";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";

/**
 * The real background captured by the scene is the source of distortion on
 * WebKit / iPhone. Without this, simple-liquid-glass would only be frosted CSS.
 * One shared scene feeds just the header & right-side menu lenses.
 */
export function LandingGlassBackdrop({children}:{children:ReactNode}) {
  return (
    <LiquidGlassScene className="ap-site" id="top" dir="rtl"
      maxCacheBytes={16*1024*1024}>
      {children}
    </LiquidGlassScene>
  );
}
