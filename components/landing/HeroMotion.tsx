"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/** Compositor-friendly entrance: SSR text stays fully readable, even if WebKit is busy. */
export function HeroMotion() {
  useLayoutEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const context=gsap.context(()=>{
      gsap.timeline({defaults:{ease:"power3.out"},delay:.12})
        .from("[data-hero-entrance]",{
          y:14,opacity:.92,duration:.65,
          stagger:.075,clearProps:"transform,opacity",
        },0);
    });
    return ()=>context.revert();
  },[]);
  return null;
}
