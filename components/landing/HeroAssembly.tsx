"use client";

import { useEffect } from "react";

/**
 * Text is always in its final RTL layout. Native per-word opacity keyframes
 * run from the very first paint, even before hydration or GSAP downloads.
 * The first Persian word on the RIGHT appears first; no word moves or reflows.
 */
export function HeroAssembly() {
  useEffect(() => {
    const html = document.documentElement;
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    if (!title) return;
    const words = title.querySelectorAll<HTMLElement>("[data-hero-word]");
    const last = words.item(words.length - 1);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      html.dataset.dairaHero = "done";
      title.removeAttribute("data-liquid-glass-ignore");
    };
    if (!last || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const onEnd = (event: AnimationEvent) => {
      if (event.target === last && event.animationName === "daira-hero-rtl-fade") finish();
    };
    last.addEventListener("animationend", onEnd);
    // A CSS animation still works without hydration. If WebKit loses an
    // animationend during page restoration, don't leave the title hidden.
    const safety = window.setTimeout(finish, 3500);
    return () => {
      last.removeEventListener("animationend", onEnd);
      clearTimeout(safety);
      finish();
    };
  }, []);

  return null;
}
