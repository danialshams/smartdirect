"use client";

import { useEffect } from "react";

const SCENES = ["start", "features", "automations", "inbox", "publishing", "insights", "glass", "workspace"] as const;

/**
 * Progressive scroll enhancement. All content/links render on the server and
 * remain usable when JS, observers, animations or WebGL are unavailable.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".daira-landing");
    if (!root) return;
    const sections = SCENES.map((id) => document.getElementById(id)).filter((x): x is HTMLElement => Boolean(x));
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-progress-for]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let observer: IntersectionObserver | undefined;

    function sync() {
      frame = 0;
      if (!root) return;
      const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.max(0, Math.min(1, window.scrollY / range));
      root.style.setProperty("--dl-scroll", String(progress));
      root.classList.toggle("dl-has-scrolled", window.scrollY > 36);
      let active = 0;
      const targetY = window.innerHeight * 0.46;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= targetY) active = i;
      }
      // Scene-local camera movement, without React state updates.
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) continue;
        const local = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
        section.style.setProperty("--dl-drift", Math.round((local - 0.5) * 45) + "px");
        section.style.setProperty("--dl-spin", Math.round((local - 0.5) * 32) + "deg");
      }
      root.dataset.activeScene = SCENES[active];
      for (const link of links) {
        const selected = link.dataset.progressFor === SCENES[active];
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(sync);
    }

    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("dl-in-view");
            observer?.unobserve(entry.target);
          }
        }
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      sections.forEach((section) => observer?.observe(section));
    } else sections.forEach((section) => section.classList.add("dl-in-view"));

    sync();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      root.style.removeProperty("--dl-scroll");
    };
  }, []);

  return null;
}
