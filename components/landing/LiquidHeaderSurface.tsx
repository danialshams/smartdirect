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
    strength: .09,
    depth: .30,
    curvature: .48,
    bend: .51,
    bendWidth: .16,
    sheen: 1.12,
    sheenWidth: 7,
    sheenAngle: -30,
    specular: 1.35,
    glow: .08,
    glowSpread: .40,
    glowFalloff: 1.60,
    brightness: 0,
  },
  quality: "high" as const,
  frost: 0,
  blur: 0,
  scale: 135,
  saturation: 110,
  dispersion: 17,
  aberrationIntensity: .11,
  borderColor: "rgba(255,255,255,0)",
  glassColor: "rgba(255,255,255,.035)",
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
