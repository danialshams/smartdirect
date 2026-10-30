"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * Sequence: product appears first, then its UI pieces arrive from alternating
 * sides, then headline/CTA. Persistent hover is CSS-only to avoid JS loops.
 */
export function HeroMotion() {
  // Home is a fresh marketing entry; do not briefly restore an old scroll
  // offset from the bottom of the page on reload/back-forward without a hash.
  useLayoutEffect(() => {
    if (window.location.hash) return;
    const prior = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const reset = () => window.scrollTo(0, 0);
    reset();
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.history.scrollRestoration = prior;
    };
  }, []);

  useLayoutEffect(() => {
    const hero = document.querySelector<HTMLElement>(".sh-hero");
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.04 })
        // Keep optical backdrops visible: opacity on a glass ancestor breaks refraction.
        .from(".sh-inbox-stage", { x: -52, y: 12, duration: 0.7 })
        .from("[data-hero-panel]", { x: -30, scale: 0.975, duration: 0.65 }, "-=0.54")
        // Text/CTA and product land together, rather than in two separate screens.
        .from("[data-hero-entrance]", { y: 18, duration: 0.53, stagger: 0.055 }, "-=0.64")
        .from("[data-hero-bar]", { y: -9, duration: 0.38 }, "-=0.56")
        .from("[data-hero-threads]", { x: 42, duration: 0.55 }, "-=0.4")
        .from("[data-hero-chat]", { x: -32, duration: 0.49 }, "-=0.43")
        .from("[data-hero-incoming]", { x: 42, duration: 0.52 }, "-=0.34")
        .from("[data-hero-outgoing]", { x: -42, duration: 0.52 }, "-=0.41")
        .from(".sh-inbox-float--new", { x: 52, y: -9, duration: 0.56 }, "-=0.45")
        .from(".sh-inbox-float--sent", { x: -52, y: 9, duration: 0.56 }, "-=0.5");
    }, hero);
    return () => context.revert();
  }, []);

  return null;
}
