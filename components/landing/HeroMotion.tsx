"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";

/** Hero only. Feature scenes own their viewport-based GSAP timelines. */
export function HeroMotion() {
  useLayoutEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const context=gsap.context(()=>{
      gsap.timeline({defaults:{ease:"power3.out"},delay:.12})
        .from("[data-hero-entrance]",{
          y:34,autoAlpha:0,duration:.94,
          stagger:.11,clearProps:"all",
        },0);
    });
    return ()=>context.revert();
  },[]);
  return null;
}
