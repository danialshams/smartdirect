"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronUp } from "lucide-react";

type CardState = "waiting" | "queued" | "playing" | "done";
type CardParts = {
  shell: HTMLElement | null;
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
    root.dataset.gsapMotion = "true";
    const cards = [...root.querySelectorAll<HTMLElement>(".ap-social-grid > .ap-social-card")];
    const states = new Map<HTMLElement, CardState>();
    const preparedCards = new Map<HTMLElement, CardParts>();
    const running = new Set<gsap.core.Animation>();
    const affected = new Set<HTMLElement>();
    const pending = new Set<HTMLElement>();
    const queuedCards: HTMLElement[] = [];
    const builders = new Map<HTMLElement, () => void>();
    let activeCard: HTMLElement | null = null;
    let activeTimeline: gsap.core.Timeline | null = null;
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
    let lastProbeAt = -Infinity;
    let trailingProbeTimer: ReturnType<typeof setTimeout> | undefined;
    const probe = () => {
      scrollFrame = 0;
      // A quick jump may leave an earlier card animating offscreen and blocking
      // the visible one. Complete it instantly, without a replay or blank card.
      if (activeCard && activeTimeline) {
        const activeRect = activeCard.getBoundingClientRect();
        if (activeRect.bottom < -12 || activeRect.top > innerHeight + 12) {
          activeTimeline.progress(1);
        }
      }
      for (const card of pending) {
        const rect = card.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, innerHeight * .73) - Math.max(rect.top, 0));
        if (rect.top <= innerHeight * .73 && rect.bottom > 0 &&
            visible >= Math.min(rect.height, innerHeight * .73) * .24) startCard(card);
      }
    };
    const scheduleProbe = () => {
      if (disposed || (!pending.size && !activeCard) || scrollFrame) return;
      lastProbeAt = performance.now();
      scrollFrame = requestAnimationFrame(probe);
    };
    const onScroll = () => {
      if ((!pending.size && !activeCard) || scrollFrame) return;
      const remaining = 180 - (performance.now() - lastProbeAt);
      if (remaining <= 0) {
        if (trailingProbeTimer !== undefined) {
          clearTimeout(trailingProbeTimer);
          trailingProbeTimer = undefined;
        }
        scheduleProbe();
      } else if (trailingProbeTimer === undefined) {
        // Never miss the last scroll position when WebKit drops an observer
        // notification during a fast jump.
        trailingProbeTimer = setTimeout(() => {
          trailingProbeTimer = undefined;
          scheduleProbe();
        }, remaining);
      }
    };
    const onResize = () => {
      lastProbeAt = -Infinity;
      onScroll();
    };

    const unique = (nodes: (HTMLElement | null)[]) =>
      nodes.filter((node): node is HTMLElement => Boolean(node));

    const drainQueue = () => {
      if (disposed || activeCard) return;
      while (queuedCards.length) {
        const card = queuedCards.shift()!;
        if (states.get(card) !== "queued") continue;
        const rect = card.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= innerHeight) {
          // The user has already passed this card: restore its full content
          // instead of leaving a blank card waiting for an outdated entrance.
          const parts = preparedCards.get(card);
          if (parts) gsap.set([
            ...(parts.shell ? [parts.shell] : []),
            ...parts.copyParts, ...parts.visualParts,
            ...(parts.preview ? [parts.preview] : [])
          ], { clearProps: "transform,opacity,visibility" });
          states.set(card, "done");
          card.dataset.gsapShown = "true";
          card.dataset.gsapPhase = "complete";
          builders.delete(card);
          continue;
        }
        const build = builders.get(card);
        if (!build) continue;
        activeCard = card;
        build();
        return;
      }
    };

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
        const { shell, copyParts, preview, visualParts } = prepared;
        // All expensive element discovery and initial transform setup is
        // finished before scrolling, not inside this viewport callback.
        // Child content uses force3D:false: Safari otherwise promotes every
        // text row and illustrated sublayer to its own GPU texture mid-scroll.
        // The large card surface still moves independently.
        const timeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          onComplete: () => {
            states.set(card, "done");
            card.dataset.gsapPhase = "complete";
            card.dataset.gsapShown = "true";
            gsap.set([card, ...(shell ? [shell] : []), ...copyParts, ...visualParts, ...(preview ? [preview] : [])], {
              clearProps: "transform,opacity,visibility"
            });
            running.delete(timeline);
            activeCard = null;
            activeTimeline = null;
            builders.delete(card);
            requestAnimationFrame(drainQueue);
          }
        });
        running.add(timeline);
        activeTimeline = timeline;

        // 01 outer shell: right, 02 outer shell: left, alternating globally.
        if (shell) {
          timeline.set(shell, { visibility: "visible" }, 0);
          timeline.to(shell, { x: 0, duration: .48 }, 0);
        }
        // Opposing direction. Each number, title and description owns a slot.
        copyParts.forEach((part, i) => timeline.to(part, {
          x: 0, opacity: 1, force3D: false, duration: .28
        }, .42 + i * .11));
        if (preview) {
          const previewAt = .42 + copyParts.length * .11 + .10;
          timeline.set(preview, { visibility: "visible" }, previewAt);
          timeline.to(preview, { x: 0, force3D: false, duration: .31 }, previewAt);
          // Hide preview internals only right before the preview itself enters.
          // This avoids allocating many nested compositing layers at the
          // precise scroll frame that first activates the card.
          timeline.set(visualParts, { x: -12 * direction, opacity: 0, force3D: false }, previewAt - .12);
          visualParts.forEach((part, i) => timeline.to(part, {
            x: 0, opacity: 1, force3D: false, duration: .22, ease: "power2.out"
          }, previewAt + .30 + i * .105));
        }
      };

      // Only one complicated Instagram preview assembles at a time.
      builders.set(card, build);
      queuedCards.push(card);
      queuedCards.sort((a,b) => cards.indexOf(a) - cards.indexOf(b));
      drainQueue();
    };

    cards.forEach((card, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      card.dataset.gsapDirection = String(direction);
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
      preparedCards.set(card, { shell, copyParts, preview, visualParts });
      card.dataset.gsapStages = String(1 + copyParts.length + (preview ? 1 : 0) + visualParts.length);
      // Prepare only lightweight parent/label transforms once on mount.
      // Their actual GSAP entrance remains gated by the card observer.
      if (shell) {
        affected.add(shell);
        gsap.set(shell, { x: 54 * direction, visibility: "hidden" });
      }
      for (const part of copyParts) affected.add(part);
      gsap.set(copyParts, { x: 22 * opposite, opacity: 0, force3D: false });
      if (preview) {
        affected.add(preview);
        gsap.set(preview, { x: 20 * opposite, visibility: "hidden", force3D: false });
      }
      for (const part of visualParts) affected.add(part);
      pending.add(card);
      cardObserver.observe(card);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(probe);

    // Only the feature section headline gets the upward clipped text effect.
    const title = root.querySelector<HTMLElement>(".ap-motion-reveal-title");
    const titleText = title?.querySelector<HTMLElement>("span");
    let headingTrigger: ScrollTrigger | undefined;
    if (title && titleText && title.dataset.gsapShown !== "true") {
      affected.add(titleText);
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
        if (!canceled) ScrollTrigger.refresh();
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
      queuedCards.length = 0;
      builders.clear();
      activeCard = null;
      activeTimeline = null;
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
