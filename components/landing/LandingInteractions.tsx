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
    const ua = navigator.userAgent;
    const safariWebKit = ua.includes("AppleWebKit") &&
      (/iPhone|iPad|iPod/.test(ua) ||
        (ua.includes("Safari") && !["Chrome", "Chromium", "Edg", "OPR"].some(token => ua.includes(token))));
    // Safari's GPU compositor stalls on large GSAP layers while the user is
    // actively dragging the page. Stage mobile entrances only when scrolling
    // settles; leave the REAL card content visible until then.
    const mobileWebKit = safariWebKit && window.innerWidth <= 640;
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
    const deferred = new Map<HTMLElement, () => void>();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let previousScrollY = window.scrollY;
    let rapidJumpUntil = 0;
    let disposed = false;

    const flushDeferred = () => {
      if (disposed) return;
      for (const [card, build] of deferred) {
        deferred.delete(card);
        if (states.get(card) !== "queued") continue;
        const rect = card.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
          // A card scrolled past during a continuous flick must never remain
          // transparent now that the REAL card (not an inert shell) is hidden.
          // Restore its card and ALL inner elements before marking it played.
          const prepared = preparedCards.get(card);
          gsap.set([card,
            ...(prepared?.copyContainer ? [prepared.copyContainer] : []),
            ...(prepared?.copyParts ?? []),
            ...(prepared?.preview ? [prepared.preview] : []),
            ...(prepared?.visualParts ?? [])
          ], { clearProps: "transform,opacity,visibility" });
          states.set(card, "done");
          card.dataset.gsapPhase = "complete";
          card.dataset.gsapShown = "true";
          continue;
        }
        build();
      }
    };
    const scheduleIdle = () => {
      if (!mobileWebKit || disposed || !deferred.size) return;
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimer = undefined;
        // A WebKit long frame can outlive an idle timer even while a flick is
        // still in progress. Require two successive stable paint opportunities
        // before beginning any GSAP timeline. Otherwise the next scroll frame
        // collides with the first expensive feature compositor allocation.
        const y = window.scrollY;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (disposed || !deferred.size) return;
          if (Math.abs(window.scrollY - y) > 1) {
            scheduleIdle();
            return;
          }
          flushDeferred();
        }));
      }, performance.now() < rapidJumpUntil ? 430 : 85);
    };

    const cardObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < .08) continue;
        startCard(entry.target as HTMLElement);
      }
    }, { rootMargin: "0px 0px 42% 0px", threshold: [0, .08] });

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
        const leadEnd = innerHeight * 1.42;
        const visible = Math.max(0, Math.min(rect.bottom, leadEnd) - Math.max(rect.top, 0));
        if (rect.top <= leadEnd && rect.bottom > 0 &&
            visible >= Math.min(rect.height, leadEnd) * .08) startCard(card);
      }
    };
    const scheduleProbe = () => {
      if (disposed || !pending.size || scrollFrame) return;
      scrollFrame = requestAnimationFrame(probe);
    };
    const onScroll = () => {
      if (mobileWebKit) {
        const y = window.scrollY;
        if (Math.abs(y - previousScrollY) > 440) {
          // Allow the native WebGL refractive canvas to catch up after a
          // multi-screen flick before card transforms allocate textures.
          rapidJumpUntil = performance.now() + 680;
        }
        previousScrollY = y;
        if (deferred.size) scheduleIdle();
      }
      // The native IntersectionObserver starts every normal entrance.
      // Only check layout AFTER scrolling settles: WebKit cannot afford
      // forced getBoundingClientRect() reads during live glass frames.
      if (disposed || !pending.size) return;
      if (trailingProbeTimer !== undefined) clearTimeout(trailingProbeTimer);
      trailingProbeTimer = setTimeout(() => {
        trailingProbeTimer = undefined;
        scheduleProbe();
      }, 95);
    };
    const onResize = () => {
      if (mobileWebKit && deferred.size) scheduleIdle();
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
        // The REAL article starts off-canvas, not a decorative shadow.
        // Children are pre-hidden at mount and enter from the other side
        // only after the article's own colored background has arrived.
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
            gsap.set([card, ...(copyContainer ? [copyContainer] : []), ...copyParts, ...visualParts, ...(preview ? [preview] : [])], {
              clearProps: "transform,opacity,visibility"
            });
            running.delete(timeline);
          }
        });
        running.add(timeline);

        // The actual background, border, shadow and card box enter together.
        // Card content remains invisible until the background settles.
        timeline.to(card, {
          x: 0, opacity: 1, force3D: false,
          duration: .42, ease: "power3.out"
        }, 0);
        // Opposing copy motion, with separate sequential text reveals.
        if (copyContainer) timeline.to(copyContainer, {
          x: 0, force3D: false, duration: .4
        }, .26);
        copyParts.forEach((part, i) => timeline.to(part, {
          opacity: 1, duration: .22
        }, .32 + i * .085));
        if (preview) {
          const previewAt = .43 + copyParts.length * .085;
          const mobileLayers = innerWidth <= 640;
          timeline.set(preview, { visibility: "visible" }, previewAt);
          // On narrow mobile WebKit, painting a moving illustrated phone
          // while animating its nested rows caused frame spikes. The numbered
          // copy still slides from the opposite side; the phone builds in
          // place with separate, genuinely sequential GSAP row fades.
          timeline.to(preview, {
            x: 0, opacity: 1, force3D: false, duration: .32
          }, previewAt);
          timeline.set(visualParts, {
            ...(mobileLayers ? {} : { x: -12 * direction, force3D: false }),
            opacity: 0
          }, previewAt - .12);
          visualParts.forEach((part, i) => timeline.to(part, {
            ...(mobileLayers ? {} : { x: 0, force3D: false }),
            opacity: 1, duration: .17, ease: "power2.out"
          }, previewAt + .12 + i * .065));
        }
      };

      // Safari's live WebGL refraction cannot afford a new animated card
      // compositor layer on the same scroll frame. Trigger 42% of a viewport
      // EARLIER, then begin at the first short idle moment (85ms). Desktop
      // Chromium/Edge enters immediately with the fast timeline.
      if (mobileWebKit) {
        deferred.set(card, build);
        scheduleIdle();
        return;
      }
      // Paired cards must not produce two compositing bursts on the same frame.
      const secondInRow = innerWidth > 600 &&
        Array.from(card.parentElement?.children ?? []).indexOf(card) > 0;
      if (secondInRow) {
        const delayed = gsap.delayedCall(.24, () => {
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
      const shell = card; // Full card is the visual surface, not an overlay.
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
      // Prepare every real article off to the side well before intersection.
      // With CSS no longer overriding inline transforms, the whole card moves.
      affected.add(card);
      gsap.set(card, { x: (mobileWebKit ? 56 : 86) * direction,
        opacity: 0, force3D: false });
      if (copyContainer) {
        affected.add(copyContainer);
        gsap.set(copyContainer, { x: (mobileWebKit ? 23 : 32) * opposite, force3D: false });
      }
      for (const part of copyParts) affected.add(part);
      gsap.set(copyParts, { opacity: 0 });
      if (preview) {
        affected.add(preview);
        gsap.set(preview, {
          x: (mobileWebKit ? 22 : 28) * opposite,
          opacity: 0, visibility: "hidden", force3D: false
        });
      }
      for (const part of visualParts) affected.add(part);
      pending.add(card);
      cardObserver.observe(card);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    requestAnimationFrame(probe);

    // Real WebKit benchmarks show that even a small opacity tween on this
    // large Persian heading can stall the first GPU scroll frame for >1s.
    // Keep the text immediately legible on Safari; the original clipped
    // GSAP heading remains on Chromium. Other GSAP card/footer entrances
    // and the real liquid-glass shader are entirely unchanged.
    const title = root.querySelector<HTMLElement>(".ap-motion-reveal-title");
    const titleText = title?.querySelector<HTMLElement>("span");
    let headingTrigger: ScrollTrigger | undefined;
    if (!skipHeading && !safariWebKit &&
        title && titleText && title.dataset.gsapShown !== "true") {
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
      if (idleTimer !== undefined) clearTimeout(idleTimer);
      deferred.clear();
      cardObserver.disconnect();
      footerObservers.forEach(observer => observer.disconnect());
      headingTrigger?.kill();
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
