"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // WebKit / Gecko use HTML snapshots behind the WebGL lens. Animating
    // dozens of showcase cards during scroll invalidates their cached tiles,
    // causing blank frames and expensive main-thread HTML re-rasterization.
    // Chromium keeps the existing reveal animations (native live SVG lens).
    const ua = navigator.userAgent;
    const snapshotEngine = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    if (root && snapshotEngine) {
      root.dataset.sceneCaptureStable = "true";
      targets.forEach(element => element.setAttribute("data-visible", "true"));
      return () => { delete root.dataset.sceneCaptureStable; };
    }
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
      {hasShown && <span className="ap-backtop__lens ap-backtop__blue-blur" aria-hidden="true" />}
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
