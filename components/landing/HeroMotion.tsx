"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * One-shot entrance: the actual joined Persian text stays in one DOM node
 * so shaping/ligatures remain correct. Decorative glyphs converge separately.
 */
export function HeroMotion() {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      const pieces = gsap.utils.toArray<HTMLElement>("[data-hero-fragment]");
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" }, delay: .08 });
      timeline.from("[data-hero-assembly]", {
        y: 22, opacity: .05, filter: "blur(11px)", duration: 1.35,
        clearProps: "transform,opacity,filter"
      }, .2);
      timeline.from("[data-hero-word]", {
        x: (i) => Math.sin(i * 2.1) * (46 + i * 9),
        y: (i) => Math.cos(i * 1.5) * (39 + i * 8),
        rotation: (i) => i % 2 ? -7 : 6,
        filter: "blur(5px)", opacity: 0, duration: 1.2,
        stagger: { each: .055, from: "random" },
        clearProps: "transform,filter,opacity"
      }, .16);
      timeline.fromTo(pieces, {
        x: (i) => Math.sin(i * 2.47) * (95 + i * 9),
        y: (i) => Math.cos(i * 1.73) * (65 + i * 5),
        rotation: (i) => i % 2 ? -80 : 75,
        opacity: 0, scale: .55
      }, {
        x: 0, y: 0, rotation: 0, opacity: .67, scale: 1,
        duration: 1.15, stagger: { each: .045, from: "random" }
      }, 0);
      timeline.to(pieces, { opacity: 0, scale: .6, duration: .45, stagger: .018 }, .9);
      timeline.from("[data-hero-cta]", {
        y: 12, opacity: 0, duration: .65, clearProps: "transform,opacity"
      }, .95);
    });
    return () => context.revert();
  }, []);
  return null;
}
