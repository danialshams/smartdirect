"use client";

import { useEffect, useState } from "react";
import LiquidGlass from "simple-liquid-glass";
import { ChevronUp } from "lucide-react";

const buttonOptics={
  refraction:"lens" as const,
  lensProfile:"material" as const,
  lensOptions:{
    strength:.092,depth:.13,curvature:.14,bend:.12,bendWidth:.42,
    sheen:0,sheenWidth:0,specular:0,glow:0
  },
  quality:"low" as const,
  mobileFallback:"svg" as const,
  frost:0,blur:0,scale:118,saturation:120,dispersion:6,aberrationIntensity:.045,
  borderColor:"rgba(255,255,255,0)",
  glassColor:"rgba(255,255,255,.016)",
  background:"rgba(255,255,255,0)"
};

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || reduced || !("IntersectionObserver" in window)) {
      targets.forEach(element => element.setAttribute("data-visible", "true"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }
    }, { threshold: .07, rootMargin: "0px 0px -32px 0px" });
    targets.forEach(element => observer.observe(element));
    root.setAttribute("data-motion-ready", "true");
    return () => {observer.disconnect(); root.removeAttribute("data-motion-ready");};
  },[]);

  useEffect(() => {
    let frame=0;
    let displayed=false;
    const check=()=>{
      if(frame)return;
      frame=window.requestAnimationFrame(()=>{
        const next=window.scrollY>540;
        if(next!==displayed){displayed=next;setShowTop(next);if(next)setHasShown(true);}
        frame=0;
      });
    };
    check();
    window.addEventListener("scroll",check,{passive:true});
    return ()=>{window.removeEventListener("scroll",check);if(frame)window.cancelAnimationFrame(frame);};
  },[]);

  const goToTop=()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:0,behavior:reduced?"auto":"smooth"});
  };

  return (
    <div className={"ap-backtop"+(showTop?" ap-backtop--visible":"")} data-liquid-glass-ignore="">
      {hasShown && <LiquidGlass
        {...buttonOptics}
        radius={28}
        className="ap-backtop__lens"
        style={{position:"absolute",inset:0,pointerEvents:"none"}}
      ><span className="ap-backtop__fill" aria-hidden="true"/></LiquidGlass>}
      <button type="button"
        className="ap-backtop__action"
        aria-label="بازگشت به بالای صفحه"
        title="بازگشت به بالا"
        disabled={!showTop}
        tabIndex={showTop?0:-1}
        onClick={goToTop}
      >
        <ChevronUp size={28} strokeWidth={2.8} aria-hidden="true"/>
      </button>
    </div>
  );
}
