"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";

/**
 * On iOS/Safari the library captures real HTML sections once and repaints
 * their cached pixels at each animation frame as the page scrolls. A tile
 * which failed image/font capture is marked failed by the library and will
 * stay blank until its DOM is invalidated again.
 *
 * Recover a failed tile at most twice, well outside the active scroll.
 * Do not refresh every frame: it would synchronously rasterize HTML and cause
 * the exact delayed/white reflections this page is fixing.
 */
export function LandingGlassBackdrop({ children }: { children: ReactNode }) {
  const retries = useRef(new WeakMap<HTMLElement, number>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const onCaptureError = useCallback((_error: unknown, section: HTMLElement) => {
    if (!section.isConnected) return;
    const count = retries.current.get(section) ?? 0;
    if (count >= 2) return;
    retries.current.set(section, count + 1);

    const retry = () => {
      timers.current.delete(timer);
      if (!section.isConnected) return;
      // The scene observes section mutations and will re-attempt a failed
      // capture on the next idle frame, keeping its last good pixels.
      section.setAttribute("data-daira-glass-retry", String(count + 1));
    };
    const timer = setTimeout(retry, count === 0 ? 900 : 2800);
    timers.current.add(timer);
  }, []);

  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <LiquidGlassScene
      className="ap-site"
      id="top"
      dir="rtl"
      maxCacheBytes={64 * 1024 * 1024}
      onCaptureError={onCaptureError}
    >
      {children}
    </LiquidGlassScene>
  );
}
