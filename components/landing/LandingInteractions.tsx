"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root) return;

    // Keep every section's real content painted in the DOM, including before
    // JavaScript arrives. The old WebKit path disabled ALL entrance animation.
    // GSAP animates only eight stable inner wrappers, not dozens of nested
    // card nodes. That avoids multiplying style mutations and section
    // invalidations in the Safari HTML -> WebGL capture queue.
    const revealChildren = root.querySelectorAll<HTMLElement>("[data-reveal]");
    revealChildren.forEach(element => element.setAttribute("data-visible", "true"));
    const ua = navigator.userAgent;
    const snapshotEngine = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    if (snapshotEngine) root.dataset.sceneCaptureStable = "true";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) return;
    let active = true;
    let observer: IntersectionObserver | undefined;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(
      ".ap-showcase-capture > .ap-showcase__inner, .ap-footer--extended > .ap-footer__hero"
    ));
    let cancel = () => {};
    void import("gsap").then(({ gsap }) => {
      if (!active) return;
      const hidden = new Set<HTMLElement>();
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        // Don't blank content already seen while JS is loading, or content
        // above the viewport reached via a quick scroll before hydration.
        if (rect.top > window.innerHeight + 80) {
          gsap.set(node, { autoAlpha: 0, y: 26 });
          hidden.add(node);
        }
      }
      const show = (node: HTMLElement) => {
        if (!hidden.delete(node)) return;
        observer?.unobserve(node);
        gsap.to(node, {
          autoAlpha: 1,
          y: 0,
          duration: 0.95,
          ease: "power3.out",
          overwrite: "auto",
          onComplete: () => {
            node.dataset.gsapShown = "true";
            gsap.set(node, { clearProps: "opacity,visibility,transform" });
          }
        });
      };
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) show(entry.target as HTMLElement);
        }
      }, { threshold: 0.01, rootMargin: "0px 0px 180px 0px" });
      hidden.forEach(node => observer?.observe(node));
      // Handle elements that entered the viewport while GSAP was loading.
      hidden.forEach(node => {
        if (node.getBoundingClientRect().top < window.innerHeight + 180) show(node);
      });
      cancel = () => {
        observer?.disconnect();
        gsap.killTweensOf(nodes);
        nodes.forEach(node => gsap.set(node, { clearProps: "opacity,visibility,transform" }));
      };
    }).catch(() => {
      // A network failure loading GSAP must never leave offscreen rows hidden.
      nodes.forEach(node => { node.style.opacity = ""; node.style.visibility = ""; node.style.transform = ""; });
    });
    return () => {
      active = false;
      cancel();
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
