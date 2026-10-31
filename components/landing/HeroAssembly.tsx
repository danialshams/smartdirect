"use client";

import { useEffect } from "react";

/**
 * Start the Persian hero assembly only AFTER the landing page and its font
 * are ready. The old first-paint CSS animation had already finished by the
 * time visitors could see it, and its 20px offsets were barely perceptible.
 *
 * CSS owns the motion, not a GSAP rAF timeline. No scrolling DOM snapshots.
 */
export function HeroAssembly() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let frame2 = 0;
    let kick = 0;
    const html = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      html.dataset.dairaHero = "done";
      return;
    }

    html.dataset.dairaHero = "pending";
    const start = async () => {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 1400)),
      ]);
      if (!active) return;
      frame = requestAnimationFrame(() => {
        frame2 = requestAnimationFrame(() => {
          kick = window.setTimeout(() => {
            if (active) html.dataset.dairaHero = "play";
          }, 110);
        });
      });
    };
    void start();
    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      if (frame2) cancelAnimationFrame(frame2);
      if (kick) clearTimeout(kick);
      // Do not leave the heading scattered during a fast route transition.
      html.dataset.dairaHero = "done";
    };
  }, []);
  return null;
}
