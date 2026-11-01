"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    let active = true;
    let revert = () => {};
    // Explicit GSAP + ScrollTrigger for EVERY feature and footer entrance.
    // No CSS keyframes, Web Animations API or hand-rolled observer animations.
    // Keep future content PAINTED until it actually enters the viewport: an
    // invisible WebKit snapshot would otherwise persist under the glass.
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([gsapModule, triggerModule]) => {
        if (!active) return;
        const gsap = gsapModule.gsap;
        const ScrollTrigger = triggerModule.ScrollTrigger;
        gsap.registerPlugin(ScrollTrigger);
        const ua = navigator.userAgent;
        const snapshotEngine = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
          (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
        // The Safari scene MutationObserver sees changes to inline styles.
        // Exclude only the actively tweening targets from snapshots, then
        // restore them in one mutation after GSAP completes. This prevents
        // 60 separate expensive html-to-image captures per second.
        const isolate = (items: HTMLElement[]) => {
          if (snapshotEngine) items.forEach(item => item.setAttribute("data-liquid-glass-ignore", ""));
        };
        const revealToCapture = (items: HTMLElement[]) => {
          if (snapshotEngine) items.forEach(item => item.removeAttribute("data-liquid-glass-ignore"));
        };

        root.dataset.gsapMotion = "true";
        const context = gsap.context(() => {
          const sections = Array.from(root.querySelectorAll<HTMLElement>(".ap-showcase-capture"));
          const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
          for (const section of sections) {
            const targets = Array.from(section.querySelectorAll<HTMLElement>(
              ".ap-showcase__intro > .ap-showcase__eyebrow, .ap-showcase__intro > h2, .ap-showcase__intro > p, .ap-social-grid > .ap-social-card"
            ));
            if (!targets.length) continue;
            ScrollTrigger.create({
              trigger: section,
              start: "top 85%",
              once: true,
              onEnter: self => {
                if (!active) return;
                // A fast multi-screen flick needs visible content immediately,
                // not a late animation of a section already behind the user.
                const fast = Math.abs(self.getVelocity()) > 2700 ||
                  section.getBoundingClientRect().bottom < 80;
                if (fast) {
                  section.dataset.gsapShown = "true";
                  return;
                }
                section.dataset.gsapStarted = String(performance.now());
                isolate(targets);
                gsap.fromTo(targets,
                  { autoAlpha: 0, y: 23 },
                  {
                    autoAlpha: 1, y: 0,
                    duration: 1.12,
                    stagger: 0.11,
                    ease: "power3.out",
                    overwrite: "auto",
                    clearProps: "opacity,visibility,transform",
                    onComplete: () => { revealToCapture(targets); if (active) section.dataset.gsapShown = "true"; }
                  }
                );
              }
            });
          }
          if (footer) {
            const items = Array.from(footer.querySelectorAll<HTMLElement>(
              ".ap-footer__brand, .ap-footer__links > a, .ap-footer__trust > div, .ap-footer__bottom > span"
            ));
            ScrollTrigger.create({
              trigger: footer,
              start: "top 87%",
              once: true,
              onEnter: self => {
                if (!active) return;
                if (Math.abs(self.getVelocity()) > 2700) {
                  footer.dataset.gsapShown = "true";
                  return;
                }
                footer.dataset.gsapStarted = String(performance.now());
                isolate(items);
                gsap.fromTo(items,
                  { autoAlpha: 0, y: 19 },
                  {
                    autoAlpha: 1, y: 0,
                    duration: 1.02,
                    stagger: 0.075,
                    ease: "power3.out",
                    overwrite: "auto",
                    clearProps: "opacity,visibility,transform",
                    onComplete: () => { revealToCapture(items); if (active) footer.dataset.gsapShown = "true"; }
                  }
                );
              }
            });
          }
        }, root);
        revert = () => { context.revert(); delete root.dataset.gsapMotion; };
        // Recalculate just once after any late font swap, not synchronously
        // while the first hero frame and the WebKit capture boot are painting.
        void document.fonts.ready.then(() => {
          if (active) requestAnimationFrame(() => { if (active) ScrollTrigger.refresh(); });
        }).catch(() => {});
      }).catch(() => {
        // JS chunk failure must never leave any content hidden.
        delete root.dataset.gsapMotion;
      });

    return () => {
      active = false;
      revert();
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
