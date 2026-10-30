"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, Menu, X } from "lucide-react";

const links = [
  { href: "#features", label: "امکانات" },
  { href: "#how", label: "نحوه کار" },
  { href: "#faq", label: "سؤالات متداول" },
] as const;

export function SimpleHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (toggle.current?.getClientRects().length) toggle.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const largeScreen = window.matchMedia("(min-width: 861px)");
    const onChange = () => { if (largeScreen.matches) setOpen(false); };
    largeScreen.addEventListener("change", onChange);
    return () => largeScreen.removeEventListener("change", onChange);
  }, [open]);

  return (
    <header className="sh-header">
      <div className="sh-container sh-header__inner">
        <Link href="/" className="sh-brand" aria-label="دایرا، صفحه اصلی"><Image src="/daira-header-logo-hd.webp" width={90} height={90} alt="" priority sizes="44px"/><span>دایرا</span></Link>
        <nav className="sh-nav" aria-label="ناوبری اصلی">{links.map(item=><a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="sh-header__actions"><Link className="sh-header__login" href="/login">ورود به پنل</Link><Link className="sh-button sh-button--primary sh-header__start" href="/login">شروع استفاده <ArrowUpLeft size={16}/></Link></div>
        <button type="button" ref={toggle} className="sh-menu-toggle" aria-label={open ? "بستن منو" : "باز کردن منو"} aria-expanded={open} aria-controls="sh-menu-panel" onClick={() => setOpen(v => !v)}>{open ? <X size={22}/> : <Menu size={22}/>}</button>
      </div>
      <button type="button" className={"sh-menu-backdrop"+(open?" sh-menu-backdrop--open":"")} aria-label="بستن منو" tabIndex={open ? 0 : -1} disabled={!open} onClick={()=>setOpen(false)} />
      <div id="sh-menu-panel" className={"sh-menu-panel"+(open?" sh-menu-panel--open":"")} ref={panel} inert={!open} aria-hidden={!open}>
        <div className="sh-menu-panel__head"><strong>منوی دایرا</strong><button type="button" ref={closeButton} aria-label="بستن منو" onClick={()=>setOpen(false)}><X size={20}/></button></div>
        <nav aria-label="منوی موبایل">{links.map(item=><a key={item.href} href={item.href} onClick={()=>setOpen(false)}>{item.label}<ArrowLeft size={17}/></a>)}</nav>
        <Link href="/login" className="sh-button sh-button--primary sh-menu-panel__start" onClick={()=>setOpen(false)}>شروع استفاده <ArrowUpLeft size={17}/></Link>
        <Link href="/login" className="sh-menu-panel__login" onClick={()=>setOpen(false)}>ورود به پنل</Link>
        <div className="sh-menu-panel__legal"><Link href="/privacy-policy" onClick={()=>setOpen(false)}>حریم خصوصی</Link><Link href="/data-deletion" onClick={()=>setOpen(false)}>حذف اطلاعات</Link></div>
      </div>
    </header>
  );
}

export function RevealOnScroll() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".sh-reveal"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      elements.forEach(el=>el.classList.add("sh-is-visible"));
      return;
    }
    document.documentElement.classList.add("sh-animations-ready");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry=>{
        if (entry.isIntersecting) {
          entry.target.classList.add("sh-is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -18px 0px" });
    elements.forEach(el=>observer.observe(el));
    return ()=>{observer.disconnect();document.documentElement.classList.remove("sh-animations-ready");};
  }, []);
  return null;
}
