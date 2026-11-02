"use client";

import { useEffect } from "react";

/** Velora-inspired BlurFade. No new Motion runtime, WebGL layer or scroll
 * re-capture: transform and opacity are driven by a single observer.
 * Contents remain visible without JS and under reduced-motion settings. */
export function VeloraReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-dv-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach(node => node.dataset.dvVisible = "true");
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const node = entry.target as HTMLElement;
        node.dataset.dvVisible = "true";
        observer.unobserve(node);
      });
    }, { rootMargin: "0px 0px -9% 0px", threshold: .06 });
    nodes.forEach((node, index) => {
      const rect = node.getBoundingClientRect();
      if (rect.top < innerHeight * .94 && rect.bottom > 0) {
        node.dataset.dvVisible = "true";
      } else {
        node.style.setProperty("--dv-stagger", String(Math.min(index % 4, 3)));
        observer.observe(node);
      }
    });
    root.dataset.dvMotionReady = "true";
    return () => {
      observer.disconnect();
      delete root.dataset.dvMotionReady;
      nodes.forEach(node => node.style.removeProperty("--dv-stagger"));
    };
  }, []);
  return null;
}
