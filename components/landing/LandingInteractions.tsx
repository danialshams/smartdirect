"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronUp } from "lucide-react";

type CardState = "waiting" | "queued" | "playing" | "done";
type CardParts = {
  shell: HTMLElement | null;
  copyContainer: HTMLElement | null;
  copyParts: HTMLElement[];
  preview: HTMLElement | null;
  visualParts: HTMLElement[];
};


export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.dataset.gsapMotion = "reduced";
      root.querySelectorAll<HTMLElement>(".ap-social-card").forEach(card => {
        card.dataset.gsapShown = "true";
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    // Production bundles omit these ablations entirely. The WebKit CI
    // profiler builds with this flag to isolate heading vs feature cost.
    const profile = process.env.NEXT_PUBLIC_DAIRA_PROFILE === "1"
      ? new URLSearchParams(window.location.search).get("__daira_profile")
      : null;
    const skipCards = profile === "no-cards" || profile === "no-both";
    const skipHeading = profile === "no-heading" || profile === "no-both";
    root.dataset.gsapMotion = "true";
    const cards = [...root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card")];
    const states = new Map<HTMLElement, CardState>();
    const preparedCards = new Map<HTMLElement, CardParts>();
    const running = new Set<gsap.core.Animation>();
    const affected = new Set<HTMLElement>();
    const pending = new Set<HTMLElement>();
    const delays = new Set<gsap.core.Tween>();
    let disposed = false;

    const cardObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < .24) continue;
        startCard(entry.target as HTMLElement);
      }
    }, { rootMargin: "0px 0px -27% 0px", threshold: [.24] });

    // WebKit may miss an observer after an instantaneous jump or resize.
    // Its fallback must NOT measure all pending card boxes on every scroll
    // frame; doing so forces layout while the glass and GSAP are compositing.
    let scrollFrame = 0;
    let trailingProbeTimer: ReturnType<typeof setTimeout> | undefined;
    const probe = () => {
      scrollFrame = 0;
      if (disposed) return;
      for (const card of pending) {
        const rect = card.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, innerHeight * .73) - Math.max(rect.top, 0));
        if (rect.top <= innerHeight * .73 && rect.bottom > 0 &&
            visible >= Math.min(rect.height, innerHeight * .73) * .24) startCard(card);
      }
    };
    const scheduleProbe = () => {
      if (disposed || !pending.size || scrollFrame) return;
      scrollFrame = requestAnimationFrame(probe);
    };
    const onScroll = () => {
      // The native IntersectionObserver starts every normal entrance.
      // Only check layout AFTER scrolling settles: WebKit cannot afford
      // forced getBoundingClientRect() reads during live glass frames.
      if (disposed || !pending.size) return;
      if (trailingProbeTimer !== undefined) clearTimeout(trailingProbeTimer);
      trailingProbeTimer = setTimeout(() => {
        trailingProbeTimer = undefined;
        scheduleProbe();
      }, 145);
    };
    const onResize = () => {
      if (trailingProbeTimer !== undefined) clearTimeout(trailingProbeTimer);
      trailingProbeTimer = setTimeout(() => {
        trailingProbeTimer = undefined;
        scheduleProbe();
      }, 80);
    };

    const unique = (nodes: (HTMLElement | null)[]) =>
      nodes.filter((node): node is HTMLElement => Boolean(node));

    const startCard = (card: HTMLElement) => {
      if (disposed || states.get(card) !== "waiting") return;
      states.set(card, "queued");
      card.dataset.gsapPhase = "queued";
      pending.delete(card);
      cardObserver.unobserve(card);

      const build = () => {
        if (disposed || states.get(card) !== "queued") return;
        states.set(card, "playing");
        card.dataset.gsapStarted = String(performance.now());
        card.dataset.gsapPhase = "building";

        const direction = Number(card.dataset.gsapDirection) || 1;
        const prepared = preparedCards.get(card);
        if (!prepared) return;
        const { shell, copyContainer, copyParts, preview, visualParts } = prepared;
        // All expensive element discovery and initial transform setup is
        // finished before scrolling, not inside this viewport callback.
        // A single copy wrapper moves from the opposing side. The labels
        // fade in one at a time inside it, avoiding multiple moving glyph
        // textures and forced WebKit compositing at the card boundary.
        const timeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          onComplete: () => {
            states.set(card, "done");
            card.dataset.gsapPhase = "complete";
            card.dataset.gsapShown = "true";
            gsap.set([card, ...(shell ? [shell] : []), ...(copyContainer ? [copyContainer] : []), ...copyParts, ...visualParts, ...(preview ? [preview] : [])], {
              clearProps: "transform,opacity,visibility"
            });
            running.delete(timeline);
          }
        });
        running.add(timeline);

        // 01 outer shell: right, 02 outer shell: left, alternating globally.
        if (shell) {
          timeline.set(shell, { visibility: "visible" }, 0);
          timeline.to(shell, { x: 0, duration: .64 }, 0);
        }
        // Opposing copy motion, with separate sequential text reveals.
        if (copyContainer) timeline.to(copyContainer, {
          x: 0, force3D: false, duration: .94
        }, .52);
        copyParts.forEach((part, i) => timeline.to(part, {
          opacity: 1, duration: .33
        }, .52 + i * .14));
        if (preview) {
          const previewAt = .52 + copyParts.length * .14 + .12;
          const mobileLayers = innerWidth <= 640;
          timeline.set(preview, { visibility: "visible" }, previewAt);
          // On narrow mobile WebKit, painting a moving illustrated phone
          // while animating its nested rows caused frame spikes. The numbered
          // copy still slides from the opposite side; the phone builds in
          // place with separate, genuinely sequential GSAP row fades.
          if (mobileLayers) {
            timeline.to(preview, { opacity: 1, duration: .34 }, previewAt);
          } else {
            timeline.to(preview, { x: 0, force3D: false, duration: .67 }, previewAt);
          }
          timeline.set(visualParts, {
            ...(mobileLayers ? {} : { x: -12 * direction, force3D: false }),
            opacity: 0
          }, previewAt - .12);
          visualParts.forEach((part, i) => timeline.to(part, {
            ...(mobileLayers ? {} : { x: 0, force3D: false }),
            opacity: 1, duration: .25, ease: "power2.out"
          }, previewAt + .27 + i * .13));
        }
      };

      // Paired cards must not produce two compositing bursts on the same frame.
      const secondInRow = innerWidth > 600 &&
        Array.from(card.parentElement?.children ?? []).indexOf(card) > 0;
      if (secondInRow) {
        const delayed = gsap.delayedCall(.82, () => {
          delays.delete(delayed);
          build();
        });
        delays.add(delayed);
      } else build();
    };

    cards.forEach((card, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      card.dataset.gsapDirection = String(direction);
      if (skipCards) {
        states.set(card, "done");
        card.dataset.gsapShown = "true";
        return;
      }
      if (card.dataset.gsapShown === "true") {
        states.set(card, "done");
        return;
      }
      const rect = card.getBoundingClientRect();
      // Deep-link or restored scroll: already-visible content must not vanish
      // on hydration. Only cards still approaching the viewport are armed.
      if (rect.top < innerHeight * .72 && rect.bottom > 0) {
        states.set(card, "done");
        card.dataset.gsapShown = "true";
        card.dataset.gsapPhase = "complete";
        return;
      }
      states.set(card, "waiting");
      const opposite = -direction;
      const shell = card.querySelector<HTMLElement>(".ap-social-card__shell");
      const copyContainer = card.querySelector<HTMLElement>(".ap-social-card__copy");
      const preview = card.querySelector<HTMLElement>(".ig-preview");
      const copyParts = unique([
        card.querySelector<HTMLElement>(".ap-social-card__index"),
        card.querySelector<HTMLElement>(".ap-social-card__count"),
        card.querySelector<HTMLElement>(".ap-social-card__copy h3"),
        card.querySelector<HTMLElement>(".ap-social-card__copy p")
      ]);
      const groups = ".ig-chat, .ig-story, .ig-live, .ig-photo-grid, .ig-insights-bars, .ig-menu-sheet";
      const visualParts = preview ? Array.from(preview.children).flatMap(child => {
        if (!(child instanceof HTMLElement)) return [];
        if (child.matches(groups)) return Array.from(child.children).filter(
          (part): part is HTMLElement => part instanceof HTMLElement
        );
        return [child];
      }) : [];
      preparedCards.set(card, { shell, copyContainer, copyParts, preview, visualParts });
      card.dataset.gsapStages = String(1 + copyParts.length + (preview ? 1 : 0) + visualParts.length);
      // Prepare only lightweight parent/label transforms once on mount.
      // Their actual GSAP entrance remains gated by the card observer.
      if (shell) {
        affected.add(shell);
        gsap.set(shell, { x: 54 * direction, visibility: "hidden" });
      }
      if (copyContainer) {
        affected.add(copyContainer);
        gsap.set(copyContainer, { x: 22 * opposite, force3D: false });
      }
      for (const part of copyParts) affected.add(part);
      gsap.set(copyParts, { opacity: 0 });
      if (preview) {
        affected.add(preview);
        if (innerWidth <= 640) {
          gsap.set(preview, { opacity: 0, visibility: "hidden" });
        } else {
          gsap.set(preview, { x: 20 * opposite, visibility: "hidden", force3D: false });
        }
      }
      for (const part of visualParts) affected.add(part);
      pending.add(card);
      cardObserver.observe(card);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(probe);

    // The large masked heading caused >1s WebKit compositor stalls exactly
    // at the hero/features boundary. Preserve the editorial upward mask on
    // Chromium; on Safari use a small one-shot alpha reveal via native IO.
    // This leaves original WebGL/SVG liquid optics and feature cards untouched.
    const ua = navigator.userAgent;
    const safariWebKit = /AppleWebKit/.test(ua) &&
      (/iPhone|iPad|iPod/.test(ua) || (/Safari\\//.test(ua) && !/Chrome\\/|Chromium\\/|Edg\\/|OPR\\//.test(ua)));
    const title = root.querySelector<HTMLElement>(".ap-motion-reveal-title");
    const titleText = title?.querySelector<HTMLElement>("span");
    let headingTrigger: ScrollTrigger | undefined;
    let headingObserver: IntersectionObserver | undefined;
    if (!skipHeading && title && titleText && title.dataset.gsapShown !== "true") {
      affected.add(titleText);
      if (safariWebKit) {
        headingObserver = new IntersectionObserver(entries => {
          if (disposed || !entries.some(entry => entry.isIntersecting) ||
              title.dataset.gsapStarted) return;
          headingObserver?.disconnect();
          title.dataset.gsapStarted = String(performance.now());
          const tween = gsap.fromTo(titleText, { opacity: .58 }, {
            opacity: 1, duration: .57, ease: "sine.out",
            onComplete: () => {
              title.dataset.gsapShown = "true";
              gsap.set(titleText, { clearProps: "opacity" });
              running.delete(tween);
            }
          });
          running.add(tween);
        }, { rootMargin: "0px 0px -25% 0px", threshold: 0 });
        headingObserver.observe(title);
      } else {
        gsap.set(titleText, { yPercent: 105 });
        headingTrigger = ScrollTrigger.create({
          trigger: title, start: "top 75%", once: true,
          onEnter: () => {
            const tween = gsap.fromTo(titleText, { yPercent: 105 }, {
              yPercent: 0, duration: .85, ease: "power3.out",
              onComplete: () => {
                title.dataset.gsapShown = "true";
                gsap.set(titleText, { clearProps: "transform" });
                running.delete(tween);
              }
            });
            running.add(tween);
          }
        });
      }
    }

    // Footer: each text/link/license badge is its own ordered GSAP stage.
    // Keep everything visible until the corresponding group actually enters.
    const footerGroups = [
      { node: root.querySelector<HTMLElement>(".ap-footer__callout"),
        select: "h2, p, a" },
      { node: root.querySelector<HTMLElement>(".ap-footer__brand"),
        select: ".ap-brand, p" },
      { node: root.querySelector<HTMLElement>(".ap-footer__links"),
        select: ":scope > a" },
      { node: root.querySelector<HTMLElement>(".ap-footer__trust"),
        select: ".ap-footer__trust-title, .ap-footer__trust-copy p, .ap-footer__badge-placeholder" },
      { node: root.querySelector<HTMLElement>(".ap-footer__bottom"),
        select: ":scope > span" }
    ];
    const footerObservers = new Set<IntersectionObserver>();
    for (const { node, select } of footerGroups) {
      if (!node || node.dataset.gsapShown === "true") continue;
      const parts = Array.from(node.querySelectorAll<HTMLElement>(select));
      if (!parts.length) continue;
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting) || disposed ||
            node.dataset.gsapStarted) return;
        observer.disconnect();
        footerObservers.delete(observer);
        node.dataset.gsapStarted = String(performance.now());
        for (const part of parts) affected.add(part);
        gsap.set(parts, { opacity: 0 });
        const timeline = gsap.timeline({
          onComplete: () => {
            node.dataset.gsapShown = "true";
            gsap.set(parts, { clearProps: "opacity" });
            running.delete(timeline);
          }
        });
        running.add(timeline);
        timeline.to(parts, {
          opacity: 1, duration: .42, stagger: .14, ease: "power2.out"
        });
      }, { rootMargin: select === ":scope > span" ? "0px" : "0px 0px -9% 0px", threshold: 0 });
      footerObservers.add(observer);
      observer.observe(node);
    }

    let canceled = false;
    void document.fonts.ready.then(() => {
      if (!canceled) requestAnimationFrame(() => {
        if (!canceled && !safariWebKit) ScrollTrigger.refresh();
      });
    }).catch(() => {});

    return () => {
      disposed = true;
      canceled = true;
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      if (trailingProbeTimer !== undefined) clearTimeout(trailingProbeTimer);
      cardObserver.disconnect();
      footerObservers.forEach(observer => observer.disconnect());
      headingTrigger?.kill();
      headingObserver?.disconnect();
      delays.forEach(tween => tween.kill());
      running.forEach(animation => animation.kill());
      for (const node of affected) gsap.set(node, {
        clearProps: "transform,opacity,visibility"
      });
      for (const card of cards) {
        // A completed card stays completed; unfinished animations may safely
        // restart on React Strict Mode remount without a half-hidden card.
        if (card.dataset.gsapShown !== "true") {
          delete card.dataset.gsapStarted;
          delete card.dataset.gsapPhase;
        }
      }
      delete root.dataset.gsapMotion;
    };
  }, []);

  useEffect(() => {
    let frame = 0, displayed = false;
    const check = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const next = scrollY > 540;
        if (next !== displayed) {
          displayed = next;
          setShowTop(next);
          if (next) setHasShown(true);
        }
        frame = 0;
      });
    };
    check();
    addEventListener("scroll", check, { passive: true });
    return () => {
      removeEventListener("scroll", check);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goToTop = () => window.scrollTo({
    top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });

  return (
    <div className={"ap-backtop" + (showTop ? " ap-backtop--visible" : "")}
      data-liquid-glass-ignore="">
      {hasShown && <span className="ap-backtop__lens ap-backtop__blue-blur" aria-hidden="true" />}
      <button type="button" className="ap-backtop__action"
        aria-label="بازگشت به بالای صفحه" title="بازگشت به بالا"
        disabled={!showTop} tabIndex={showTop ? 0 : -1} onClick={goToTop}>
        <ChevronUp size={28} strokeWidth={2.8} aria-hidden="true"/>
      </button>
    </div>
  );
}
