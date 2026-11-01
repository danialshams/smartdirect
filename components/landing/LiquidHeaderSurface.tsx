"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLandingGlassCapture } from "./LandingGlassBackdrop";
import LiquidGlass, { type RenderingDiagnostics } from "simple-liquid-glass";

/**
 * The header is ONE native optical lens from simple-liquid-glass 5.4.
 * No nested homegrown refraction layer, tint overlay, manually painted
 * specular rim, injected filter or forced pixel displacement override.
 *
 * These values restore the physically refractive loupe used before the
 * scroll-performance patch. On Chromium the library samples the LIVE
 * scrolling backdrop; on iOS/Safari it gets its source from LiquidGlassScene.
 */
const optics = {
  renderer: "svg" as const,
  refraction: "lens" as const,
  lensProfile: "loupe" as const,
  lensOptions: {
    strength: .115,
    depth: .52,
    curvature: .69,
    bend: .66,
    bendWidth: .085,
    sheen: .88,
    sheenWidth: 4,
    sheenAngle: -38,
    specular: 1.03,
    glow: .06,
    glowSpread: .30,
    glowFalloff: 1.60,
    brightness: -.018,
  },
  quality: "high" as const,
  frost: 0,
  blur: 0,
  scale: 118,
  saturation: 125,
  dispersion: 20,
  aberrationIntensity: .15,
  borderColor: "rgba(255,255,255,0)",
  glassColor: "rgba(255,255,255,.018)",
  background: "rgba(255,255,255,.01)",
};

export function LiquidHeaderSurface() {
  const capture = useLandingGlassCapture();
  const frameRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceBound, setSourceBound] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const captureReadyRef = useRef(captureReady);
  captureReadyRef.current = captureReady;
  const [everReady, setEverReady] = useState(false);
  const [strategy, setStrategy] = useState("pending");

  useLayoutEffect(() => {
    // Bind the stable frame, NOT the library's deferred inner optical ref.
    // React has committed this frame before a layout effect runs, whereas the
    // LiquidGlass root can appear later (reveal/hydration). The old one-shot
    // inner ref lookup could fail permanently, leaving the renderer in
    // missing-backdrop blur mode even though a valid scene was available.
    const frame = frameRef.current;
    if (!capture || !frame) return;
    let active = true;
    const registration = capture.register(frame, nextReady => {
      if (active) setCaptureReady(previous => previous === nextReady ? previous : nextReady);
    });
    backdropRef.current = registration.canvas;
    setSourceBound(true);
    return () => {
      active = false;
      backdropRef.current = null;
      registration.release();
    };
  }, [capture]);

  useEffect(() => {
    // WebKit cannot sample a live webpage for SVG backdrop displacement.
    // During a VERY FAST jump its WebGL engine may retain the last captured
    // frame while html-to-image prepares the newly visible tile. Avoid
    // displaying those old pixels as though they belonged to the new area.
    // This only activates during high-velocity scrolls; normal glass remains
    // native WebGL at full optical strength.
    if (strategy !== "webgl" || !sourceBound) return;
    const frame = frameRef.current;
    const canvas = backdropRef.current;
    if (!frame || !canvas) return;
    let previousY = scrollY;
    let previousAt = performance.now();
    let lastMove = 0;
    let started = 0;
    let originalHash: number | undefined;
    let initialCaptureCount = 0;
    let active = false;
    let raf = 0;
    let lastSample = 0;
    const fingerprint = () => {
      try {
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) return 0;
        let hash = 2166136261;
        // Three thin strips catch changes in different parts of the lens;
        // one row often contained only the page's repeated white background.
        for (const part of [0.28, 0.5, 0.72]) {
          const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * part)));
          const bytes = context.getImageData(0, y, canvas.width, 1).data;
          for (let i = 0; i < bytes.length; i += 12) {
            hash = Math.imul(hash ^ bytes[i], 16777619);
            hash = Math.imul(hash ^ bytes[i+1], 16777619);
            hash = Math.imul(hash ^ bytes[i+2], 16777619);
          }
        }
        return hash >>> 0;
      } catch { return 0; }
    };
    const tick = (at: number) => {
      if (!active) return;
      if (at-lastSample > 90) {
        lastSample = at;
        const updated = originalHash !== undefined && fingerprint() !== originalHash;
        const capturedNew = Number(document.querySelector(".ap-site[data-liquid-glass-scene]")?.getAttribute("data-liquid-glass-captures") ?? 0) > initialCaptureCount;
        const settled = at - lastMove > 150;
        // Keep the underlying WebGL renderer alive; as soon as it presents a
        // fresh canvas and the capture is ready, show it without re-mounting.
        if (settled && captureReadyRef.current && (updated || capturedNew)) {
          active = false;
          frame.dataset.glassFastStale = "false";
          return;
        }
        if (at - lastMove > 2800) {
          active = false;
          frame.dataset.glassFastStale = "false";
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const at = performance.now();
      const y = scrollY;
      const delta = Math.abs(y - previousY);
      const velocity = delta / Math.max(12, at - previousAt);
      previousY = y; previousAt = at;
      if (delta < 150 && velocity < 1.15 && !active) return;
      lastMove = at;
      if (active) return;
      active = true;
      started = at;
      originalHash = fingerprint();
      initialCaptureCount = Number(document.querySelector(".ap-site[data-liquid-glass-scene]")?.getAttribute("data-liquid-glass-captures") ?? 0);
      frame.dataset.glassFastStale = "true";
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      frame.dataset.glassFastStale = "false";
    };
  }, [strategy, sourceBound]);

  const onDiagnosticsChange = useCallback((next: RenderingDiagnostics) => {
    setStrategy(previous => previous === next.strategy ? previous : next.strategy);
  }, []);
  const opticalReady = strategy === "svg" || (strategy === "webgl" && sourceBound);
  // Once the native lens has rendered a complete scene, a newly arriving
  // adjacent section must not cause the CSS fallback to flash over/behind it.
  // The official WebGL renderer continues presenting live frames while the
  // next tile captures, so keep the material optical after first success.
  useEffect(() => {
    if (opticalReady && (!capture || captureReady)) setEverReady(true);
  }, [opticalReady, capture, captureReady]);
  const ready = opticalReady && (everReady || !capture || captureReady);

  return (
    <div ref={frameRef} className="daira-library-glass-frame"
      data-glass-ready={ready ? "true" : "false"}
      data-optical-strategy={strategy}
      data-optical-source-bound={sourceBound ? "true" : "false"}
      data-optical-ever-ready={everReady ? "true" : "false"}>
      <span className="daira-library-glass-live-fallback" aria-hidden="true" />
      <LiquidGlass
        {...optics}
        backdropRef={backdropRef}
        radius={26}
        onDiagnosticsChange={onDiagnosticsChange}
        className="daira-library-liquid-header"
        style={{ position: "absolute", pointerEvents: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
