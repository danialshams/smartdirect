"use client";

import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronUp } from "lucide-react";

type CardState = "waiting" | "queued" | "playing" | "done";

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

    // Some WebKit versions miss an observer callback after an instantaneous
    // jump/resize. One passive, RAF-coalesced fallback checks ONLY queued cards.
    let scrollFrame = 0;
    const probe = () => {
      scrollFrame = 0;
      for (const card of pending) {
        const rect = card.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, innerHeight * .73) - Math.max(rect.top, 0));
        if (rect.top <= innerHeight * .73 && rect.bottom > 0 &&
            visible >= Math.min(rect.height, innerHeight * .73) * .24) startCard(card);
      }
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(probe);
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
        const opposite = -direction;
        const copyParts = unique([
          card.querySelector<HTMLElement>(".ap-social-card__index"),
          card.querySelector<HTMLElement>(".ap-social-card__count"),
          card.querySelector<HTMLElement>(".ap-social-card__copy h3"),
          card.querySelector<HTMLElement>(".ap-social-card__copy p")
        ]);
        const shell = card.querySelector<HTMLElement>(".ap-social-card__shell");
        const preview = card.querySelector<HTMLElement>(".ig-preview");
        // Actual distinct blocks of the Instagram illustration, in DOM order.
        // Do not animate every leaf icon (too many Safari compositor layers).
        const groups = ".ig-chat, .ig-story, .ig-live, .ig-photo-grid, .ig-insights-bars, .ig-menu-sheet";
        const visualParts = preview ? Array.from(preview.children).flatMap(child => {
          if (!(child instanceof HTMLElement)) return [];
          if (child.matches(groups)) return Array.from(child.children).filter(
            (part): part is HTMLElement => part instanceof HTMLElement
          );
          return [child];
        }) : [];

        card.dataset.gsapStages = String(1 + copyParts.length + (preview ? 1 : 0) + visualParts.length);
        for (const element of [card, ...(shell ? [shell] : []), ...copyParts, ...visualParts, ...(preview ? [preview] : [])]) {
          affected.add(element);
        }
        // Everything is prepared while its parent card is still hidden.
        // Each stage begins ONLY after the previous stage has entered.
        if (shell) gsap.set(shell, { x: 54 * direction, opacity: 0 });
        gsap.set(copyParts, { x: 22 * opposite, opacity: 0 });
        if (preview) gsap.set(preview, { x: 20 * opposite, opacity: 0 });
        // The entire phone enters from the opposite direction. Its many
        // internal rows build one by one using alpha only to avoid creating
        // a separate Safari GPU transform layer for every illustrated row.
        gsap.set(visualParts, { opacity: 0 });

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
          }
        });
        running.add(timeline);

        // 01 outer shell: right, 02 outer shell: left, alternating globally.
        if (shell) timeline.to(shell, { x: 0, opacity: 1, duration: .64 }, 0);
        // Opposing direction. Each number, title and description owns a slot.
        copyParts.forEach((part, i) => timeline.to(part, {
          x: 0, opacity: 1, duration: .36
        }, .56 + i * .16));
        if (preview) {
          const previewAt = .56 + copyParts.length * .16 + .20;
          timeline.to(preview, { x: 0, opacity: 1, duration: .38 }, previewAt);
          visualParts.forEach((part, i) => timeline.to(part, {
            opacity: 1, duration: .26, ease: "power2.out"
          }, previewAt + .35 + i * .14));
        }
      };

      // Paired cards must not produce two compositing bursts on the same frame.
      const secondInRow = Array.from(card.parentElement?.children ?? []).indexOf(card) > 0;
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
      // Hide only lightweight independent surfaces. Hiding the entire card
      // forces Safari to flatten/recapture all nested Instagram content.
      // Each visual layer is now prepared independently without a giant
      // opacity group, so GPU work remains bounded to each reveal stage.
      const shell = card.querySelector<HTMLElement>(".ap-social-card__shell");
      const preview = card.querySelector<HTMLElement>(".ig-preview");
      const copyNodes = Array.from(card.querySelectorAll<HTMLElement>(
        ".ap-social-card__index, .ap-social-card__count, .ap-social-card__copy h3, .ap-social-card__copy p"
      ));
      const prepared = [...(shell ? [shell] : []), ...copyNodes,
        ...(preview ? [preview] : [])];
      prepared.forEach(node => affected.add(node));
      gsap.set(prepared, { opacity: 0 });
      pending.add(card);
      cardObserver.observe(card);
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
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
      }, { rootMargin: "0px 0px -9% 0px", threshold: 0 });
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
      removeEventListener("resize", onScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
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
