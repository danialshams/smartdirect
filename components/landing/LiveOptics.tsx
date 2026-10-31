"use client";

import { useEffect, useRef, useState } from "react";
import LiquidGlass from "simple-liquid-glass";

/**
 * Native CSS/SVG backdrop refraction in Chromium; for WebKit/Gecko render a
 * full-page DOM mirror once, and move it using a compositor-only transform.
 *
 * Previous screenshot-based snapshots were captured tile-by-tile
 * AFTER entering the viewport, throttled while scrolling and invalidated on
 * every reveal animation. This renderer has no scrolling capture queue.
 *
 * The fallback's copy is static intentionally: the marketing page does not
 * contain live user data, and all preview illustrations are deterministic.
 */
type OpticalMode = "pending" | "native" | "mirror";
type Props = { className: string; variant: "header" | "backtop" };

const docSelector = ":scope > main, :scope > section.ap-showcase-capture, :scope > footer.ap-footer";

/**
 * Restore the actual library's optical lens on Chromium. Its native SVG
 * renderer reads live pixels behind the element: no capture queue and no
 * cached snapshot. The previous handwritten feDisplacementMap was a flat
 * approximation that looked transparent rather than liquid.
 */
/**
 * Optical baseline restored from commit c4ac4a8, before PR #174 turned off
 * the caustics and PR #175 replaced the scene and lens profiles. Loupe uses
 * a stronger edge bend, narrow dispersion and directional specular lighting.
 *
 * Chromium samples the actual live backdrop with SVG. Do not force WebGL:
 * it requires asynchronous DOM captures and had produced delayed reflections.
 */
const headerLens = {
  renderer: "svg" as const,
  refraction: "lens" as const,
  lensProfile: "loupe" as const,
  quality: "high" as const,
  mobileFallback: "svg" as const,
  // Keep physical lens geometry, never overlay a white or blue fake glass.
  displacementScale: 32,
  frost: 0,
  blur: 0,
  saturation: 120,
  dispersion: 24,
  aberrationIntensity: .16,
  border: 0,
  borderColor: "rgba(255,255,255,.33)",
  glassColor: "rgba(255,255,255,.038)",
  lensOptions: {
    strength: .11,
    depth: .34,
    curvature: .55,
    bend: .55,
    bendWidth: .18,
    sheen: 1.32,
    sheenWidth: 6.5,
    sheenAngle: -34,
    specular: 1.65,
    glow: .09,
    glowSpread: .48,
    glowFalloff: 1.6,
    brightness: 0,
  },
};

const isNative = () => {
  const ua = navigator.userAgent;
  // SVG filters are supported as backdrop filters in Blink, not WebKit/Gecko.
  return /(?:Chrome|Chromium|Edg|OPR)\//.test(ua)
    && !/(?:CriOS|FxiOS|EdgiOS)\//.test(ua)
    && CSS.supports("backdrop-filter", "url(#daira-optical-displacement)");
};

/**
 * A real 2D displacement field, baked just once for each lens geometry.
 * R/G encode X/Y offsets (neutral = 128). The old random turbulence only
 * produced a barely perceptible uniform haze, not curved refraction.
 * Here light is bent towards the interior of the surface near every edge,
 * with a tiny non-repeating wave through the center.
 */
