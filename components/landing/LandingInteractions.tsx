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
    // Legacy nested reveals are already visible unless data-motion-ready is
    // present (we intentionally never set it). Do not add data-visible to
    // dozens of children: that previously dirtied every Safari snapshot at
    // first paint, delaying the actual optical scene.
    const ua = navigator.userAgent;
    const snapshotEngine = /Firefox\/|FxiOS\/|iPhone|iPad|iPod/.test(ua) ||
      (/Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua));
    if (snapshotEngine) root.dataset.sceneCaptureStable = "true";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) return;
    let active = true;
    // A multi-viewport flick must never spend a full second animating cards
    // that have already passed the header. Only normal-speed entrances animate.
    let previousY = window.scrollY;
    let previousTime = performance.now();
    let fastUntil = 0;
    const onMotionScroll = () => {
      const now = performance.now(), y = window.scrollY;
      const distance = Math.abs(y - previousY);
      if (distance > 320 || distance / Math.max(12, now - previousTime) > 4.5) {
        fastUntil = now + 260;
      }
      previousY = y; previousTime = now;
    };
    window.addEventListener("scroll", onMotionScroll, { passive: true });
    let observer: IntersectionObserver | undefined;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(
      ".ap-showcase-capture > .ap-showcase__inner, .ap-footer--extended > .ap-footer__hero"
    ));
    let cancel = () => {};
    const nativeAnimations: Animation[] = [];
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
        if (performance.now() < fastUntil) {
          gsap.set(node, { clearProps: "opacity,visibility,transform" });
          node.dataset.gsapShown = "true";
          return;
        }
        const finish = () => {
          if (!active) return;
          node.dataset.gsapShown = "true";
          gsap.set(node, { clearProps: "opacity,visibility,transform" });
        };
        if (snapshotEngine && typeof node.animate === "function") {
          // Safari's scene capture watches style attribute mutations.
          // GSAP writes to inline styles on every frame; native compositor
          // keyframes produce the SAME GSAP-timed reveal without forcing
          // html-to-image to invalidate the tile 60 times per second.
          const animation = node.animate([
            { opacity: 0, transform: "translate3d(0,26px,0)" },
            { opacity: 1, transform: "translate3d(0,0,0)" }
          ], {
            duration: 950,
            easing: "cubic-bezier(.22,.61,.36,1)",
            fill: "both"
          });
          nativeAnimations.push(animation);
          void animation.finished.then(() => {
            finish();
            animation.cancel();
          }).catch(() => {});
        } else {
          gsap.to(node, {
            autoAlpha: 1,
            y: 0,
            duration: 0.95,
            ease: "power3.out",
            overwrite: "auto",
            onComplete: finish
          });
        }
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
        nativeAnimations.forEach(animation => animation.cancel());
        gsap.killTweensOf(nodes);
        nodes.forEach(node => gsap.set(node, { clearProps: "opacity,visibility,transform" }));
      };
    }).catch(() => {
      // A network failure loading GSAP must never leave offscreen rows hidden.
      nodes.forEach(node => { node.style.opacity = ""; node.style.visibility = ""; node.style.transform = ""; });
    });
    return () => {
      active = false;
      window.removeEventListener("scroll", onMotionScroll);
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
