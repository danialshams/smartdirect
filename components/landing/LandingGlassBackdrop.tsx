"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LiquidGlassScene, createLiquidGlassBackdrop } from "simple-liquid-glass/backdrop";

type Capture = ReturnType<typeof createLiquidGlassBackdrop>;
const CaptureContext = createContext<Capture | null>(null);
export const useLandingGlassCapture = () => useContext(CaptureContext);

/**
 * Safari's html-to-image pipeline captures one tile at a time and invalidates
 * a tile every time GSAP updates descendant inline styles. That is the main
 * cause of the frame stalls and stale textures.
 *
 * A separate inert, static *visual source* supplies the SAME page markup and
 * stylesheet to the SAME library's optical shader, but cannot be modified by
 * GSAP, React hydration, menu or scroll-reveal state.
 *
 * The live site stays untouched and interactive. The reflection source is
 * mounted behind it, position-aligned at document (0,0). It is an optical
 * raster source only, excluded from accessibility, hit testing and layout.
 * On Chromium native SVG live backdrop is retained unchanged.
 */
function createStaticReflection(page: HTMLElement): HTMLElement {
  const source = document.createElement("div");
  source.className = "ap-site daira-static-reflection";
  source.setAttribute("aria-hidden", "true");
  source.inert = true;
  source.style.cssText =
    "position:absolute!important;top:0!important;left:0!important;right:0!important;" +
    "width:100%!important;pointer-events:none!important;z-index:-10!important;" +
    "overflow:visible!important;contain:none!important;";
  // Header participates in page flow, but its sticky buttons and optical
  // element must not be cloned. A block with the exact height aligns every
  // later section with the real page at all responsive breakpoints.
  const header = page.querySelector<HTMLElement>(".ap-header[data-landing-header]");
  if (header) {
    const spacer = document.createElement("div");
    spacer.style.height = `${header.getBoundingClientRect().height}px`;
    spacer.style.overflow = "clip";
    spacer.setAttribute("aria-hidden", "true");
    source.appendChild(spacer);
  }
  // Each direct page section becomes one bounded, stable HTML-to-image tile.
  for (const child of Array.from(page.children)) {
    if (!child.matches("main, .ap-showcase-capture, footer.ap-footer--extended")) continue;
    const copy = child.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.querySelectorAll<HTMLElement>("[id]").forEach(node => node.removeAttribute("id"));
    copy.querySelectorAll<HTMLElement>("[data-liquid-glass-ignore]").forEach(node =>
      node.removeAttribute("data-liquid-glass-ignore"));
    copy.querySelectorAll<HTMLElement>("[data-hero-word]").forEach(node => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("visibility");
      node.style.removeProperty("transform");
    });
    copy.querySelectorAll<HTMLElement>("[style]").forEach(node => {
      // Inline GSAP opacity and transform captured during hydration must
      // NEVER be part of the static optical material.
      if (node.matches("[data-reveal], [data-hero-word]")) {
        node.style.removeProperty("opacity");
        node.style.removeProperty("visibility");
        node.style.removeProperty("transform");
      }
    });
    source.appendChild(copy);
  }
  document.body.appendChild(source);
  return source;
}

export function LandingGlassBackdrop({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const failures = useRef(new WeakMap<HTMLElement, { count: number; at: number }>());
  const timers = useRef(new Map<HTMLElement, ReturnType<typeof setTimeout>>());
  const onCaptureError = useCallback((_error: unknown, section: HTMLElement) => {
    if (!section.isConnected || timers.current.has(section)) return;
    const now = performance.now();
    const previous = failures.current.get(section);
    const count = previous && now - previous.at < 60000 ? previous.count : 0;
    failures.current.set(section, { count: count + 1, at: now });
    const delay = Math.min(5500, 450 * 2 ** Math.min(count, 5));
    const timer = setTimeout(() => {
      timers.current.delete(section);
      if (section.isConnected) section.dataset.dairaGlassRetry = String(Math.round(performance.now()));
    }, delay);
    timers.current.set(section, timer);
  }, []);

  useLayoutEffect(() => {
    const ua = navigator.userAgent;
    const needsSnapshot = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    const page = root.current;
    if (!needsSnapshot || !page) return;
    let mounted = true;
    let controller: Capture | undefined;
    let source: HTMLElement | undefined;
    try {
      source = createStaticReflection(page);
      // Capture only the static, inert optical source. No animation, React
      // state or DOM mutations can invalidate its cached section snapshots.
      controller = createLiquidGlassBackdrop(source, {
        maxCacheBytes: 64 * 1024 * 1024, onCaptureError
      });
      source.dataset.dairaGlassCaptureController = "static";
      setCapture(controller);
    } catch {
      controller?.destroy();
      source?.remove();
      if (mounted) setCapture(null);
    }
    return () => {
      mounted = false;
      setCapture(null);
      controller?.destroy();
      source?.remove();
    };
  }, [onCaptureError]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  }, []);

  return (
    <CaptureContext.Provider value={capture}>
      <LiquidGlassScene ref={root} className="ap-site" id="top" dir="rtl"
        maxCacheBytes={64 * 1024 * 1024} onCaptureError={onCaptureError}>
        {children}
      </LiquidGlassScene>
    </CaptureContext.Provider>
  );
}
