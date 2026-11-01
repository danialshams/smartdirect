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
    // GSAP drives motion; one native observer decides when a feature is visible.
    // Avoid eleven ScrollTrigger checks on every Safari WebGL scroll frame.
    gsap.registerPlugin(ScrollTrigger);
    root.dataset.gsapMotion = "true";
    const animated = new Set<HTMLElement>();
    const callbacks = new Map<Element, () => void>();
    const enter = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const play = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        play?.();
      }
    };
    const observer = new IntersectionObserver(enter, {
      rootMargin: "0px 0px -22% 0px", threshold: 0
    });
    // End-of-document strip cannot reach a 78% viewport threshold.
    const bottomObserver = new IntersectionObserver(enter, { threshold: 0 });
    const watch = (node: HTMLElement, play: () => void, bottom = false) => {
      if (node.dataset.gsapShown === "true") return;
      callbacks.set(node, play);
      (bottom ? bottomObserver : observer).observe(node);
    };
    const fade = (node: HTMLElement, duration = .58, bottom = false) => {
      if (node.dataset.gsapShown === "true") return;
      animated.add(node);
      gsap.set(node, { opacity: 0 });
      watch(node, () => {
        node.dataset.gsapStarted = String(performance.now());
        gsap.to(node, { opacity: 1, duration, ease: "power2.out", overwrite: "auto",
          onComplete: () => {
            node.dataset.gsapShown = "true";
            gsap.set(node, { clearProps: "opacity" });
          }
        });
      }, bottom);
    };
    const ctx = gsap.context(() => {
      const title = root.querySelector<HTMLElement>(".ap-motion-reveal-title");
      const titleText = title?.querySelector<HTMLElement>("span");
      if (title && titleText) {
        gsap.set(titleText, { yPercent: 105 });
        animated.add(titleText);
        // Selective upward mask belongs ONLY to the main features heading.
        ScrollTrigger.create({
          trigger: title, start: "top 82%", once: true,
          onEnter: () => {
            gsap.fromTo(titleText, { yPercent: 105 }, {
              yPercent: 0, duration: .86, ease: "power3.out", overwrite: "auto",
              onComplete: () => {
                title.dataset.gsapShown = "true";
                gsap.set(titleText, { clearProps: "transform" });
              }
            });
          }
        });
      }
      root.querySelectorAll<HTMLElement>(".ap-showcase__intro .ap-showcase__eyebrow, .ap-showcase__intro p")
        .forEach(node => fade(node, .52));
      root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card").forEach(card => {
        const copy = card.querySelector<HTMLElement>(".ap-social-card__copy");
        if (!copy || card.dataset.gsapShown === "true") return;
        animated.add(copy);
        gsap.set(copy, { opacity: 0 });
        watch(card, () => {
          card.dataset.gsapStarted = String(performance.now());
          // Fade just one text wrapper; the Instagram preview and full card
          // never create transformed GPU layers on the Safari scroll path.
          gsap.to(copy, { opacity: 1, duration: .65, ease: "power2.out", overwrite: "auto",
            onComplete: () => {
              card.dataset.gsapShown = "true";
              gsap.set(copy, { clearProps: "opacity" });
            }
          });
        });
      });
      const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
      if (footer) {
        const callout = footer.querySelector<HTMLElement>("[data-footer-callout]");
        if (callout) fade(callout, .78);
        footer.querySelectorAll<HTMLElement>(".ap-footer__brand, .ap-footer__links")
          .forEach(node => fade(node, .62));
        const bottom = footer.querySelector<HTMLElement>(".ap-footer__bottom");
        if (bottom) fade(bottom, .55, true);
      }
    }, root);

    let canceled = false;
    void document.fonts.ready.then(() => {
      if (!canceled) requestAnimationFrame(() => {
        if (!canceled) ScrollTrigger.refresh();
      });
    }).catch(() => {});
    return () => {
      canceled = true;
      observer.disconnect();
      bottomObserver.disconnect();
      callbacks.clear();
      ctx.revert();
      for (const node of animated) {
        gsap.killTweensOf(node);
        gsap.set(node, { clearProps: "opacity,transform,visibility" });
      }
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
