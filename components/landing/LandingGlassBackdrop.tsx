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
  const retries = useRef(new WeakMap<HTMLElement, number>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const onCaptureError = useCallback((_error: unknown, section: HTMLElement) => {
    if (!section.isConnected) return;
    const count = retries.current.get(section) ?? 0;
    if (count >= 2) return;
    retries.current.set(section, count + 1);
    const retry = () => {
      timers.current.delete(timer);
      if (section.isConnected) section.setAttribute("data-daira-glass-retry", String(count + 1));
    };
    const timer = setTimeout(retry, count === 0 ? 900 : 2800);
    timers.current.add(timer);
  }, []);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const ua = navigator.userAgent;
    const webkitSnapshot = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    if (!webkitSnapshot) return;
    const source = createLiquidGlassBackdrop(element, {
      maxCacheBytes: 64 * 1024 * 1024, onCaptureError
    });
    setCapture(source);
    return () => {
      source.destroy();
    };
  }, [onCaptureError]);

  // Safari captures sections into textures. When crossing into a section
  // whose screenshot predates a lazy image or other DOM paint, the old
  // reflection can linger until the library sees another mutation. Revalidate
  // ONLY the current section after scrolling settles, and only once per
  // entrance (never on every animation frame or across the whole page).
  useEffect(() => {
    const scene = root.current;
    if (!capture || !scene) return;
    const sections = Array.from(scene.children).filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        (node.matches("main, section.ap-showcase, footer"))
    );
    const seen = new WeakMap<HTMLElement, number>();
    let settle: ReturnType<typeof setTimeout> | undefined;
    let lastY = window.scrollY;
    let lastSection: HTMLElement | null = null;
    const warm = () => {
      const x = window.innerWidth / 2;
      const y = Math.min(window.innerHeight - 1, 92);
      const node = document.elementFromPoint(x, y);
      const section = (node instanceof Element ? node.closest("main, section.ap-showcase, footer") : null) as HTMLElement | null;
      if (!section || !sections.includes(section)) return;
      const now = performance.now();
      // Each new section gets one prompt refresh. Repeat only on revisits
      // after 6s, to avoid html-to-image snapshots thrashing while scrolling.
      if (section === lastSection || now - (seen.get(section) ?? -Infinity) < 6000) return;
      lastSection = section;
      seen.set(section, now);
      section.dataset.dairaGlassViewportRevision = String(Math.round(now));
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastY) < 8) return;
      lastY = window.scrollY;
      if (settle) clearTimeout(settle);
      settle = setTimeout(warm, 95);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (settle) clearTimeout(settle);
    };
  }, [capture]);

  useEffect(() => () => {
    for (const timer of timers.current) clearTimeout(timer);
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
