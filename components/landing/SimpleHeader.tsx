"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import LiquidGlass from "simple-liquid-glass";
import { ArrowUpLeft, Menu, X } from "lucide-react";

const menuItems = [
  { href:"#features", label:"امکانات" },
  { href:"/privacy-policy", label:"حفظ حریم خصوصی" },
  { href:"/terms", label:"قوانین و مقررات" },
  { href:"/data-deletion", label:"حذف اطلاعات" },
  { href:"/contact", label:"ارتباط با ما" },
  { href:"/about", label:"درباره ما" },
] as const;

/**
 * Real rounded-lens optics, not a translucent white/blurred rectangle.
 * A strong displacement field bends content at the edge and the dome.
 * At rest, underlying type and gradients remain legible through the lens.
 * SVG rendering refracts in Chromium; WebKit picks its WebGL scene source.
 */
const glassProps = {
  refraction:"lens" as const,
  lensProfile:"loupe" as const,
  lensOptions:{
    strength:.23,
    depth:.58,
    curvature:.62,
    bend:.77,
    bendWidth:.22,
    sheen:1.65,
    sheenWidth:6.5,
    sheenAngle:-34,
    specular:2.15,
    glow:.13,
    glowSpread:.55,
    glowFalloff:1.7,
    brightness:0,
  },
  quality:"extreme" as const,
  mobileFallback:"svg" as const,
  // No frosted shader: glass is clear, refraction is what creates its look.
  frost:0,
  blur:0,
  saturation:130,
  dispersion:58,
  scale:200,
  aberrationIntensity:.38,
  glassColor:"rgba(255,255,255,0.032)",
  background:"rgba(255,255,255,0.012)",
};

/**
 * Actual refracting glass, backed by LandingGlassBackdrop / LiquidGlassScene.
 * A normal CSS backdrop-filter alone cannot refract on iPhone.
 */
export function SimpleHeader() {
  const [open,setOpen]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLElement>(null);
  const returnFocus=useRef(true);
  const closeOnNavigate=()=>{returnFocus.current=false;setOpen(false);};

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
      if(returnFocus.current&&toggleRef.current?.getClientRects().length)
        toggleRef.current.focus();
    };
  },[open]);

  return (
    <header className="ap-header">
      <LiquidGlass {...glassProps} className="ap-header__backdrop" radius={25}
        style={{position:"absolute",inset:0,pointerEvents:"none"}} >
        <div className="ap-header__refraction-grain" aria-hidden="true"/>
      </LiquidGlass>
      <div className="ap-shell ap-header__inner">
        <div className="ap-menu-toggle__holder">
          <LiquidGlass {...glassProps} radius={24} className="ap-menu-toggle__glass"
            liquid="flow" liquidSpeed={0.75} liquidScale={0.38}>
            <button ref={toggleRef} className="ap-menu-toggle" type="button"
              aria-label={open?"بستن منو":"باز کردن منو"}
              aria-controls="ap-menu" aria-expanded={open}
              onClick={()=>{returnFocus.current=true;setOpen(v=>!v);}}>
              {open?<X size={21}/>:<Menu size={21}/>}
            </button>
          </LiquidGlass>
        </div>
        <Link href="/" className="ap-brand ap-header__logo" aria-label="دایرا، صفحه اصلی">
          <Image src="/daira-header-logo-hd.webp" alt="" width={36} height={36} priority sizes="36px"/>
          <span>دایرا</span>
        </Link>
        <Link className="ap-header__panel-login" href="/login">
          ورود به پنل <ArrowUpLeft size={15} aria-hidden="true"/>
        </Link>
      </div>

      <button className={"ap-menu-overlay"+(open?" ap-menu-overlay--open":"")}
        type="button" disabled={!open} tabIndex={open?0:-1}
        aria-label="بستن منو" onClick={()=>setOpen(false)}/>

      <aside id="ap-menu" ref={menuRef}
        className={"ap-menu"+(open?" ap-menu--open":"")}
        role="dialog" aria-label="منوی اصلی دایرا"
        aria-modal={open?true:undefined} aria-hidden={!open} inert={!open}>
        <LiquidGlass {...glassProps} radius={28} className="ap-menu__liquid"
          liquid="wobble" liquidSpeed={0.46} liquidScale={0.28}>
          <div className="ap-menu__content">
            <div className="ap-menu__top">
              <strong>دایرا</strong>
              <button type="button" ref={closeRef} aria-label="بستن منو" onClick={()=>setOpen(false)}>
                <X size={20}/>
              </button>
            </div>
            <nav className="ap-menu__nav" aria-label="صفحات دایرا">
              {menuItems.map((item,i)=>(
                <Link
                  key={item.href} href={item.href} onClick={closeOnNavigate}
                  className="ap-menu__item" style={{"--enter-index":i} as CSSProperties}>
                  {item.label}
                  <ArrowUpLeft size={17} aria-hidden="true"/>
                </Link>
              ))}
            </nav>
          </div>
        </LiquidGlass>
      </aside>
    </header>
  );
}