let mapsPrepared = false;
function prepareOpticalMaps() {
  if (mapsPrepared) return;
  for (const lens of [
    { id: "daira-header-map", width: 640, height: 88, edge: 17, shape: "rect" },
    { id: "daira-backtop-map", width: 96, height: 96, edge: 20, shape: "circle" },
  ] as const) {
    const image = document.getElementById(lens.id);
    if (!image) return; // Definitions mount with the landing root.
    const canvas = document.createElement("canvas");
    canvas.width = lens.width;
    canvas.height = lens.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const bitmap = ctx.createImageData(lens.width, lens.height);
    const pixels = bitmap.data;
    for (let y = 0; y < lens.height; y++) {
      for (let x = 0; x < lens.width; x++) {
        const u = (x + .5) / lens.width;
        const v = (y + .5) / lens.height;
        let vx: number;
        let vy: number;
        if (lens.shape === "circle") {
          const dx = u * 2 - 1;
          const dy = v * 2 - 1;
          const radius = Math.hypot(dx, dy);
          const edge = Math.pow(Math.max(0, 1 - Math.abs(1 - radius) / .42), 1.7);
          vx = radius > 0 ? (-dx / radius) * edge : 0;
          vy = radius > 0 ? (-dy / radius) * edge : 0;
        } else {
          const left = x;
          const right = lens.width - 1 - x;
          const top = y;
          const bottom = lens.height - 1 - y;
          const edgeX = Math.pow(Math.max(0, 1 - Math.min(left, right) / 39), 1.8);
          const edgeY = Math.pow(Math.max(0, 1 - Math.min(top, bottom) / lens.edge), 1.8);
          vx = (left < right ? 1 : -1) * edgeX;
          vy = (top < bottom ? 1 : -1) * edgeY;
        }
        const flow = Math.sin(u * 12 + v * 7) * Math.cos(v * 11 - u * 4);
        const i = (y * lens.width + x) * 4;
        pixels[i] = Math.max(0, Math.min(255, Math.round(128 + vx * 97 + flow * 7)));
        pixels[i + 1] = Math.max(0, Math.min(255, Math.round(128 + vy * 97 - flow * 6)));
        pixels[i + 2] = 128;
        pixels[i + 3] = 255;
      }
    }
    ctx.putImageData(bitmap, 0, 0);
    image.setAttribute("href", canvas.toDataURL("image/png"));
    image.setAttribute("data-map-prepared", "true");
  }
  mapsPrepared = true;
}

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

    const updateScrollTransform = () => {
      raf = 0;
      if (!mirror) return;
      mirror.style.transform = `translate3d(0,${-window.scrollY}px,0)`;
    };
    const positionMirror = () => {
      if (!mirror || !surface.current) return;
      const site = document.querySelector<HTMLElement>(".ap-site");
      const originalMain = site?.querySelector<HTMLElement>(":scope > main");
      const panelRect = surface.current.getBoundingClientRect();
      const mainTop = originalMain ? originalMain.getBoundingClientRect().top + window.scrollY : 0;
      const siteLeft = site?.getBoundingClientRect().left ?? 0;
      mirror.style.left = `${siteLeft - panelRect.left}px`;
      mirror.style.top = `${mainTop - panelRect.top}px`;
      updateScrollTransform();
    };
    const schedulePosition = () => {
      if (!raf) raf = requestAnimationFrame(updateScrollTransform);
    };

    if (isNative()) {
      // Do not show a half-initialized filtered layer during hydration.
      requestAnimationFrame(() => { if (active) setMode("native"); });
    } else {
      prepareOpticalMaps();
      const prepare = async () => {
        // Build the entire visual source before showing any refracted pixels.
        await Promise.all([
          Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1200))]),
          new Promise(resolve => setTimeout(resolve, 790)), // after CSS hero assembly
        ]);
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
        positionMirror();
        const images = Array.from(mirror.querySelectorAll<HTMLImageElement>("img"));
        await Promise.race([
          Promise.all(images.map(image => image.decode().catch(() => undefined))),
          new Promise(resolve => setTimeout(resolve, 1000)),
        ]);
        // Give the fully composed mirror two paints BEFORE exposing any glass.
        await twoFrames();
        if (!active) return;
        setMode("mirror");
        window.addEventListener("scroll", schedulePosition, { passive: true });
        window.addEventListener("resize", positionMirror, { passive: true });
        observer = new ResizeObserver(positionMirror);
        observer.observe(surface.current!);
      };
      void prepare();
    }

    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("resize", positionMirror);
      observer?.disconnect();
      mirror?.remove();
    };
  }, []);

  if (mode === "native") {
    const options = headerLens;
    return (
      <LiquidGlass
        {...options}
        radius={variant === "header" ? 26 : 28}
        className={`ap-native-liquid ap-native-liquid--${variant} ${className}`}
        style={{position:"absolute",inset:0,pointerEvents:"none"}}
        aria-hidden="true"
      />
    );
  }

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
        <filter id="daira-optical-displacement" x="-4%" y="-26%" width="108%" height="152%" colorInterpolationFilters="sRGB">
          <feImage id="daira-header-map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens-field" />
          <feDisplacementMap in="SourceGraphic" in2="lens-field" scale="36" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="daira-optical-backtop" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feImage id="daira-backtop-map" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lens-field" />
          <feDisplacementMap in="SourceGraphic" in2="lens-field" scale="17" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
