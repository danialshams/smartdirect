"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * Sequence: product appears first, then its UI pieces arrive from alternating
 * sides, then headline/CTA. Persistent hover is CSS-only to avoid JS loops.
 */
export function HeroMotion() {
  useLayoutEffect(() => {
    const hero = document.querySelector<HTMLElement>(".sh-hero");
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.08 })
        .from(".sh-inbox-stage", { autoAlpha: 0, x: -65, y: 8, duration: 0.8 })
        .from("[data-hero-panel]", { autoAlpha: 0, x: -38, scale: 0.965, duration: 0.72 }, "-=0.5")
        .from("[data-hero-bar]", { autoAlpha: 0, y: -12, duration: 0.4 }, "-=0.45")
        .from("[data-hero-threads]", { autoAlpha: 0, x: 52, duration: 0.62 }, "-=0.4")
        .from("[data-hero-chat]", { autoAlpha: 0, x: -35, duration: 0.5 }, "-=0.38")
        .from("[data-hero-incoming]", { autoAlpha: 0, x: 55, duration: 0.54 }, "-=0.26")
        .from("[data-hero-outgoing]", { autoAlpha: 0, x: -55, duration: 0.54 }, "-=0.28")
        .from(".sh-inbox-float--new", { autoAlpha: 0, x: 75, y: -12, duration: 0.62 }, "-=0.33")
        .from(".sh-inbox-float--sent", { autoAlpha: 0, x: -75, y: 12, duration: 0.62 }, "-=0.36")
        .from("[data-hero-entrance]", { autoAlpha: 0, y: 24, duration: 0.68, stagger: 0.105 }, "-=0.42");
    }, hero);
    return () => ctx.revert();
  }, []);

  return null;
}
