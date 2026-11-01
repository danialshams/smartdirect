"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/** First-load compositor-only hero entrance. The headline does not jump,
 * scatter, or reflow: it simply fades in from its final RTL position. */
let heroEntranceFinished = false;

export function HeroAssembly() {
  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const description = document.querySelector<HTMLElement>("[data-hero-description]");
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
    const html = document.documentElement;
    if (!title) { html.dataset.dairaHero = "done"; return; }
    const words = Array.from(title.querySelectorAll<HTMLElement>("[data-hero-word]"));
    const others = [description, cta].filter((element): element is HTMLElement => !!element);
    if (heroEntranceFinished) {
      gsap.set([...words,...others], { clearProps: "opacity,visibility,transform" });
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
      gsap.set([...words,...others], { clearProps: "opacity,visibility,transform" });
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

    gsap.set(words, { opacity: 0 });
    gsap.set(others, { autoAlpha: 0 });
    title.dataset.gsapHero = "playing";
    title.dataset.gsapHeroStarted = String(performance.now());
    html.dataset.dairaHero = "playing";

    const timeline = gsap.timeline({ onComplete: finish, defaults: { ease: "power2.out" } });
    timeline.to(words, {
      opacity: 1, duration: .82,
      stagger: { each: .065, from: "start" },
      overwrite: "auto"
    }, 0);
    if (description) {
      timeline.fromTo(description,
        { autoAlpha: 0, y: 7 },
        { autoAlpha: 1, y: 0, duration: .66, overwrite: "auto" }, .29);
    }
    if (cta) {
      timeline.fromTo(cta,
        { autoAlpha: 0, y: 7 },
        { autoAlpha: 1, y: 0, duration: .66, overwrite: "auto" }, .46);
    }

    return () => {
      timeline.kill();
      // React Strict Mode tears down the first effect. Do not count a killed
      // entrance as finished, or leave words invisible when it replays.
      if (!completed) {
        gsap.set([...words,...others], { clearProps: "opacity,visibility,transform" });
        html.dataset.dairaHero = "pending";
        title.dataset.gsapHero = "pending";
        title.removeAttribute("data-gsap-hero-started");
        title.removeAttribute("data-gsap-hero-elapsed");
      }
    };
  }, []);
  return null;
}
