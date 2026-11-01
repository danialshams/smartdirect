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
 * The optical source uses raster captures of the original rendered UI,
 * passed to the SAME library's optical shader, but cannot be modified by
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

  const header = page.querySelector<HTMLElement>(".ap-header[data-landing-header]");
  if (header) {
    const spacer = document.createElement("div");
    spacer.style.height = `${header.getBoundingClientRect().height}px`;
    spacer.style.overflow = "clip";
    spacer.setAttribute("aria-hidden", "true");
    source.appendChild(spacer);
  }

  // These are full-resolution source *pixels captured from the actual live UI*
  // by the native WebKit audit, not approximations of Instagram previews.
  // Keeping the scene as simple <img> tiles avoids serial html-to-image
  // serialization of eleven complicated mockups during a user's scroll.
  // The same unmodified GPU shader refracts these source pixels every frame.
  const sections = Array.from(page.children).filter(child =>
    child.matches("main, .ap-showcase-capture, footer.ap-footer--extended")
  ) as HTMLElement[];
  sections.forEach((child, index) => {
    const tile = document.createElement(child.tagName.toLowerCase());
    tile.className = `${child.className} daira-optical-tile`;
    tile.setAttribute("aria-hidden", "true");
    tile.style.height = `${child.getBoundingClientRect().height}px`;
    const image = document.createElement("img");
    image.src = `/landing-reflection/${window.matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop"}-${index}.jpg`;
    image.alt = "";
    image.decoding = "sync";
    image.loading = "eager";
    image.draggable = false;
    tile.appendChild(image);
    source.appendChild(tile);
  });
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
    let geometryObserver: ResizeObserver | undefined;
    try {
      source = createStaticReflection(page);
      // Capture only the static, inert optical source. No animation, React
      // state or DOM mutations can invalidate its cached section snapshots.
      controller = createLiquidGlassBackdrop(source, {
        fontEmbedCSS: "", maxCacheBytes: 64 * 1024 * 1024, onCaptureError
      });
      source.dataset.dairaGlassCaptureController = "static";
      // Keep the static source pixel-aligned after responsive layout changes.
      // This runs only on actual element resize, not on GSAP frames or scroll.
      const originalSections = Array.from(page.children).filter(child =>
        child.matches("main, .ap-showcase-capture, footer.ap-footer--extended")) as HTMLElement[];
      const reflectionSections = Array.from(source.children).filter(child =>
        child.matches("main, .ap-showcase-capture, footer.ap-footer--extended")) as HTMLElement[];
      const updateImagesForViewport = () => {
        const variant = window.matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop";
        reflectionSections.forEach((tile, index) => {
          const image = tile.querySelector("img");
          if (!image) return;
          const wanted = `/landing-reflection/${variant}-${index}.jpg`;
          if (image.getAttribute("src") !== wanted) image.src = wanted;
        });
      };
      const syncGeometry = () => {
        const header = page.querySelector<HTMLElement>(".ap-header[data-landing-header]");
        const spacer = source?.firstElementChild as HTMLElement | null;
        if (header && spacer) {
          const h = header.offsetHeight;
          if (Math.abs(spacer.offsetHeight - h) > 1) spacer.style.height = `${h}px`;
        }
        originalSections.forEach((section, index) => {
          const mirror = reflectionSections[index];
          if (!mirror) return;
          const height = section.offsetHeight;
          if (Math.abs(mirror.offsetHeight - height) > 1) {
            mirror.style.height = `${height}px`;
            mirror.style.minHeight = `${height}px`;
          }
        });
      };
      geometryObserver = new ResizeObserver(syncGeometry);
      originalSections.forEach(section => geometryObserver?.observe(section));
      const header = page.querySelector<HTMLElement>(".ap-header[data-landing-header]");
      if (header) geometryObserver.observe(header);
      syncGeometry();
      window.addEventListener("resize", updateImagesForViewport, { passive: true });
      setCapture(controller);
    } catch {
      geometryObserver?.disconnect();
      controller?.destroy();
      source?.remove();
      if (mounted) setCapture(null);
    }
    return () => {
      mounted = false;
      setCapture(null);
      window.removeEventListener("resize", updateImagesForViewport);
      geometryObserver?.disconnect();
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
