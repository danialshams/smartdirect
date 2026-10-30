"use client";

import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import {
  AtSign, BarChart3, BellRing, CalendarDays, CheckCheck, Headphones,
  Menu, MessageCircle, MessagesSquare, Radio, Send, Sparkles, WandSparkles,
} from "lucide-react";

/** Stable endpoints on first paint, randomized assembly and electrical flow after hydration. */
const cables = [
  { id: "comment", label: "پاسخ به کامنت", Icon: MessageCircle, x: 152, y: 106, sx: 508, sy: 261, path: "M508 261 C450 233 431 170 384 175 S298 105 235 133 S190 113 152 106", duration: 6.7, phase: -1.1 },
  { id: "story", label: "پاسخ به استوری", Icon: Sparkles, x: 184, y: 239, sx: 471, sy: 328, path: "M471 328 C414 315 443 242 356 263 S290 213 251 247 S207 233 184 239", duration: 7.9, phase: -3 },
  { id: "direct", label: "پاسخ خودکار دایرکت", Icon: Send, x: 139, y: 397, sx: 473, sy: 405, path: "M473 405 C395 365 392 425 334 401 S269 364 235 410 S170 391 139 397", duration: 6.4, phase: -2.3 },
  { id: "mention", label: "اشتراک‌گذاری و منشن", Icon: AtSign, x: 216, y: 552, sx: 514, sy: 489, path: "M514 489 C457 524 438 477 382 512 S322 536 278 505 S235 545 216 552", duration: 8.8, phase: -4 },
  { id: "live", label: "پاسخ به لایو", Icon: Radio, x: 358, y: 645, sx: 566, sy: 527, path: "M566 527 C510 558 552 614 473 598 S413 650 358 645", duration: 7.2, phase: -1.7 },
  { id: "reminder", label: "یادآوری هوشمند", Icon: BellRing, x: 612, y: 81, sx: 611, sy: 210, path: "M611 210 C649 168 570 164 612 121 S624 101 612 81", duration: 9.1, phase: -3.7 },
  { id: "inbox", label: "صندوق دایرکت", Icon: MessagesSquare, x: 1039, y: 116, sx: 715, sy: 257, path: "M715 257 C769 209 743 173 830 172 S921 96 972 134 S1004 110 1039 116", duration: 7.4, phase: -1.4 },
  { id: "publish", label: "انتشار محتوا", Icon: CalendarDays, x: 1027, y: 284, sx: 749, sy: 339, path: "M749 339 C809 312 812 276 869 308 S941 264 971 283 S1008 279 1027 284", duration: 8.4, phase: -3.5 },
  { id: "insights", label: "تحلیل پیج", Icon: BarChart3, x: 1076, y: 441, sx: 743, sy: 425, path: "M743 425 C809 391 812 454 875 426 S948 482 991 432 S1038 439 1076 441", duration: 6.9, phase: -2 },
  { id: "menu", label: "منوی دایرکت", Icon: Menu, x: 969, y: 572, sx: 691, sy: 511, path: "M691 511 C771 539 756 592 835 559 S899 587 935 569 S945 566 969 572", duration: 9.6, phase: -4.1 },
  { id: "icebreakers", label: "پیام شروع گفتگو", Icon: WandSparkles, x: 808, y: 650, sx: 639, sy: 530, path: "M639 530 C691 579 652 618 725 609 S765 653 808 650", duration: 7.6, phase: -2.8 },
] as const;

/**
 * Preserve the exact approved photoreal robot asset, with independently animated
 * optical dimmers over its painted irises and an SVG wire network.
 * This is a lightweight 2.5D visual, not a true mesh or orbitable 3D model.
 */
