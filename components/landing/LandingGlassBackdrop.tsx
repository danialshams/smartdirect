"use client";

import type { ReactNode } from "react";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";

/**
 * Shared scene is REQUIRED for authentic WebGL refraction on iOS/Safari.
 * Chromium uses the library's native SVG backdrop sampling instead;
 * it does not trigger the scene's HTML capture pipeline.
 * data-liquid-glass-ignore on the sticky header avoids self-reflections.
 */
export function LandingGlassBackdrop({ children }: { children: ReactNode }) {
  return (
    <LiquidGlassScene className="ap-site" id="top" dir="rtl"
      maxCacheBytes={64 * 1024 * 1024}>
      {children}
    </LiquidGlassScene>
  );
}
