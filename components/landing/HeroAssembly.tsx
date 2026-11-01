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
    const stickers = Array.from(title.querySelectorAll<HTMLElement>(".ap-hero__sticker-bg"));
    const description = document.querySelector<HTMLElement>("[data-hero-description]");
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
    if (heroEntranceFinished) {
      gsap.set(words, { clearProps: "opacity,transform" });
      gsap.set(stickers, { clearProps: "opacity,transform" });
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
      gsap.set(words, { clearProps: "opacity,transform" });
      gsap.set(stickers, { clearProps: "opacity,transform" });
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

    // Seven masked label pops in natural RTL reading order.
    // A brief pale-blue backing wipe makes each word feel stamped onto
    // the page, then vanishes, leaving the clean original typography.
    gsap.set(title, { opacity: 1 });
    gsap.set(words, {
      opacity: 0, yPercent: 108, scale: .9, rotation: 5,
      transformOrigin: "50% 95%", force3D: false
    });
    gsap.set(stickers, { opacity: 0, scaleX: 0, transformOrigin: "100% 50%" });
    title.dataset.gsapHero = "playing";
    title.dataset.gsapHeroStarted = String(performance.now());
    html.dataset.dairaHero = "playing";
    const timeline = gsap.timeline({ onComplete: finish });
    words.forEach((word, i) => {
      const at = i * .145;
      const background = stickers[i];
      if (background) {
        timeline.to(background, {
          opacity: .95, scaleX: 1, duration: .27, ease: "power2.out"
        }, at);
        timeline.to(background, { opacity: 0, duration: .32, ease: "sine.out" }, at + .38);
      }
      timeline.to(word, {
        yPercent: 0, opacity: 1, rotation: 0, scale: 1,
        force3D: false, duration: .66, ease: "back.out(1.25)"
      }, at + .07);
    });
    if (description) timeline.fromTo(description,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: .52, ease: "power2.out" }, .9);
    if (cta) timeline.fromTo(cta,
      { opacity: 0, y: 15, scale: .97 },
      { opacity: 1, y: 0, scale: 1, duration: .57, ease: "power2.out" }, 1.06);

    return () => {
      timeline.kill();
      // Cleanup is not completion: React immediately replays this effect in
      // Strict Mode. Allow the surviving timeline to run normally.
      if (!completed) {
        gsap.set(words, { clearProps: "opacity,transform" });
      gsap.set(stickers, { clearProps: "opacity,transform" });
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
