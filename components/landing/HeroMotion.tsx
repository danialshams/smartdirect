"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * The robot manages its own multi-part assembly. The copy arrives alongside it,
 * without hiding the refraction surface or breaking reduced-motion preferences.
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
      // The robot owns the scattered assembly timeline. Copy enters in parallel.
      gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.16 })
        .from("[data-hero-entrance]", { y: 19, duration: 0.75, stagger: 0.09 }, 0);
    }, hero);
    return () => context.revert();
  }, []);

  return null;
}
