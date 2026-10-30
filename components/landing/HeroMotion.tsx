"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/** One-time hero entrance. Static markup remains visible before hydration. */
export function HeroMotion() {
  useLayoutEffect(() => {
    const hero = document.querySelector<HTMLElement>(".sh-hero");
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.08 })
        .from("[data-hero-entrance]", { autoAlpha: 0, y: 20, duration: 0.66, stagger: 0.11 })
        .from(".sh-inbox-stage", { autoAlpha: 0, x: -18, y: 12, scale: 0.97, duration: 0.85 }, "-=0.55")
        .from("[data-hero-message]", { autoAlpha: 0, y: 12, duration: 0.46, stagger: 0.14 }, "-=0.33")
        .from("[data-hero-float]", { autoAlpha: 0, y: 13, scale: 0.96, duration: 0.55, stagger: 0.13 }, "-=0.25");
    }, hero);
    return () => context.revert();
  }, []);
  return null;
}
