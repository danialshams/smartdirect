"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { LiquidHeaderSurface } from "./LiquidHeaderSurface";
import { ArrowUpLeft, Menu, X } from "lucide-react";

const menuItems = [
  { href:"/#features", label:"امکانات" },
  { href:"/privacy-policy", label:"حفظ حریم خصوصی" },
  { href:"/terms", label:"قوانین و مقررات" },
  { href:"/data-deletion", label:"حذف اطلاعات" },
  { href:"/contact", label:"ارتباط با ما" },
  { href:"/about", label:"درباره ما" },
] as const;

/** The menu uses a single prepainted surface. Only the header refracts. */
export function SimpleHeader() {
  const [open,setOpen]=useState(false);
  const [glassMounted,setGlassMounted]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLElement>(null);
  const returnFocus=useRef(true);

  // Keep the *same native lens* alive throughout the exit animation.
  // Unmounting it on the first close frame creates a distracting white flash.
  useEffect(()=>{
    if(open){setGlassMounted(true);return;}
    const timer=window.setTimeout(()=>setGlassMounted(false),580);
    return ()=>window.clearTimeout(timer);
  },[open]);

  const closeOnNavigate=()=>{
    returnFocus.current=false;
    setOpen(false);
  };

  useEffect(()=>{
    if(!open)return;
    const prior=document.body.style.overflow;
    document.body.style.overflow="hidden";
    closeRef.current?.focus();

    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setOpen(false);return;}
      if(event.key!=="Tab"||!menuRef.current)return;
      const options=Array.from(menuRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      const first=options[0],last=options[options.length-1];
      if(!first||!last)return;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",onKey);
    return ()=>{
      document.body.style.overflow=prior;
      document.removeEventListener("keydown",onKey);
      if(returnFocus.current&&toggleRef.current?.getClientRects().length)toggleRef.current.focus();
    };
  },[open]);

  return (
    <header className="ap-header" data-landing-header data-liquid-glass-ignore="">
      <LiquidHeaderSurface />

      {/*
        The entire header is excluded from the scene capture. Simply ignoring
        the inner controls lets the header shell remain a captured tile and
        creates a recursive-looking ghost in Safari as the snapshot updates.
        Lenses still refract the real page sections scrolling behind the header.
      */}
      <div className="ap-shell ap-header__inner" data-liquid-glass-ignore="">
        <button
          ref={toggleRef}
          className="ap-menu-toggle"
          type="button"
          aria-label={open?"بستن منو":"باز کردن منو"}
          aria-controls="ap-menu"
          aria-expanded={open}
          onClick={()=>{returnFocus.current=true;if(!open)setGlassMounted(true);setOpen(value=>!value);}}
        >
          <span className={"ap-menu-toggle__glyphs"+(open?" ap-menu-toggle__glyphs--open":"")} aria-hidden="true">
            <Menu size={21} className="ap-menu-toggle__hamburger"/>
            <X size={21} className="ap-menu-toggle__close"/>
          </span>
        </button>

        <Link href="/" className="ap-brand ap-header__logo" aria-label="دایرا، صفحه اصلی">
          <Image src="/daira-header-logo-hd.webp" alt="" width={36} height={36} priority sizes="36px"/>
          <span>دایرا</span>
        </Link>

        <div className="ap-header__login-holder">
          <Link href="/login" className="ap-header__panel-login">
            ورود به پنل <ArrowUpLeft size={15} aria-hidden="true"/>
          </Link>
        </div>
      </div>

      <button
        type="button"
        className={"ap-menu-overlay"+(open?" ap-menu-overlay--open":"")}
        data-liquid-glass-ignore=""
        disabled={!open}
        tabIndex={open?0:-1}
        aria-label="بستن منو"
        onClick={()=>setOpen(false)}
      />

      <aside
        id="ap-menu"
        ref={menuRef}
        className={"ap-menu"+(open?" ap-menu--open":"")}
        role="dialog"
        aria-label="منوی اصلی دایرا"
        aria-modal={open?true:undefined}
        aria-hidden={!open}
        inert={!open}
        data-liquid-glass-ignore=""
      >
        <div className="ap-menu__liquid">
          {glassMounted && <LiquidHeaderSurface variant="menu" />}
          <span className="ap-menu__frost" aria-hidden="true" />
          <div className="ap-menu__content">
            <div className="ap-menu__top">
              <strong>دایرا</strong>
              <button type="button" ref={closeRef} aria-label="بستن منو" onClick={()=>setOpen(false)}>
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <nav className="ap-menu__nav" aria-label="صفحات دایرا">
              {menuItems.map((item,index)=>(
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeOnNavigate}
                  className="ap-menu__item"
                  style={{"--enter-index":index} as CSSProperties}
                >
                  {item.label}
                  <ArrowUpLeft size={17} aria-hidden="true"/>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </aside>
    </header>
  );
}
