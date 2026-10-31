"use client";

import { useEffect } from "react";

/** A single gentle first-load fade. Words never move or reflow. */
export function HeroAssembly() {
  useEffect(() => {
    const html = document.documentElement;
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    if (!title) {
      html.dataset.dairaHero = "done";
      return;
    }
    const finish = () => {
      html.dataset.dairaHero = "done";
      title.removeAttribute("data-liquid-glass-ignore");
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    let active = true;
    let frame = 0;
    let nextFrame = 0;
    let safetyTimer = 0;
    const complete = (event: AnimationEvent) => {
      if (event.target === title && event.animationName === "daira-hero-fade") finish();
    };
    title.addEventListener("animationend", complete);

    // Font readiness prevents the text shape changing during its fade.
    void Promise.race([
      document.fonts.ready.catch(() => undefined),
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
    ]).then(() => {
      if (!active) return;
      frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => {
          if (!active) return;
          html.dataset.dairaHero = "play";
          safetyTimer = window.setTimeout(finish, 2300);
        });
      });
    });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
      clearTimeout(safetyTimer);
      title.removeEventListener("animationend", complete);
      title.removeAttribute("data-liquid-glass-ignore");
      html.dataset.dairaHero = "done";
    };
  }, []);

  return null;
}
