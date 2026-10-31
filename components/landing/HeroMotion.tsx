"use client";

import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Subtle entrance animations without hiding the SSR page or requiring WebGL. */
export function HeroMotion() {
  useLayoutEffect(() => {
    if (window.location.hash) return;
    const prior = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const reset = () => window.scrollTo(0, 0);
    reset();
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.history.scrollRestoration = prior;
    };
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power3.out" }, delay: .12 })
        .from("[data-hero-entrance]", {
          y: 24, autoAlpha: 0, duration: .83, stagger: .10, clearProps: "all",
        }, 0);

      gsap.utils.toArray<HTMLElement>(".sh-reveal").forEach(el => {
        gsap.fromTo(el, { y: 28, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: .8, ease: "power2.out",
          clearProps: "all",
          scrollTrigger: { trigger: el, start: "top 93%", once: true },
        });
      });

      gsap.to(".sh-preview__float--one", {
        y: -8, duration: 3.8, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
      gsap.to(".sh-preview__float--two", {
        y: 7, duration: 4.7, repeat: -1, yoyo: true, ease: "sine.inOut",
      });
    });

    return () => context.revert();
  }, []);

  return null;
}
