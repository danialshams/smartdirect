"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
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

function usesWebKitCapture() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Firefox|FxiOS/.test(ua) ||
    (ua.includes("Safari/") && !/Chrome|Chromium|Edg|OPR/.test(ua));
}

/** Small, optional micro-motion. Large visual mockups stay static in WebKit,
 * because they're already being sampled by the original live GPU glass. */
function revealPreview(card: HTMLElement, track: (tween: gsap.core.Tween) => void) {
  if (usesWebKitCapture()) return;
  const selector = previewActions[card.id.replace(/^feature-/, "")];
  if (!selector) return;
  const targets = Array.from(card.querySelectorAll<HTMLElement>(selector));
  if (!targets.length) return;
  const charts = card.id === "feature-insights";
  track(gsap.fromTo(targets,
    charts ? { scaleY: .54, transformOrigin: "bottom center" } : { y: 9, opacity: .2 },
    {
      ...(charts ? { scaleY: 1 } : { y: 0, opacity: 1 }),
      duration: charts ? .66 : .48,
      stagger: Math.min(.075, .35 / Math.max(targets.length, 1)),
      ease: "power2.out",
      overwrite: "auto",
      onComplete: () => { gsap.set(targets, { clearProps: "opacity,transform,transformOrigin" }); }
    }));
}

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let active = true;
    root.dataset.gsapMotion = "true";

    // One IntersectionObserver, not fourteen ScrollTriggers running layout
    // calculations on every Safari scroll frame. IntersectionObserver tells
    // GSAP WHEN; GSAP still performs EVERY real entrance animation.
    // A -27% bottom margin means a card starts only when its leading edge
    // reaches 73% of the viewport height (never an entire section in advance).
    const callbacks = new Map<Element, () => void>();
    const tweens = new Set<gsap.core.Tween>();
    const track = (tween: gsap.core.Tween) => { tweens.add(tween); };
    const observer = new IntersectionObserver(entries => {
      if (!active) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const callback = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        callback?.();
      }
    }, { root: null, rootMargin: "0px 0px -27% 0px", threshold: 0 });
    const once = (el: Element | null, callback: () => void) => {
      if (!el) return;
      callbacks.set(el, callback);
      observer.observe(el);
    };

    // GSAP owns all hidden initial states. The original HTML stays visible
    // without JavaScript; CSS reveal transitions cannot fight inline tweens.
    const context = gsap.context(() => {
      const setupMask = (heading: HTMLElement | null) => {
        const inner = heading?.querySelector<HTMLElement>(".daira-text-mask__inner");
        if (!inner) return () => {};
        gsap.set(inner, { yPercent: 110, opacity: 1 });
        return () => {
          track(gsap.to(inner, {
            yPercent: 0, duration: .86, ease: "power3.out", overwrite: "auto",
            onComplete: () => { gsap.set(inner, { clearProps: "transform,opacity" }); }
          }));
        };
      };

      const intro = root.querySelector<HTMLElement>(".ap-showcase__intro");
      if (intro) {
        const showHeading = setupMask(intro.querySelector<HTMLElement>("[data-text-reveal]"));
        const eyebrow = intro.querySelector<HTMLElement>(".ap-showcase__eyebrow");
        const description = intro.querySelector<HTMLElement>("p");
        const copy = [eyebrow, description].filter((el): el is HTMLElement => !!el);
        gsap.set(copy, { autoAlpha: 0 });
        once(intro, () => {
          if (!active) return;
          showHeading();
          track(gsap.fromTo(copy, { autoAlpha: 0, y: 6 }, {
            autoAlpha: 1, y: 0, duration: .65, stagger: .14,
            ease: "power2.out", overwrite: "auto",
            onComplete: () => { gsap.set(copy, { clearProps: "opacity,visibility,transform" }); }
          }));
        });
      }

      const lightweight = usesWebKitCapture();
      for (const card of root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card")) {
        const section = card.closest<HTMLElement>(".ap-showcase-capture");
        // Preserve full-card entrance in Chromium. In WebKit, only the number
        // fades; expensive Instagram mockups never become moving GPU layers.
        const number = card.querySelector<HTMLElement>(".ap-social-card__number");
        const target = lightweight && number ? number : card;
        gsap.set(target, { autoAlpha: 0 });
        once(card, () => {
          if (!active || card.dataset.gsapShown === "true") return;
          card.dataset.gsapStarted = String(performance.now());
          if (section) section.dataset.gsapStarted ??= card.dataset.gsapStarted;
          track(gsap.fromTo(target, { autoAlpha: 0, y: lightweight ? 0 : 17 }, {
            autoAlpha: 1, y: 0,
            duration: lightweight ? .46 : .72, ease: "power3.out",
            overwrite: "auto",
            onComplete: () => {
              gsap.set(target, { clearProps: "opacity,visibility,transform" });
              if (!active) return;
              card.dataset.gsapShown = "true";
              if (section) section.dataset.gsapShown = "true";
              revealPreview(card, track);
            }
          }));
        });
      }

      const footer = root.querySelector<HTMLElement>(".ap-footer--extended");
      if (footer) {
        const invitation = footer.querySelector<HTMLElement>(".ap-footer__invitation");
        if (invitation) {
          const showHeading = setupMask(invitation.querySelector<HTMLElement>("[data-text-reveal]"));
          const text = invitation.querySelector<HTMLElement>("p");
          const button = invitation.querySelector<HTMLElement>(".ap-footer__cta");
          const targets = [text, button].filter((el):el is HTMLElement=>!!el);
          gsap.set(targets, { autoAlpha: 0 });
          once(invitation, () => {
            if (!active) return;
            showHeading();
            track(gsap.fromTo(targets, { autoAlpha: 0, y: 8 }, {
              autoAlpha: 1, y: 0, duration: .69, stagger: .16,
              delay: .2, ease: "power2.out", overwrite: "auto",
              onComplete: () => { gsap.set(targets, { clearProps: "opacity,visibility,transform" }); }
            }));
          });
        }

        const details = footer.querySelector<HTMLElement>(".ap-footer__hero");
        if (details) {
          const targets = [...details.querySelectorAll<HTMLElement>(".ap-footer__brand, .ap-footer__links > a")];
          gsap.set(targets, { autoAlpha: 0 });
          once(details, () => {
            if (!active) return;
            footer.dataset.gsapStarted = String(performance.now());
            track(gsap.fromTo(targets, { autoAlpha: 0, y: 10 }, {
              autoAlpha: 1, y: 0, duration: .65, stagger: .05,
              ease: "power2.out", overwrite: "auto",
              onComplete: () => {
                gsap.set(targets, { clearProps: "opacity,visibility,transform" });
                if (active) footer.dataset.gsapShown = "true";
              }
            }));
          });
        }
      }
    }, root);

    return () => {
      active = false;
      observer.disconnect();
      callbacks.clear();
      for (const tween of tweens) tween.kill();
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
