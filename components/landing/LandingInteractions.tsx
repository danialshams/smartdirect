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
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Use ONE GSAP clock for the landing. The previous dynamic imports,
    // per-frame DOM exclusion attributes, and fast-velocity early returns
    // made content pop in, disappear from Safari snapshots or never animate.
    gsap.registerPlugin(ScrollTrigger);
    let active = true;
    root.dataset.gsapMotion = "true";
    const context = gsap.context(() => {
      for (const section of root.querySelectorAll<HTMLElement>(".ap-showcase-capture")) {
        const intro = section.querySelector<HTMLElement>(".ap-showcase__intro");
        const cards = [...section.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card")];
        const targets = [...(intro ? [intro] : []), ...cards];
        if (!targets.length) continue;
        ScrollTrigger.create({
          trigger: section,
          start: "top 89%",
          once: true,
          onEnter: () => {
            if (!active || section.dataset.gsapShown === "true") return;
            // Cards are already painted for the Safari scene snapshot.
            // Animate only the 1-3 top-level groups, not dozens of children.
            section.dataset.gsapStarted = String(performance.now());
            gsap.fromTo(targets,
              { autoAlpha: 0, y: 22 },
              {
                autoAlpha: 1, y: 0,
                duration: 0.92, stagger: 0.10,
                ease: "power2.out",
                overwrite: "auto",
                onComplete: () => {
                  gsap.set(targets, { clearProps: "opacity,visibility,transform" });
                  if (active) section.dataset.gsapShown = "true";
                }
              }
            );
          }
        });
      }

      const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
      if (footer) {
        const targets = [...footer.querySelectorAll<HTMLElement>(
          ".ap-footer__brand, .ap-footer__links > a, .ap-footer__trust > div, .ap-footer__bottom > span"
        )];
        ScrollTrigger.create({
          trigger: footer,
          start: "top 88%",
          once: true,
          onEnter: () => {
            if (!active || footer.dataset.gsapShown === "true") return;
            footer.dataset.gsapStarted = String(performance.now());
            gsap.fromTo(targets,
              { autoAlpha: 0, y: 16 },
              {
                autoAlpha: 1, y: 0,
                duration: 0.78,
                stagger: 0.055,
                ease: "power2.out",
                overwrite: "auto",
                onComplete: () => {
                  gsap.set(targets, { clearProps: "opacity,visibility,transform" });
                  if (active) footer.dataset.gsapShown = "true";
                }
              }
            );
          }
        });
      }
    }, root);

    // Only refresh after a real font-layout change; do not block the hero or
    // repeatedly refresh a complex scene while Safari's captures are busy.
    let canceled = false;
    void document.fonts.ready.then(() => {
      if (active && !canceled) requestAnimationFrame(() => {
        if (active && !canceled) ScrollTrigger.refresh();
      });
    }).catch(() => {});
    return () => {
      active = false;
      canceled = true;
      context.revert();
      delete root.dataset.gsapMotion;
    };
  }, []);

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
