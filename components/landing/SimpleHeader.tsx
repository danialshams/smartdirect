"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft, Menu, X } from "lucide-react";

const nav = [
  { href: "#experience", label: "معرفی" },
  { href: "#features", label: "امکانات" },
] as const;

export function SimpleHeader() {
  const [open,setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(true);
  const onNavigate = () => { restoreFocus.current=false; setOpen(false); };

  useEffect(()=>{
    if(!open)return;
    const old=document.body.style.overflow;
    document.body.style.overflow="hidden";
    close.current?.focus();
    const onKey = (e:KeyboardEvent)=>{
      if(e.key==="Escape"){setOpen(false);return;}
      if(e.key!=="Tab"||!panel.current)return;
      const all=Array.from(panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      const first=all[0],last=all[all.length-1];
      if(!first||!last)return;
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    };
    const media=window.matchMedia("(min-width: 800px)");
    const onResize=()=>{if(media.matches)setOpen(false);};
    window.addEventListener("keydown",onKey);
    media.addEventListener("change",onResize);
    return ()=>{
      document.body.style.overflow=old;
      window.removeEventListener("keydown",onKey);
      media.removeEventListener("change",onResize);
      if(restoreFocus.current&&toggle.current?.getClientRects().length)toggle.current.focus();
    };
  },[open]);

  return (
    <header className="ap-header">
      <div className="ap-shell ap-header__inner">
        <Link className="ap-brand" href="/" aria-label="دایرا، صفحه اصلی">
          <Image src="/daira-header-logo-hd.webp" alt="" width={38} height={38} priority sizes="38px"/>
          <span>دایرا</span>
        </Link>
        <nav className="ap-header__nav" aria-label="ناوبری اصلی">
          {nav.map(link=><a href={link.href} key={link.href}>{link.label}</a>)}
        </nav>
        <div className="ap-header__actions">
          <Link className="ap-header__login" href="/login">ورود</Link>
          <Link className="ap-header__cta" href="/login">شروع کن <ArrowUpLeft size={15} aria-hidden="true"/></Link>
        </div>
        <button className="ap-menu-toggle" ref={toggle} type="button"
          aria-label={open?"بستن منو":"باز کردن منو"}
          aria-controls="ap-menu" aria-expanded={open}
          onClick={()=>{restoreFocus.current=true;setOpen(x=>!x);}}>
          {open?<X size={21}/>:<Menu size={21}/>}
        </button>
      </div>
      <button className={"ap-menu-overlay"+(open?" ap-menu-overlay--open":"")}
        aria-label="بستن منو" tabIndex={open?0:-1} disabled={!open}
        type="button" onClick={()=>setOpen(false)}/>
      <div className={"ap-menu"+(open?" ap-menu--open":"")}
        id="ap-menu" role="dialog" aria-label="منوی دایرا"
        aria-modal={open?"true":undefined}
        ref={panel} inert={!open} aria-hidden={!open}>
        <div className="ap-menu__top">
          <strong>دایرا</strong>
          <button type="button" ref={close} aria-label="بستن منو" onClick={()=>setOpen(false)}><X size={21}/></button>
        </div>
        <nav aria-label="ناوبری موبایل">
          {nav.map(link=><a href={link.href} key={link.href} onClick={onNavigate}>{link.label}</a>)}
          <Link href="/login" onClick={onNavigate}>ورود به پنل</Link>
        </nav>
        <Link className="ap-button ap-button--solid ap-menu__start" href="/login" onClick={onNavigate}>
          شروع با دایرا <ArrowUpLeft size={17} aria-hidden="true"/>
        </Link>
      </div>
    </header>
  );
}
