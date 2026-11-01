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

export function LiquidHeaderSurface({ variant = "header" }: { variant?: "header" | "menu" }) {
  const menu = variant === "menu";
  const capture = useLandingGlassCapture();
  const frameRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceBound, setSourceBound] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
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

  // Refractive frames remain mounted; no canvas readbacks, scroll-driven
  // fingerprinting or forced CSS blur. The native renderer owns its source.

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
    <div ref={frameRef} className={menu ? "daira-menu-glass-frame" : "daira-library-glass-frame"}
      data-glass-ready={ready ? "true" : "false"}
      data-optical-strategy={strategy}
      data-optical-source-bound={sourceBound ? "true" : "false"}
      data-optical-ever-ready={everReady ? "true" : "false"}>
      <span className="daira-library-glass-live-fallback" aria-hidden="true" />
      <LiquidGlass
        {...optics}
        backdropRef={backdropRef}
        radius={menu ? 28 : 26}
        onDiagnosticsChange={onDiagnosticsChange}
        className={menu ? "daira-menu-liquid-optics" : "daira-library-liquid-header"}
        style={{ position: "absolute", pointerEvents: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
