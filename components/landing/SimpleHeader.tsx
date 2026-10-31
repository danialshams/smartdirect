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
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(true);
  const navigate = () => { returnFocus.current = false; setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocus.current && menuButton.current?.getClientRects().length) menuButton.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const breakpoint = window.matchMedia("(min-width: 861px)");
    const close = () => { if (breakpoint.matches) setOpen(false); };
    breakpoint.addEventListener("change", close);
    return () => breakpoint.removeEventListener("change", close);
  }, [open]);

  return (
    <header className="sh-header">
      <div className="sh-container sh-header__inner">
        <Link href="/" className="sh-brand" aria-label="دایرا، صفحه اصلی">
          <Image src="/daira-header-logo-hd.webp" width={44} height={44} alt="" priority sizes="44px" />
          <span>دایرا</span>
        </Link>
        <nav className="sh-nav" aria-label="ناوبری اصلی">
          {links.map(item=><a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <div className="sh-header__actions">
          <Link href="/login" className="sh-header__login">ورود</Link>
          <Link href="/login" className="sh-button sh-button--primary sh-header__start">شروع استفاده <ArrowUpLeft size={16} aria-hidden="true"/></Link>
        </div>
        <button className="sh-menu-toggle" type="button" ref={menuButton}
          aria-label={open ? "بستن منو" : "باز کردن منو"}
          aria-expanded={open} aria-controls="sh-menu-panel"
          onClick={()=>{returnFocus.current=true;setOpen(current=>!current);}}>
          {open?<X size={22}/>:<Menu size={22}/>}
        </button>
      </div>

      <button type="button" className={"sh-menu-backdrop"+(open?" sh-menu-backdrop--open":"")}
        disabled={!open} tabIndex={open?0:-1} aria-label="بستن منو"
        onClick={()=>setOpen(false)}/>

      <div id="sh-menu-panel" ref={panel}
        className={"sh-menu-panel"+(open?" sh-menu-panel--open":"")}
        aria-hidden={!open} inert={!open}>
        <div className="sh-menu-panel__head">
          <strong>منوی دایرا</strong>
          <button type="button" ref={closeButton} aria-label="بستن منو" onClick={()=>setOpen(false)}><X size={21}/></button>
        </div>
        <nav aria-label="منوی موبایل">
          {links.map(item=><a key={item.href} href={item.href} onClick={navigate}>{item.label}<ArrowLeft size={17} aria-hidden="true"/></a>)}
        </nav>
        <Link href="/login" onClick={navigate} className="sh-button sh-button--primary sh-menu-panel__start">شروع با دایرا <ArrowUpLeft size={18} aria-hidden="true"/></Link>
        <Link href="/login" onClick={navigate} className="sh-menu-panel__login">ورود به پنل</Link>
        <div className="sh-menu-panel__legal">
          <Link href="/privacy-policy" onClick={navigate}>حریم خصوصی</Link>
          <Link href="/data-deletion" onClick={navigate}>حذف اطلاعات</Link>
        </div>
      </div>
    </header>
  );
}
