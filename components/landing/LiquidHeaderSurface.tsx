"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLandingGlassCapture } from "./LandingGlassBackdrop";
import LiquidGlass, { type LiquidGlassHandle, type RenderingDiagnostics } from "simple-liquid-glass";

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
    bendWidth: .20,
    sheen: .88,
    sheenWidth: 4,
    sheenAngle: -38,
    specular: 1.03,
    glow: .06,
    glowSpread: .48,
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
  const panelRef = useRef<LiquidGlassHandle>(null);
  const backdropRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceBound, setSourceBound] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const [strategy, setStrategy] = useState("pending");

  useLayoutEffect(() => {
    const element = panelRef.current?.element;
    if (!capture || !element) return;
    // An explicit library backdrop source prevents its scene-hook from
    // destroying the WebGL GPU renderer whenever a new tile is incomplete.
    const registration = capture.register(element, setCaptureReady);
    backdropRef.current = registration.canvas;
    setSourceBound(true);
    return () => {
      backdropRef.current = null;
      registration.release();
    };
  }, [capture]);

  const onDiagnosticsChange = useCallback((next: RenderingDiagnostics) => {
    setStrategy(previous => previous === next.strategy ? previous : next.strategy);
  }, []);
  const opticalReady = strategy === "svg" || (strategy === "webgl" && sourceBound);
  const ready = opticalReady && (!capture || captureReady);

  return (
    <div className="daira-library-glass-frame"
      data-glass-ready={ready ? "true" : "false"}
      data-optical-strategy={strategy}>
      <span className="daira-library-glass-live-fallback" aria-hidden="true" />
      <LiquidGlass
        {...optics}
        ref={panelRef}
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
