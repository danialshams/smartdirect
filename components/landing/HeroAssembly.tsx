"use client";

import { useEffect } from "react";

/**
 * The RTL sentence is laid out at its final position before hydration.
 * GSAP alone controls the first-entry opacity of each word from RIGHT to LEFT.
 * No CSS keyframes, translates, layout animation or repeated scroll replay.
 */
export function HeroAssembly() {
  useEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const html = document.documentElement;
    if (!title) { html.dataset.dairaHero = "done"; return; }
    const words = Array.from(title.querySelectorAll<HTMLElement>("[data-hero-word]"));
    let active = true;
    let finished = false;
    let release: (() => void) | undefined;
    let safety: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      html.dataset.dairaHero = "done";
      title.dataset.gsapHero = "complete";
      if (title.dataset.gsapHeroStarted) title.dataset.gsapHeroElapsed = String(Math.round(performance.now() - Number(title.dataset.gsapHeroStarted)));
      title.removeAttribute("data-liquid-glass-ignore");
    };

    if (!words.length || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    // Don't block the entire page on remote font downloads. This brief grace
    // period avoids the old font swap mid-animation on most connections.
    const fonts = Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, 900)),
    ]);
    safety = setTimeout(() => { if (active) finish(); }, 5000);
    void Promise.all([import("gsap"), fonts]).then(([module]) => {
      if (!active || finished) return;
      const gsap = module.gsap;
      const context = gsap.context(() => {
        // Keep word boxes in normal RTL text flow. The first span is the
        // right-most Persian word; opacity stagger gives the requested motion.
        gsap.set(words, { opacity: 0 });
        title.dataset.gsapHero = "playing";
        title.dataset.gsapHeroStarted = String(performance.now());
        html.dataset.dairaHero = "playing";
        gsap.timeline({ onComplete: finish })
          .to(words, {
            opacity: 1,
            duration: 1.22,
            stagger: 0.19,
            ease: "power2.out",
            overwrite: "auto"
          }, 0);
      }, title);
      release = () => context.revert();
    }).catch(() => { if (active) finish(); });

    return () => {
      active = false;
      if (safety !== undefined) clearTimeout(safety);
      release?.();
      finish();
    };
  }, []);

  return null;
}
