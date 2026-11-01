"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronUp } from "lucide-react";

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.dataset.gsapMotion = "reduced";
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    root.dataset.gsapMotion = "true";
    const context = gsap.context(() => {
      const reveal = (target: Element, options?: {start?: string; y?: number; duration?: number; delay?: number}) => {
        const node = target as HTMLElement;
        // Do not allocate transformed GPU layers for every offscreen card.
        // Apply translateY only when that individual card enters the viewport.
        gsap.set(node, {autoAlpha:0});
        const trigger = ScrollTrigger.create({
          trigger: node,
          start: options?.start ?? "top 83%",
          once: true,
          onEnter: () => {
            if (node.dataset.gsapShown === "true") return;
            node.dataset.gsapStarted = String(performance.now());
            gsap.fromTo(node, {autoAlpha: 0, y: options?.y ?? 16}, {
              autoAlpha: 1, y: 0, duration: options?.duration ?? .72,
              delay: options?.delay ?? 0, ease:"power2.out", overwrite:"auto",
              onComplete:()=>{
                node.dataset.gsapShown="true";
                gsap.set(node,{clearProps:"opacity,visibility,transform"});
              }
            });
          }
        });
        return trigger;
      };
      root.querySelectorAll<HTMLElement>(".ap-showcase__intro").forEach(intro => {
        const heading = intro.querySelector<HTMLElement>(".ap-motion-reveal-title > span");
        const title = intro.querySelector<HTMLElement>(".ap-motion-reveal-title");
        if(title && heading) {
          gsap.set(heading, {yPercent:105});
          ScrollTrigger.create({
            trigger: title, start: "top 82%", once: true,
            onEnter: () => {
              gsap.fromTo(heading,{yPercent:105},{yPercent:0,duration:.9,ease:"power3.out",overwrite:"auto",onComplete:()=>{gsap.set(heading,{clearProps:"transform"});}});
            }
          });
        }
        intro.querySelectorAll<HTMLElement>(".ap-showcase__eyebrow, p").forEach(node => reveal(node,{start:"top 83%",y:8,duration:.58}));
      });
      root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card").forEach(card => {
        // Each card fires only when ITS OWN bounds enter the viewport, never the enclosing row.
        reveal(card,{start:"top 78%",y:17,duration:.76});
      });
      const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
      if (footer) {
        const callout = footer.querySelector<HTMLElement>("[data-footer-callout]");
        if (callout) reveal(callout,{start:"top 80%",y:18,duration:.84});
        footer.querySelectorAll<HTMLElement>(".ap-footer__brand, .ap-footer__links, .ap-footer__bottom").forEach(node => reveal(node,{start:"top 85%",y:10,duration:.7}));
      }
    }, root);
    let canceled=false;
    void document.fonts.ready.then(()=>{
      if(!canceled) requestAnimationFrame(()=>{if(!canceled) ScrollTrigger.refresh();});
    }).catch(()=>{});
    return ()=>{
      canceled=true;
      context.revert();
      delete root.dataset.gsapMotion;
    };
  },[]);

  useEffect(()=>{
    let frame=0,displayed=false;
    const check=()=>{
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        const next=scrollY>540;
        if(next!==displayed){displayed=next;setShowTop(next);if(next)setHasShown(true);}
        frame=0;
      });
    };
    check();
    addEventListener("scroll",check,{passive:true});
    return ()=>{removeEventListener("scroll",check);if(frame)cancelAnimationFrame(frame);};
  },[]);

  const goToTop=()=>window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  return (
    <div className={"ap-backtop"+(showTop?" ap-backtop--visible":"")} data-liquid-glass-ignore="">
      {hasShown && <span className="ap-backtop__lens ap-backtop__blue-blur" aria-hidden="true" />}
      <button type="button" className="ap-backtop__action" aria-label="بازگشت به بالای صفحه" title="بازگشت به بالا"
        disabled={!showTop} tabIndex={showTop?0:-1} onClick={goToTop}>
        <ChevronUp size={28} strokeWidth={2.8} aria-hidden="true"/>
      </button>
    </div>
  );
}
