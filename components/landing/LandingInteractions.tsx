"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronUp } from "lucide-react";

const previewActions: Record<string, string> = {
  comment: ".ig-comment-answer",
  story: ".ig-story__art strong",
  direct: ".ig-bubble--mine",
  share: ".ig-mention",
  live: ".ig-live__comments > div:last-child",
  reminder: ".ig-timestamp, .ig-chat > .ig-bubble--mine:last-child",
  icebreaker: ".ig-quickreplies span",
  inbox: ".ig-inbox-row",
  publishing: ".ig-publish-clock, .ig-schedule",
  insights: ".ig-insights-bars > span",
  menu: ".ig-menu-sheet"
};

function revealPreview(card: HTMLElement) {
  // WebKit/Firefox use a genuine GPU Liquid Glass scene plus responsive
  // raster captures. Additional nested preview transforms can monopolize
  // their compositors when the user flicks through cards. Keep the primary
  // per-card GSAP entrance and the two masked headings on those browsers;
  // reserve tiny illustrative preview motions for Chromium.
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Firefox\\/|FxiOS\\//.test(ua) ||
      (/Safari\\//.test(ua) && !/Chrome\\/|Chromium\\/|Edg\\/|OPR\\//.test(ua))) return;
  const kind = card.id.replace(/^feature-/, "");
  const selector = previewActions[kind];
  if (!selector) return;
  const targets = Array.from(card.querySelectorAll<HTMLElement>(selector));
  if (!targets.length) return;
  const charts = kind === "insights";
  gsap.fromTo(targets,
    charts ? { scaleY: .54, transformOrigin: "bottom center" } : { y: 9, opacity: .2 },
    {
      ...(charts ? { scaleY: 1 } : { y: 0, opacity: 1 }),
      duration: charts ? .66 : .48,
      stagger: Math.min(.075, .35 / Math.max(targets.length, 1)),
      ease: "power2.out",
      overwrite: "auto",
      onComplete: () => { gsap.set(targets, { clearProps: "opacity,transform,transformOrigin" }); }
    });
}

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    let active = true;
    root.dataset.gsapMotion = "true";

    const context = gsap.context(() => {
      // Masked rising text is reserved for TWO headings, not every word.
      // Let the copy render normally with JS disabled and reduced motion.
      const revealMask = (heading: HTMLElement, trigger: HTMLElement, start: string) => {
        const inner = heading.querySelector<HTMLElement>(".daira-text-mask__inner");
        if (!inner) return;
        gsap.set(inner, { yPercent: 110, opacity: 1 });
        ScrollTrigger.create({
          trigger, start, once: true,
          onEnter: () => {
            if (!active) return;
            gsap.to(inner, {
              yPercent: 0, duration: .86, ease: "power3.out",
              overwrite: "auto",
              onComplete: () => { gsap.set(inner, { clearProps: "transform,opacity" }); }
            });
          }
        });
      };

      const intro = root.querySelector<HTMLElement>(".ap-showcase__intro");
      if (intro) {
        const heading = intro.querySelector<HTMLElement>("[data-text-reveal]");
        if (heading) revealMask(heading, intro, "top 74%");
        const eyebrow = intro.querySelector<HTMLElement>(".ap-showcase__eyebrow");
        const description = intro.querySelector<HTMLElement>("p");
        const copy = [eyebrow, description].filter((el):el is HTMLElement=>!!el);
        gsap.set(copy, { autoAlpha: 0, y: 6 });
        ScrollTrigger.create({
          trigger: intro, start: "top 74%", once: true,
          onEnter: () => {
            if (!active) return;
            gsap.to(copy, {
              autoAlpha: 1, y: 0, duration: .65, stagger: .14,
              ease: "power2.out", overwrite: "auto",
              onComplete: () => { gsap.set(copy, { clearProps: "opacity,visibility,transform" }); }
            });
          }
        });
      }

      // Each card is independent. Never trigger an entire section while its
      // next card is still off-screen (previous code used section top 89%).
      for (const card of root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card")) {
        const section = card.closest<HTMLElement>(".ap-showcase-capture");
        gsap.set(card, { autoAlpha: 0 });
        ScrollTrigger.create({
          trigger: card,
          start: "top 73%",
          once: true,
          invalidateOnRefresh: true,
          onEnter: () => {
            if (!active || card.dataset.gsapShown === "true") return;
            card.dataset.gsapStarted = String(performance.now());
            if (section) section.dataset.gsapStarted ??= card.dataset.gsapStarted;
            gsap.fromTo(card, { autoAlpha: 0, y: 17 }, {
              autoAlpha: 1, y: 0,
              duration: .72, ease: "power3.out",
              overwrite: "auto",
              onComplete: () => {
                gsap.set(card, { clearProps: "opacity,visibility,transform" });
                if (!active) return;
                card.dataset.gsapShown = "true";
                if (section) section.dataset.gsapShown = "true";
                revealPreview(card);
              }
            });
          }
        });
      }

      const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
      if (footer) {
        const invitation = footer.querySelector<HTMLElement>(".ap-footer__invitation");
        if (invitation) {
          const heading = invitation.querySelector<HTMLElement>("[data-text-reveal]");
          if (heading) revealMask(heading, invitation, "top 72%");
          const text = invitation.querySelector<HTMLElement>("p");
          const button = invitation.querySelector<HTMLElement>(".ap-footer__cta");
          const targets = [text, button].filter((el):el is HTMLElement=>!!el);
          gsap.set(targets, { autoAlpha: 0, y: 8 });
          ScrollTrigger.create({
            trigger: invitation, start: "top 72%", once: true,
            onEnter: () => {
              if (!active) return;
              gsap.to(targets, {
                autoAlpha: 1, y: 0, duration: .69, stagger: .16,
                delay: .2, ease: "power2.out", overwrite: "auto",
                onComplete: () => { gsap.set(targets, { clearProps: "opacity,visibility,transform" }); }
              });
            }
          });
        }
        const details = footer.querySelector<HTMLElement>(".ap-footer__hero");
        if (details) {
          const targets = [...details.querySelectorAll<HTMLElement>(".ap-footer__brand, .ap-footer__links > a")];
          gsap.set(targets, { autoAlpha: 0, y: 10 });
          ScrollTrigger.create({
            trigger: details, start: "top 78%", once: true,
            onEnter: () => {
              if (!active) return;
              footer.dataset.gsapStarted = String(performance.now());
              gsap.to(targets, {
                autoAlpha: 1, y: 0, duration: .65, stagger: .05,
                ease: "power2.out", overwrite: "auto",
                onComplete: () => {
                  gsap.set(targets, { clearProps: "opacity,visibility,transform" });
                  if (active) footer.dataset.gsapShown = "true";
                }
              });
            }
          });
        }
      }
    }, root);

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
    let frame = 0;
    let displayed = false;
    const check = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const next = window.scrollY > 540;
        if (next !== displayed) {
          displayed = next;
          setShowTop(next);
          if (next) setHasShown(true);
        }
        frame = 0;
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const goToTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className={"ap-backtop" + (showTop ? " ap-backtop--visible" : "")} data-liquid-glass-ignore="">
      {hasShown && <span className="ap-backtop__lens ap-backtop__blue-blur" aria-hidden="true" />}
      <button type="button"
        className="ap-backtop__action"
        aria-label="بازگشت به بالای صفحه"
        title="بازگشت به بالا"
        disabled={!showTop}
        tabIndex={showTop ? 0 : -1}
        onClick={goToTop}
      >
        <ChevronUp size={28} strokeWidth={2.8} aria-hidden="true" />
      </button>
    </div>
  );
}
