"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LiquidGlassScene, createLiquidGlassBackdrop } from "simple-liquid-glass/backdrop";

type Capture = ReturnType<typeof createLiquidGlassBackdrop>;
const CaptureContext = createContext<Capture | null>(null);
export const useLandingGlassCapture = () => useContext(CaptureContext);

/**
 * The stock scene binding resets its WebGL engine to PENDING whenever the
 * upcoming HTML section has not been captured yet. In fast iPhone scrolling,
 * that DESTROYS and recreates the GPU canvas between section boundaries.
 *
 * Register the library's exact same capture engine as an explicit
 * backdropRef, keeping its WebGL renderer mounted while missing snapshots
 * are filled in. A transparent, live CSS fallback hides capture gaps.
 *
 * Chromium still uses the existing native SVG path, unchanged. The standard
 * scene DOM wrapper remains for source structure / compatibility but does
 * not register a second canvas when an explicit source is supplied.
 */
export function LandingGlassBackdrop({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  // Capture failures must be recoverable. The old two-attempt limit could
  // permanently strand an uncaptured tile as a white patch after a transient
  // font/image decode or GPU pressure failure.
  const failures = useRef(new WeakMap<HTMLElement, { count: number; at: number }>());
  const timers = useRef(new Map<HTMLElement, ReturnType<typeof setTimeout>>());

  const onCaptureError = useCallback((_error: unknown, section: HTMLElement) => {
    if (!section.isConnected || timers.current.has(section)) return;
    const now = performance.now();
    const previous = failures.current.get(section);
    // A later, unrelated failure should not inherit an old long backoff.
    const count = previous && now - previous.at < 60000 ? previous.count : 0;
    failures.current.set(section, { count: count + 1, at: now });
    const delay = Math.min(30000, 600 * 2 ** Math.min(count, 6));
    const timer = setTimeout(() => {
      timers.current.delete(section);
      if (section.isConnected) {
        section.dataset.dairaGlassRetry = String(Math.round(performance.now()));
      }
    }, delay);
    timers.current.set(section, timer);
  }, []);

  // Safari/Firefox need a shared canvas source. Keep this initialization
  // independent of the optical lens ref so it can mount at any time.
  useLayoutEffect(() => {
    const ua = navigator.userAgent;
    const webkitSnapshot = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    if (!webkitSnapshot) return;

    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let source: Capture | undefined;
    let attempts = 0;
    const connect = () => {
      if (!active || source) return;
      // LiquidGlassScene forwards the DOM root from its own layout effect.
      // If hydration defers that ref, retry rather than leaving backdropRef
      // unbound for the lifetime of the page.
      const element = root.current ??
        document.querySelector<HTMLElement>(".ap-site[data-liquid-glass-scene]");
      if (!element || !element.isConnected) {
        retry = setTimeout(connect, Math.min(500, 70 + 40 * attempts++));
        return;
      }
      try {
        source = createLiquidGlassBackdrop(element, {
          maxCacheBytes: 64 * 1024 * 1024, onCaptureError
        });
        element.dataset.dairaGlassCaptureController = "active";
        setCapture(source);
      } catch {
        // Recover from a transient scene initialization/DOM measurement
        // failure without forcing full-page snapshots on scroll.
        source = undefined;
        retry = setTimeout(connect, Math.min(1800, 180 * 2 ** Math.min(attempts++, 4)));
      }
    };
    connect();
    return () => {
      active = false;
      if (retry !== undefined) clearTimeout(retry);
      source?.destroy();
    };
  }, [onCaptureError]);

  // The official capture engine already composites its cached section tiles
  // at requestAnimationFrame speed using the current scroll geometry, and
  // observes actual DOM/image/font changes automatically.
  //
  // DO NOT mutate a section after every scroll settle. The old
  // dairaGlassViewportRevision hook invalidated unchanged HTML, triggered a
  // slow html-to-image recapture, and could leave a previous texture onscreen
  // (or a missing white tile) while that unnecessary work completed.
  // Stable sections must reuse their cached capture; only actual changes and
  // capture errors require new snapshots.

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <CaptureContext.Provider value={capture}>
      <LiquidGlassScene
        ref={root}
        className="ap-site"
        id="top"
        dir="rtl"
        maxCacheBytes={64 * 1024 * 1024}
        onCaptureError={onCaptureError}
      >
        {children}
      </LiquidGlassScene>
    </CaptureContext.Provider>
  );
}
