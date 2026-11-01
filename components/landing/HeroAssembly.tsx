"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/** A single, first-load-only GSAP timeline in natural RTL word order.
 * No delayed dynamic import, document.fonts.ready gate, duplicate timeline,
 * positional tween, CSS keyframes, or scroll-based replay. */
// Only a completed hero entrance counts as played. Development Strict Mode
// first tears down an effect before its GSAP timeline can finish.
let heroEntranceFinished = false;

export function HeroAssembly() {

  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const html = document.documentElement;
    if (!title) { html.dataset.dairaHero = "done"; return; }
    const words = Array.from(title.querySelectorAll<HTMLElement>("[data-hero-word]"));
    const description = document.querySelector<HTMLElement>("[data-hero-description]");
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
    if (heroEntranceFinished) {
      gsap.set(words, { clearProps: "opacity" });
      gsap.set(title, { clearProps: "opacity" });
      gsap.set([description, cta].filter(Boolean), { clearProps: "opacity,transform" });
      html.dataset.dairaHero = "done";
      title.dataset.gsapHero = "complete";
      title.removeAttribute("data-liquid-glass-ignore");
      return;
    }
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      heroEntranceFinished = true;
      gsap.set(words, { clearProps: "opacity" });
      gsap.set([description, cta].filter(Boolean), { clearProps: "opacity,transform" });
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
    // A single composited alpha fade is markedly cheaper than seven
    // concurrent word tweens over the live optical header in Safari.
    gsap.set(words, { opacity: 1 });
    gsap.set(title, { opacity: 0 });
    title.dataset.gsapHero = "playing";
    title.dataset.gsapHeroStarted = String(performance.now());
    html.dataset.dairaHero = "playing";
    const timeline = gsap.timeline({ onComplete: finish, defaults: { ease: "power2.out" } });
    timeline.to(title, {
      opacity: 1,
      duration: .92,
      ease: "sine.out",
      overwrite: "auto"
    }, 0);
    if (description) timeline.fromTo(description,
      { opacity: 0 }, { opacity: 1, duration: .68, ease: "sine.out" }, .17);
    if (cta) timeline.fromTo(cta,
      { opacity: 0 }, { opacity: 1, duration: .62, ease: "sine.out" }, .32);

    return () => {
      timeline.kill();
      // Cleanup is not completion: React immediately replays this effect in
      // Strict Mode. Allow the surviving timeline to run normally.
      if (!completed) {
        gsap.set(words, { clearProps: "opacity" });
        gsap.set([description, cta].filter(Boolean), { clearProps: "opacity,transform" });
        html.dataset.dairaHero = "pending";
        title.dataset.gsapHero = "pending";
        title.removeAttribute("data-gsap-hero-started");
        title.removeAttribute("data-gsap-hero-elapsed");
      }
    };
  }, []);

  return null;
}
