"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function LandingInteractions() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ap-site");
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || reduced || !("IntersectionObserver" in window)) {
      targets.forEach(element => element.setAttribute("data-visible", "true"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: "0px 0px -20px 0px" });
    targets.forEach(element => observer.observe(element));
    root.setAttribute("data-motion-ready", "true");
    return () => { observer.disconnect(); root.removeAttribute("data-motion-ready"); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setShowTop(window.scrollY > 520);
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
    <button type="button"
      className={"ap-backtop" + (showTop ? " ap-backtop--visible" : "")}
      data-liquid-glass-ignore=""
      aria-label="بازگشت به بالای صفحه"
      title="بازگشت به بالا"
      disabled={!showTop}
      tabIndex={showTop ? 0 : -1}
      onClick={goToTop}>
      <ArrowUp size={23} strokeWidth={2.35} aria-hidden="true" />
    </button>
  );
}
