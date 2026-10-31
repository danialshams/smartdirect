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
    strength:.11,
    depth:.34,
    curvature:.55,
    bend:.55,
    bendWidth:.18,
    sheen:1.32,
    sheenWidth:6.5,
    sheenAngle:-34,
    specular:1.65,
    glow:.09,
    glowSpread:.48,
    glowFalloff:1.6,
    brightness:0,
  },
  quality:"high" as const,
  mobileFallback:"svg" as const,
  frost:0,
  blur:0,
  saturation:120,
  dispersion:24,
  scale:156,
  aberrationIntensity:.16,
  glassColor:"rgba(255,255,255,0.026)",
  background:"rgba(255,255,255,0.012)",
};

/** A smaller, clearer displacement on the large menu preserves typography.
 * Edge bending and specular highlights still make it a real glass lens.
 */
const menuGlassProps = {
  ...glassProps,
  lensOptions:{
    ...glassProps.lensOptions,
    strength:.045,
    depth:.24,
    curvature:.43,
    bend:.47,
    bendWidth:.12,
    sheen:1.25,
    specular:1.55,
  },
  dispersion:15,
  aberrationIntensity:.08,
  scale:106,
  glassColor:"rgba(255,255,255,0.055)",
};

/** The small circular control can afford stronger optical curvature. */
const toggleGlassProps = {
  ...glassProps,
  lensOptions:{
    ...glassProps.lensOptions,
    strength:.17,
    depth:.52,
    curvature:.68,
    bend:.63,
    specular:1.95,
  },
  dispersion:32,
  aberrationIntensity:.23,
  scale:181,
};

/**
 * Actual refracting glass, backed by LandingGlassBackdrop / LiquidGlassScene.
 * A normal CSS backdrop-filter alone cannot refract on iPhone.
 */
export function SimpleHeader() {
  const [open,setOpen]=useState(false);
  const [menuOnDark,setMenuOnDark]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLElement>(null);
  const returnFocus=useRef(true);
  const closeOnNavigate=()=>{returnFocus.current=false;setOpen(false);};

  // Keep text legible when a clear refracting menu sits over a dark scene.
  // Sampling before opening avoids selecting the modal or its overlay.
  useEffect(()=>{
    const update=()=>{
      const underlying=document.elementFromPoint(window.innerWidth/2,Math.min(115,window.innerHeight-1));
      setMenuOnDark(Boolean(underlying?.closest(".ap-showcase-scene--midnight,.ap-showcase-scene--violet")));
    };
    update();
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return ()=>{
      window.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);
    };
  },[]);

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
          <LiquidGlass {...toggleGlassProps} radius={24} className="ap-menu-toggle__glass"
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
        className={"ap-menu"+(open?" ap-menu--open":"")+(menuOnDark?" ap-menu--dark":"")}
        role="dialog" aria-label="منوی اصلی دایرا"
        aria-modal={open?true:undefined} aria-hidden={!open} inert={!open}>
        <LiquidGlass {...menuGlassProps} radius={28} className="ap-menu__liquid">
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
