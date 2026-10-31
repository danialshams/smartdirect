"use client";

import { useEffect, useRef, useState } from "react";
import { LiveOpticalSurface, prepareOpticalMaps } from "./LiveOptics";

/**
 * A new, independent optical material for the landing header.
 *
 * The old single LiquidGlass element produced flat acrylic: it showed a
 * backdrop warp but no readable lens volume on bright content. Here the
 * refracted LIVE backdrop, volumetric edge shading, caustic glints and
 * specular streaks are distinct layers. No white opaque sheet or hard border.
 *
 * On Blink, native SVG backdrop-filter reads pixels actually scrolling behind
 * the header. On Safari/Firefox, keep the prewarmed DOM-mirror fallback.
 */
type Mode = "preparing" | "native" | "mirror";

export function LiquidHeaderSurface() {
  const [mode, setMode] = useState<Mode>("preparing");
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const updateLighting = () => {
      frame = 0;
      const root = surface.current;
      if (!root) return;
      // Move the reflected light within the stationary lens as the page
      // moves below it. This only updates a compositor-transformed layer.
      const y = window.scrollY;
      root.style.setProperty("--liquid-light-x", `${Math.sin(y / 245) * 15}px`);
      root.style.setProperty("--liquid-light-y", `${Math.sin(y / 340) * 3}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateLighting);
    };
    prepareOpticalMaps();
    const ua = navigator.userAgent;
    const blink = /(?:Chrome|Chromium|Edg|OPR)\//.test(ua)
      && !/(?:CriOS|FxiOS|EdgiOS)\//.test(ua)
      && CSS.supports("backdrop-filter", "url(#daira-optical-displacement)");
    setMode(blink ? "native" : "mirror");
    updateLighting();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={surface}
      className="ap-header__backdrop ap-liquid-header"
      data-liquid-header={mode}
      aria-hidden="true"
    >
      {mode === "mirror" ? (
        <LiveOpticalSurface variant="header" className="ap-liquid-header__fallback" />
      ) : (
        <span className="ap-liquid-header__refraction" />
      )}
      <span className="ap-liquid-header__volume" />
      <span className="ap-liquid-header__edge" />
      <span className="ap-liquid-header__glint" />
    </div>
  );
}
