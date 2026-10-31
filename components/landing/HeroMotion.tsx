"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * Animate only transform and opacity on intact Persian words.
 * No filter/blur animation, nested parent motion, floating glyphs or loops:
 * the final headline becomes a completely static text layout.
 */
export function HeroMotion() {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>("[data-hero-word]");
      const cta = document.querySelector<HTMLElement>("[data-hero-cta]");
      gsap.timeline({
        delay: .1,
        defaults: {ease:"power3.out"},
        onComplete: () => {
          gsap.set(words, {clearProps:"transform,opacity,visibility,willChange"});
          if (cta) gsap.set(cta, {clearProps:"transform,opacity,visibility,willChange"});
        }
      })
        .from(words, {
          x: (i) => [75,-82,62,-63,81,-53,46][i%7],
          y: (i) => [27,-31,-21,32,-28,23,-19][i%7],
          rotation: (i) => i%2 ? -5 : 4,
          autoAlpha:0,
          duration:1.05,
          stagger:{each:.052,from:"random"},
          force3D:true
        },0)
        .from(cta,{y:15,autoAlpha:0,duration:.65,force3D:true},.76);
    });
    return () => ctx.revert();
  },[]);
  return null;
}
