"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Native CSS/SVG backdrop refraction in Chromium; for WebKit/Gecko render a
 * full-page DOM mirror once, and move it using a compositor-only transform.
 *
 * Previous html-to-image/WebGL scene snapshots were captured tile-by-tile
 * AFTER entering the viewport, throttled while scrolling and invalidated on
 * every reveal animation. This renderer has no scrolling capture queue.
 *
 * The fallback's copy is static intentionally: the marketing page does not
 * contain live user data, and all preview illustrations are deterministic.
 */
type OpticalMode = "pending" | "native" | "mirror";
type Props = { className: string; variant: "header" | "backtop" };

const docSelector = ":scope > main, :scope > section.ap-showcase-capture, :scope > footer.ap-footer";
const isNative = () => {
  const ua = navigator.userAgent;
  // SVG filters are supported as backdrop filters in Blink, not WebKit/Gecko.
  return /(?:Chrome|Chromium|Edg|OPR)\//.test(ua)
    && !/(?:CriOS|FxiOS|EdgiOS)\//.test(ua)
    && CSS.supports("backdrop-filter", "url(#daira-optical-displacement)");
};

const twoFrames = () => new Promise<void>(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export function LiveOpticalSurface({ className, variant }: Props) {
  const [mode, setMode] = useState<OpticalMode>("pending");
  const surface = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let raf = 0;
    let observer: ResizeObserver | undefined;
    let mirror: HTMLDivElement | undefined;

    const applyPosition = () => {
      raf = 0;
      if (!mirror || !surface.current) return;
      const site = document.querySelector<HTMLElement>(".ap-site");
      const originalMain = site?.querySelector<HTMLElement>(":scope > main");
      const panelRect = surface.current.getBoundingClientRect();
      const mainTop = originalMain ? originalMain.getBoundingClientRect().top + window.scrollY : 0;
      const siteLeft = site?.getBoundingClientRect().left ?? 0;
      mirror.style.left = `${siteLeft - panelRect.left}px`;
      mirror.style.top = `${mainTop - panelRect.top}px`;
      mirror.style.transform = `translate3d(0,${-window.scrollY}px,0)`;
    };
    const schedulePosition = () => {
      if (!raf) raf = requestAnimationFrame(applyPosition);
    };

    if (isNative()) {
      // Do not show a half-initialized filtered layer during hydration.
      requestAnimationFrame(() => { if (active) setMode("native"); });
    } else {
      const prepare = async () => {
        // Build the entire visual source before showing any refracted pixels.
        await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1200))]);
        if (!active || !windowRef.current || !surface.current) return;
        const site = document.querySelector<HTMLElement>(".ap-site");
        if (!site) return;
        mirror = document.createElement("div");
        mirror.className = "ap-site ap-optical-document";
        mirror.setAttribute("aria-hidden", "true");
        mirror.setAttribute("inert", "");
        const nodes = Array.from(site.querySelectorAll<HTMLElement>(docSelector));
        for (const node of nodes) {
          const copy = node.cloneNode(true) as HTMLElement;
          copy.removeAttribute("id");
          copy.querySelectorAll<HTMLElement>("[id]").forEach(child => child.removeAttribute("id"));
          copy.querySelectorAll<HTMLElement>("[data-reveal]").forEach(child => child.setAttribute("data-visible", "true"));
          copy.querySelectorAll<HTMLImageElement>("img").forEach(img => {
            img.loading = "eager";
            img.decoding = "async";
          });
          mirror.appendChild(copy);
        }
        if (!active) return;
        windowRef.current.appendChild(mirror);
        applyPosition();
        // First layout and paint of all cloned sections are finished before
        // the fallback begins drawing through the refractive SVG filter.
        await twoFrames();
        if (!active) return;
        setMode("mirror");
        window.addEventListener("scroll", schedulePosition, { passive: true });
        window.addEventListener("resize", schedulePosition, { passive: true });
        observer = new ResizeObserver(schedulePosition);
        observer.observe(surface.current!);
      };
      void prepare();
    }

    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("resize", schedulePosition);
      observer?.disconnect();
      mirror?.remove();
    };
  }, []);

  return (
    <div ref={surface} className={`ap-optical-surface ap-optical-surface--${variant} ${className}`} data-optics-mode={mode} aria-hidden="true">
      <span className="ap-optical-native" />
      <div className="ap-optical-mirror" ref={windowRef} />
      <span className="ap-optical-tint" />
    </div>
  );
}

/** Definition available in server-rendered HTML before effects are activated. */
export function LiveOpticsDefinitions() {
  return (
    <svg className="ap-optical-definitions" width="0" height="0" focusable="false" aria-hidden="true">
      <defs>
        <filter id="daira-optical-displacement" x="-6%" y="-30%" width="112%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.018" numOctaves="1" seed="8" result="daira-noise" />
          <feDisplacementMap in="SourceGraphic" in2="daira-noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