export function RobotHeroScene() {
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = true;
    let pending: gsap.core.Tween | undefined;
    let travelling: gsap.core.Tween | undefined;
    const ctx = gsap.context(() => {
      const assemble = stage.querySelectorAll("[data-robot-assembly]");
      gsap.from(assemble, {
        x: () => gsap.utils.random(-95,95),
        y: () => gsap.utils.random(-75,75),
        scale: () => gsap.utils.random(.86,1.12),
        rotation: () => gsap.utils.random(-11,11),
        opacity: 0,
        duration: 1.42,
        stagger: { each:.035, from:"random" },
        ease:"expo.out",
        delay:.12,
      });

      // Only the real eye apertures are dimmed. The painted details stay sharp.
      const dimmers=stage.querySelectorAll<SVGElement>(".sh-robot-eye-dimmer");
      gsap.timeline({ repeat:-1, repeatDelay:2.1, delay:1.6 })
        .set(dimmers,{opacity:1})
        .to(dimmers,{opacity:0,duration:.065})
        .to(dimmers,{opacity:1,duration:.095})
        .to(dimmers,{opacity:.03,duration:.13})
        .to(dimmers,{opacity:.9,duration:.075})
        .to(dimmers,{opacity:0,duration:.24,ease:"power2.out"})
        .to({}, {duration:1.7});

      gsap.to(".sh-robot-portrait", {
        y:-5, rotation:.36, duration:5.3, ease:"sine.inOut", repeat:-1, yoyo:true,
        transformOrigin:"50% 50%",
      });

      const paths=Array.from(stage.querySelectorAll<SVGPathElement>("[data-cable-path]"));
      const pulses=Array.from(stage.querySelectorAll<SVGGElement>("[data-cable-pulse]"));
      let previous=-1;

      const pulseOne=()=>{
        if(!active || !stage.isConnected) return;
        if(document.visibilityState==="hidden") {
          pending=gsap.delayedCall(1.5,pulseOne);return;
        }
        let index=Math.floor(Math.random()*paths.length);
        if(index===previous) index=(index+1+Math.floor(Math.random()*(paths.length-1)))%paths.length;
        previous=index;
        const path=paths[index],pulse=pulses[index],length=path.getTotalLength();
        const origin=path.getPointAtLength(0);
        pulse.setAttribute("transform", `translate(${origin.x} ${origin.y})`);
        gsap.set(pulse,{opacity:1});
        const travel={distance:0};
        travelling=gsap.to(travel,{
          distance:length,duration:gsap.utils.random(1.15,1.65),ease:"none",
          onUpdate:()=>{
            const pt=path.getPointAtLength(travel.distance);
            pulse.setAttribute("transform",`translate(${pt.x} ${pt.y})`);
          },
          onComplete:()=>{gsap.set(pulse,{opacity:0});},
        });
        pending=gsap.delayedCall(gsap.utils.random(3.8,6.2),pulseOne);
      };
      pending=gsap.delayedCall(2.8,pulseOne);
    },stage);
    return ()=>{active=false;pending?.kill();travelling?.kill();ctx.revert();};
  },[]);

  return (
    <div ref={stageRef} className="sh-robot-scene"
      aria-label="ربات سه‌بعدی‌نما و یازده قابلیت دایرا با کابل‌های متحرک و نورهای تصادفی">
      <div className="sh-robot-world">
        <svg className="sh-robot-svg" viewBox="0 0 1200 710" role="img"
          aria-label="ربات دایرا با چشم‌های نورانی و کابل‌های متصل به امکانات"
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dairaCable" x1="0" y1="0" x2=".75" y2="1">
              <stop stopColor="#39659c"/><stop offset=".45" stopColor="#c2d9ee"/><stop offset="1" stopColor="#4c85ce"/>
            </linearGradient>
            <radialGradient id="dairaPortraitFade" cx="0" cy="0" r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(585 350) scale(500 405)">
              <stop offset="0%" stopColor="#fff"/><stop offset="64%" stopColor="#fff"/>
              <stop offset="89%" stopColor="#fff" stopOpacity=".95"/>
              <stop offset="100%" stopColor="#000"/>
            </radialGradient>
            <mask id="dairaPortraitMask" maskUnits="userSpaceOnUse">
              <rect width="1200" height="710" fill="url(#dairaPortraitFade)"/>
            </mask>
            <radialGradient id="dairaEyeDim" cx=".5" cy=".5" r=".5">
              <stop offset="0%" stopColor="#081d39" stopOpacity=".98"/>
              <stop offset="51%" stopColor="#071a32" stopOpacity=".96"/>
              <stop offset="76%" stopColor="#092447" stopOpacity=".73"/>
              <stop offset="100%" stopColor="#04152b" stopOpacity="0"/>
            </radialGradient>
            <filter id="dairaPulseGlow" x="-250%" y="-250%" width="600%" height="600%">
              <feGaussianBlur stdDeviation="4"/>
            </filter>
          </defs>
          <g className="sh-robot-cables">
            {cables.map((cable)=>(
              <g data-robot-assembly="cable" key={cable.id}>
                <g className="sh-robot-cable-sway"
                   style={{transformOrigin:cable.sx+"px "+cable.sy+"px",animationDuration:cable.duration+"s",animationDelay:cable.phase+"s"} as CSSProperties}>
                  <path d={cable.path} fill="none" stroke="#41638a" strokeWidth="9" opacity=".13" strokeLinecap="round"/>
                  <path d={cable.path} fill="none" stroke="url(#dairaCable)" strokeWidth="5" strokeLinecap="round"/>
                  <path d={cable.path} fill="none" stroke="#f1faff" strokeWidth="1.15" opacity=".8" strokeLinecap="round"/>
                  <path d={cable.path} data-cable-path fill="none" stroke="transparent" strokeWidth=".5"/>
                  <g data-cable-pulse opacity="0" pointerEvents="none">
                    <circle r="13" fill="#68d5ff" opacity=".8" filter="url(#dairaPulseGlow)"/>
                    <circle r="5.2" fill="#55deff" stroke="#fff" strokeWidth="1.3"/>
                  </g>
                </g>
              </g>
            ))}
          </g>
          <g data-robot-assembly="portrait">
            <g className="sh-robot-portrait" style={{transformOrigin:"600px 350px"}}>
            <image href="/landing/daira-robot-hero.webp" x="0" y="17" width="1200" height="676"
              preserveAspectRatio="xMidYMid meet" mask="url(#dairaPortraitMask)"/>
            <g className="sh-robot-eye-dimmer" opacity="0">
              <ellipse cx="474" cy="282" rx="70" ry="66" fill="url(#dairaEyeDim)"/>
              <ellipse cx="677" cy="324" rx="60" ry="60" fill="url(#dairaEyeDim)"/>
            </g>
            </g>
          </g>
          {cables.map((cable)=>(
            <circle key={cable.id} cx={cable.x} cy={cable.y} r="5.5"
              fill="#73c9ff" stroke="#fff" strokeWidth="2" opacity=".82"/>
          ))}
        </svg>
        {cables.map((cable)=>{
          const Icon=cable.Icon;
          return (
            <div className={"sh-robot-node-anchor sh-robot-node-anchor--"+cable.id}
                 data-robot-assembly="node" key={cable.id}
                 style={{left:(cable.x/1200*100)+"%",top:(cable.y/710*100)+"%"}}>
              <div className="sh-robot-node"
                style={{animationDuration:(cable.duration+1)+"s",animationDelay:cable.phase+"s"}}>
                <span className="sh-robot-node__icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true"/></span>
                <span className="sh-robot-node__label">{cable.label}</span>
              </div>
            </div>
          );
        })}
        <span className="sh-robot-scene__caption" aria-hidden="true">
          <Headphones size={13}/> DAIRA · CONNECTED INTELLIGENCE <CheckCheck size={13}/>
        </span>
      </div>
      <div className="sh-robot-mobile-features" aria-label="امکانات متصل به ربات دایرا">
        {cables.map(cable=>{
          const Icon=cable.Icon;
          return <div className="sh-robot-mobile-feature" key={cable.id}>
            <Icon size={17} strokeWidth={1.75} aria-hidden="true"/><span>{cable.label}</span>
          </div>;
        })}
      </div>
    </div>
  );
}
