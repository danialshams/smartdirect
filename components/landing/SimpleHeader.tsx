"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import LiquidGlass from "simple-liquid-glass";
import { ArrowUpLeft, Menu, X } from "lucide-react";

const menuItems = [
  { href:"/#features", label:"امکانات" },
  { href:"/privacy-policy", label:"حفظ حریم خصوصی" },
  { href:"/terms", label:"قوانین و مقررات" },
  { href:"/data-deletion", label:"حذف اطلاعات" },
  { href:"/contact", label:"ارتباط با ما" },
  { href:"/about", label:"درباره ما" },
] as const;

/**
 * Each surface is one optical lens, with zero frost/blur.
 * Borders are disabled at the component level, not only via CSS.
 */
const optics = {
  refraction:"lens" as const,
  lensProfile:"loupe" as const,
  lensOptions:{
    strength:.09,depth:.3,curvature:.48,bend:.51,bendWidth:.16,
    sheen:1.12,sheenWidth:7,sheenAngle:-30,specular:1.35,
    glow:.08,glowSpread:.4,glowFalloff:1.6,brightness:0,
  },
  quality:"standard" as const,
  mobileFallback:"svg" as const,
  frost:0,
  blur:0,
  scale:135,
  saturation:110,
  dispersion:17,
  aberrationIntensity:.11,
  borderColor:"rgba(255,255,255,0)",
  glassColor:"rgba(255,255,255,.035)",
  background:"rgba(255,255,255,.01)",
};

const menuOptics = {
  ...optics,
  lensOptions:{...optics.lensOptions,strength:.05,bend:.36,sheen:1.03},
  scale:102,dispersion:8,aberrationIntensity:.055,
  glassColor:"rgba(255,255,255,.13)",
  frost:.12,
  blur:2,
};

const blueOptics = {
  ...optics,
  lensOptions:{...optics.lensOptions,strength:.13,curvature:.58,specular:1.65},
  glassColor:"rgba(36,100,243,.45)",
  background:"rgba(36,100,243,.65)",
  scale:150,
};

export function SimpleHeader() {
  const [open,setOpen]=useState(false);
  const [hasOpened,setHasOpened]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLElement>(null);
  const returnFocus=useRef(true);

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
      <LiquidGlass
        {...optics}
        radius={26}
        className="ap-header__backdrop"
        style={{position:"absolute",inset:0,pointerEvents:"none"}}
      >
        <span className="ap-header__lens-fill" aria-hidden="true"/>
      </LiquidGlass>

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
          onClick={()=>{returnFocus.current=true;setHasOpened(true);setOpen(value=>!value);}}
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
          <LiquidGlass
            {...blueOptics}
            radius={24}
            className="ap-header__login-lens"
            style={{position:"absolute",inset:0,pointerEvents:"none"}}
          >
            <span className="ap-header__login-fill" aria-hidden="true"/>
          </LiquidGlass>
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
        {hasOpened && <LiquidGlass {...menuOptics} radius={28} className="ap-menu__liquid">
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
        </LiquidGlass>}
      </aside>
    </header>
  );
}
