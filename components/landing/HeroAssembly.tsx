"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/** A single, first-load-only GSAP timeline in natural RTL word order.
 * No delayed dynamic import, document.fonts.ready gate, duplicate timeline,
 * positional tween, CSS keyframes, or scroll-based replay. */
export function HeroAssembly() {
  const played = useRef(false);

  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const html = document.documentElement;
    if (!title) { html.dataset.dairaHero = "done"; return; }
    if (played.current) return;
    played.current = true;
    const words = Array.from(title.querySelectorAll<HTMLElement>("[data-hero-word]"));
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      gsap.set(words, { clearProps: "opacity" });
      html.dataset.dairaHero = "done";
      title.dataset.gsapHero = "complete";
      if (title.dataset.gsapHeroStarted) {
        title.dataset.gsapHeroElapsed = String(Math.round(performance.now() - Number(title.dataset.gsapHeroStarted)));
      }
      title.removeAttribute("data-liquid-glass-ignore");
    };
    if (!words.length || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    // Render already contains the final line layout. CSS hides only word
    // opacity before hydration, so GSAP can start immediately and smoothly.
    gsap.set(words, { opacity: 0 });
    title.dataset.gsapHero = "playing";
    title.dataset.gsapHeroStarted = String(performance.now());
    html.dataset.dairaHero = "playing";
    const timeline = gsap.timeline({ onComplete: finish, defaults: { ease: "power2.out" } });
    timeline.to(words, {
      opacity: 1,
      duration: 1.18,
      stagger: { each: 0.16, from: "start" },
      overwrite: "auto"
    }, 0);

    return () => {
      timeline.kill();
      finish();
    };
  }, []);

  return null;
}
