"use client";

import LiquidGlass from "simple-liquid-glass";

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
    sheen: 1.85,
    sheenWidth: 6,
    sheenAngle: -38,
    specular: 2.30,
    glow: .14,
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
  return (
    <LiquidGlass
      {...optics}
      radius={26}
      className="daira-library-liquid-header"
      style={{ position: "absolute", pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}
