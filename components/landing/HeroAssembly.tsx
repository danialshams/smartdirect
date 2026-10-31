"use client";

import { useEffect } from "react";

/**
 * First-visit Persian word assembly: layout is always the FINAL sentence.
 * Only composited transforms/opacity move the words into place, so there is
 * no RTL line reflow, re-measuring or scroll-driven React render.
 */
export function HeroAssembly() {
  useEffect(() => {
    const html = document.documentElement;
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const lastWord = title?.querySelector<HTMLElement>("[data-hero-word]:last-child");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !title || !lastWord) {
      html.dataset.dairaHero = "done";
      return;
    }

    let active = true;
    let frame = 0;
    let nextFrame = 0;
    let startTimer = 0;
    let safetyTimer = 0;
    const finish = () => {
      if (!active) return;
      html.dataset.dairaHero = "done";
      title.removeAttribute("data-liquid-glass-ignore");
    };

    // Do not snapshot moving letters dozens of times on Safari. After the
    // one-shot assembly, one mutation lets the real scene capture the title.
    title.setAttribute("data-liquid-glass-ignore", "");
    const onEnd = (event: AnimationEvent) => {
      if (event.target === lastWord && event.animationName === "daira-word-assemble") finish();
    };
    lastWord.addEventListener("animationend", onEnd);

    const begin = async () => {
      // Avoid the old 1.4s font race: font swapping mid-transition was the
      // main cause of stuttering and words suddenly jumping to new positions.
      await Promise.race([
        document.fonts.ready.catch(() => undefined),
        new Promise<void>(resolve => setTimeout(resolve, 3500)),
      ]);
      if (!active) return;
      frame = requestAnimationFrame(() => {
        nextFrame = requestAnimationFrame(() => {
          startTimer = window.setTimeout(() => {
            if (!active) return;
            html.dataset.dairaHero = "play";
            safetyTimer = window.setTimeout(finish, 3200);
          }, 90);
        });
      });
    };
    void begin();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nextFrame);
      clearTimeout(startTimer);
      clearTimeout(safetyTimer);
      lastWord.removeEventListener("animationend", onEnd);
      title.removeAttribute("data-liquid-glass-ignore");
      html.dataset.dairaHero = "done";
    };
  }, []);

  return null;
}
