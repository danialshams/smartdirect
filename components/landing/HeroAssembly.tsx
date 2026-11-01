"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

// The Persian sentence must be typed as grapheme clusters: Arabic/Persian
// joining and combined marks are never split in the middle of a glyph.
let heroEntranceFinished = false;

function graphemes(value: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(value)]
      .map(part => part.segment);
  }
  return Array.from(value);
}

export function HeroAssembly() {
  useLayoutEffect(() => {
    const title = document.querySelector<HTMLElement>("[data-hero-assembly]");
    const typed = title?.querySelector<HTMLElement>("[data-hero-typed]");
    const caret = title?.querySelector<HTMLElement>(".ap-hero__caret");
    const description = document.querySelector<HTMLElement>("[data-hero-description]");
    const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
    const html = document.documentElement;
    if (!title || !typed) {
      html.dataset.dairaHero = "done";
      return;
    }
    const fullText = title.getAttribute("aria-label") ?? typed.textContent ?? "";
    const targets = [description, cta].filter((el): el is HTMLElement => !!el);
    const restore = () => {
      typed.textContent = fullText;
      gsap.set(typed, { clearProps: "opacity,transform,visibility" });
      gsap.set(targets, { clearProps: "opacity,transform" });
      if (caret) gsap.set(caret, { clearProps: "opacity" });
    };
    if (heroEntranceFinished || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      restore();
      heroEntranceFinished = true;
      html.dataset.dairaHero = "done";
      title.dataset.gsapHero = "complete";
      title.removeAttribute("data-liquid-glass-ignore");
      return;
    }

    // Keep the complete final headline's dimensions using a CSS ::before
    // measure. Only the ink updates, never the outer layout or glass shader.
    // Pre-hydration guard hides the original full ink until this effect runs.
    const parts = graphemes(fullText);
    const model = { count: 0 };
    typed.textContent = "";
    gsap.set(typed, { visibility: "visible" });
    if (caret) gsap.set(caret, { opacity: 1 });
    gsap.set(targets, { opacity: 0 });
    html.dataset.dairaHero = "playing";
    title.dataset.gsapHero = "playing";
    title.dataset.gsapHeroStarted = String(performance.now());

    let finished = false;
    const timeline = gsap.timeline({
      onComplete: () => {
        finished = true;
        heroEntranceFinished = true;
        restore();
        html.dataset.dairaHero = "done";
        title.dataset.gsapHero = "complete";
        title.dataset.gsapHeroElapsed = String(
          Math.round(performance.now() - Number(title.dataset.gsapHeroStarted))
        );
        title.removeAttribute("data-liquid-glass-ignore");
      }
    });
    // GSAP controls the character cadence: no React render per character,
    // no CSS word masks, no extra blue sticker elements.
    const typeDuration = Math.min(1.3, Math.max(.85, parts.length * .034));
    timeline.to(model, {
      count: parts.length,
      duration: typeDuration,
      ease: "none",
      snap: { count: 1 },
      onUpdate: () => {
        const nextCount = Math.max(0, Math.min(parts.length, Math.round(model.count)));
        typed.textContent = parts.slice(0, nextCount).join("");
      }
    }, 0);
    if (description) timeline.to(description, {
      opacity: 1, duration: .24, ease: "sine.out"
    }, typeDuration - .08);
    if (cta) timeline.to(cta, {
      opacity: 1, duration: .27, ease: "sine.out"
    }, typeDuration + .08);
    // A short caret blink while typing, then it disappears at completion.
    const cursorTween = caret ? gsap.to(caret, {
      opacity: .1, repeat: -1, yoyo: true, duration: .34, ease: "steps(1)"
    }) : null;
    const originalOnComplete = timeline.eventCallback("onComplete");
    timeline.eventCallback("onComplete", () => {
      cursorTween?.kill();
      originalOnComplete?.();
    });

    return () => {
      timeline.kill();
      cursorTween?.kill();
      if (!finished) {
        restore();
        html.dataset.dairaHero = "pending";
        title.dataset.gsapHero = "pending";
        delete title.dataset.gsapHeroStarted;
        delete title.dataset.gsapHeroElapsed;
      }
    };
  }, []);

  return null;
}
