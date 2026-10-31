"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * A short, single compositor-only assembly. Ignore the moving text in scene
 * captures until it settles so each GSAP style mutation cannot enqueue another
 * expensive Safari/WebGL HTML snapshot. The finished headline is captured.
 */
export function HeroMotion() {
  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
    const revealInGlass = () => {
      title?.removeAttribute("data-liquid-glass-ignore");
      cta?.removeAttribute("data-liquid-glass-ignore");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealInGlass();
      return;
    }
    const context = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>("[data-hero-word]");
      if (!words.length) {
        revealInGlass();
        return;
      }
      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: () => {
          gsap.set(words, { clearProps: "transform,opacity,willChange" });
          if (cta) gsap.set(cta, { clearProps: "transform,opacity,willChange" });
          revealInGlass();
        },
      });
      timeline.fromTo(words, {
        x: (index) => [24, -19, 21, -18, 20, -16, 23][index % 7],
        y: (index) => [-10, 9, -8, 11, -9, 8, -10][index % 7],
        opacity: .45,
      }, {
        x: 0, y: 0, opacity: 1, duration: .58,
        stagger: { each: .027, from: "center" },
        force3D: false,
      }, 0);
      if (cta) timeline.fromTo(cta, { y: 9, opacity: .7 }, {
        y: 0, opacity: 1, duration: .38, force3D: false,
      }, .25);
    });
    return () => {
      context.revert();
      revealInGlass();
    };
  }, []);
  return null;
}
