"use client";

import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { gsap } from "gsap";
import {
  AtSign, BarChart3, BellRing, CalendarDays, CheckCheck, Headphones,
  Menu, MessageCircle, MessagesSquare, Radio, Send, Sparkles, WandSparkles,
} from "lucide-react";

/** Positions are fixed for hydration; their assembly vectors and light timings are random at runtime. */
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
 * Vector mechanical model: metallic back shell, ceramic segmented armor,
 * independent temples and connectors, multi-layer visor and luminous optics.
 * No external 3D files, network calls, or canvas loops needed for first paint.
 */
function RobotHead() {
  return (
    <g data-robot-assembly="head">
      <g className="sh-robot-head">
      <ellipse cx="611" cy="568" rx="150" ry="35" fill="#4787df" opacity=".11"/>
      <g className="sh-robot-neck" data-robot-detail>
        <path d="M552 501 L553 563 Q600 590 664 559 L670 501" fill="url(#robotNeck)" stroke="#7188af" strokeWidth="3"/>
        <path d="M550 545 Q606 571 674 544 L688 566 Q602 608 534 565Z" fill="url(#robotSteel)" stroke="#dcecff" strokeWidth="4"/>
        {Array.from({length:7},(_,i)=><path key={i} d={"M"+(557+i*16)+" 547 l-2 18"} stroke="#59759b" strokeWidth="5" opacity=".75"/>)}
        <rect x="572" y="563" width="76" height="13" rx="6.5" fill="#2f5c99"/>
        <path d="M586 564 H636" stroke="#63d3ff" strokeWidth="2" opacity=".9"/>
      </g>
      <g className="sh-robot-antenna" data-robot-detail>
        <path d="M605 194 V165" stroke="#5c789e" strokeWidth="13" strokeLinecap="round"/>
        <path d="M605 184 V165" stroke="#d9e8fe" strokeWidth="6" strokeLinecap="round"/>
        <circle cx="605" cy="155" r="14" fill="url(#robotSteel)" stroke="#8baee7" strokeWidth="3"/>
        <circle cx="605" cy="155" r="5" fill="#65cafa" className="sh-robot-core-led"/>
      </g>
      <g className="sh-robot-backplate" data-robot-detail>
        <path d="M498 219 Q515 170 604 168 Q700 166 720 219 L749 287 L756 429 Q737 519 684 539 Q605 566 529 538 Q480 513 466 430 L467 301Z" fill="url(#robotSteel)" stroke="#7095c9" strokeWidth="5"/>
        <path d="M496 247 Q488 198 555 187 Q643 161 702 203 L731 263" fill="none" stroke="#f6fbff" strokeWidth="7" opacity=".8"/>
        <path d="M477 361 L470 409 Q477 492 525 526" fill="none" stroke="#405f91" strokeWidth="10" opacity=".34"/>
        <path d="M733 366 L735 410 Q729 482 685 523" fill="none" stroke="#e0efff" strokeWidth="7" opacity=".7"/>
      </g>
      <g className="sh-robot-ears" data-robot-detail>
        <path d="M490 305 Q461 298 443 319 V410 Q443 439 478 447 L488 424Z" fill="url(#robotSteel)" stroke="#7392c2" strokeWidth="4"/>
        <path d="M725 305 Q751 299 771 321 V414 Q763 438 732 449 L721 420Z" fill="url(#robotSteel)" stroke="#7392c2" strokeWidth="4"/>
        <path d="M462 337 V410" stroke="#2e548e" strokeWidth="9" strokeLinecap="round"/>
        <path d="M753 342 V408" stroke="#2e548e" strokeWidth="9" strokeLinecap="round"/>
        <path d="M461 355 V392 M752 352 V395" stroke="#8ddaff" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="465" cy="326" r="5" fill="#bddbff"/><circle cx="751" cy="327" r="5" fill="#bddbff"/>
      </g>
      <g className="sh-robot-face-armor" data-robot-detail>
        <path d="M518 207 Q605 169 695 206 Q725 215 729 280 L741 411 Q739 492 676 529 Q610 560 539 526 Q474 492 475 408 L480 283 Q480 221 518 207Z" fill="url(#robotCeramic)" stroke="#e9f4ff" strokeWidth="6"/>
        <path d="M515 221 Q603 188 698 225" fill="none" stroke="#fff" strokeWidth="8" opacity=".83"/>
        <path d="M484 289 L493 411 Q499 474 539 501" fill="none" stroke="#a9bedb" strokeWidth="3" opacity=".8"/>
        <path d="M728 292 L719 409 Q709 471 671 500" fill="none" stroke="#fff" strokeWidth="5" opacity=".88"/>
        <path d="M494 431 L518 473 L541 479 L536 501 L518 490 Q497 468 494 431Z" fill="#9bb6d8" opacity=".65"/>
        <path d="M717 431 L694 473 L673 479 L678 500 L700 486 Q716 459 717 431Z" fill="#91accc" opacity=".62"/>
        <path d="M543 508 Q611 533 667 505 L655 527 Q610 548 558 528Z" fill="url(#robotSteel)" stroke="#c7d7ea" strokeWidth="2"/>
        <path d="M558 516 Q612 531 655 516" stroke="#73a1d2" strokeWidth="3" fill="none"/>
      </g>
      <g className="sh-robot-visor" data-robot-assembly="visor">
        <path d="M517 267 Q608 238 697 267 Q719 276 715 318 L706 405 Q700 441 665 448 Q609 457 549 448 Q515 440 509 404 L499 321 Q497 283 517 267Z" fill="url(#robotVisor)" stroke="#7197cd" strokeWidth="5"/>
        <path d="M520 281 Q605 259 696 283" stroke="#c8f6ff" strokeWidth="2.5" fill="none" opacity=".75"/>
        <path d="M513 314 Q558 283 600 292" stroke="#a9d4ff" strokeWidth="7" opacity=".17" fill="none" strokeLinecap="round"/>
        <path d="M662 292 Q685 295 704 310" stroke="#a9d4ff" strokeWidth="4" opacity=".17" fill="none"/>
        <path d="M516 385 Q606 414 706 385" stroke="#2d5e9d" strokeWidth="2" opacity=".4" fill="none"/>
        <g className="sh-robot-eyes">
          <path className="sh-robot-eye-light" d="M538 350 Q559 331 589 349 Q560 368 538 350Z" fill="url(#robotEye)" stroke="#a7eaff" strokeWidth="2"/>
          <path className="sh-robot-eye-light" d="M624 349 Q654 331 676 349 Q654 368 624 349Z" fill="url(#robotEye)" stroke="#a7eaff" strokeWidth="2"/>
          <path d="M544 351 Q561 343 581 350 M632 350 Q653 343 670 349" stroke="#e7ffff" strokeWidth="3.5" opacity=".9" fill="none"/>
        </g>
        <g className="sh-robot-mouth" opacity=".85">
          <rect x="566" y="402" width="82" height="15" rx="7" fill="#1e4170" stroke="#4074ad" strokeWidth="1"/>
          {Array.from({length:9},(_,i)=><rect key={i} x={575+i*8} y="406" width="4" height="6" rx="2" fill={i===4?"#7ce9ff":"#3d92d2"} opacity={i===4?1:.6}/>)}
        </g>
        <path d="M514 321 L510 374" stroke="#fff" strokeWidth="3" opacity=".32"/>
      </g>
      <g className="sh-robot-forehead" data-robot-detail>
        <path d="M550 223 Q609 209 663 222 L648 256 Q602 267 563 254Z" fill="url(#robotSteel)" stroke="#b6d0ed" strokeWidth="2.5"/>
        <path d="M581 232 L604 225 L630 234 L626 246 L602 252 L583 244Z" fill="#183e73" stroke="#89c9ee" strokeWidth="2"/>
        <path d="M593 239 H617" stroke="#72edff" strokeWidth="4" strokeLinecap="round" className="sh-robot-core-led"/>
      </g>
      {[[499,254],[709,253],[498,464],[710,464]].map(([cx,cy],i)=>(
        <g key={i} className="sh-robot-fastener" data-robot-detail>
          <circle cx={cx} cy={cy} r="7" fill="#6f8ba9" stroke="#f3faff" strokeWidth="2"/>
          <path d={"M"+(cx-3)+" "+cy+" h6"} stroke="#eaf7ff" strokeWidth="2" strokeLinecap="round"/>
        </g>
      ))}
      <g className="sh-robot-cheeks" data-robot-detail>
        <path d="M492 352 l-8 44 M723 351 l8 44" stroke="#527caf" strokeWidth="5" strokeLinecap="round" opacity=".65"/>
        <path d="M497 350 v26 M718 349 v26" stroke="#bbecff" strokeWidth="2" opacity=".75"/>
        <circle cx="489" cy="413" r="3" fill="#63d9fb"/><circle cx="728" cy="413" r="3" fill="#63d9fb"/>
      </g>
      <g className="sh-robot-ports" data-robot-detail>
        {[[508,261,-35],[471,328,-55],[473,405,-65],[514,489,-35],[566,527,-20],[611,210,0],[715,257,35],[749,339,55],[743,425,65],[691,511,35],[639,530,20]].map(([x,y,rotate],i)=>(
          <g key={i} transform={"translate("+x+" "+y+") rotate("+rotate+")"}>
            <rect x="-12" y="-7" width="24" height="14" rx="5" fill="#547eae" stroke="#e9f4ff" strokeWidth="2"/>
            <rect x="-7" y="-3" width="14" height="6" rx="3" fill="#173e76"/>
            <path d="M-4 0 H4" stroke="#69d9ff" strokeWidth="1.6"/>
          </g>
        ))}
      </g>
      </g>
    </g>
  );
}

export function RobotHeroScene() {
  const stageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = true;
    let pending: gsap.core.Tween | undefined;
    let travelling: gsap.core.Tween | undefined;
    const ctx = gsap.context(() => {
      const groups = Array.from(stage.querySelectorAll<SVGElement | HTMLElement>("[data-robot-assembly]"));
      // Staggered scattered pieces converge into their exact final assembled geometry.
      gsap.from(groups, {
        x: () => gsap.utils.random(-155, 155),
        y: () => gsap.utils.random(-105, 110),
        rotation: () => gsap.utils.random(-22, 22),
        scale: () => gsap.utils.random(0.68, 1.25),
        opacity: 0,
        duration: 1.65,
        stagger: { each: 0.045, from: "random" },
        ease: "expo.out",
        delay: 0.14,
      });
      gsap.from(stage.querySelectorAll("[data-robot-detail]"), {
        opacity: 0, scale: .88, duration: .85,
        stagger: { each: .04, from: "random" }, ease: "power3.out", delay: .65,
      });

      const eyes = stage.querySelectorAll(".sh-robot-eye-light, .sh-robot-iris-glow");
      // Several short flickers, then fully lit; endlessly repeating.
      gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 1.7 })
        .set(eyes, { opacity: .07 })
        .to(eyes, { opacity: .75, duration: .07 })
        .to(eyes, { opacity: .08, duration: .08 })
        .to(eyes, { opacity: .96, duration: .11 })
        .to(eyes, { opacity: .18, duration: .09 })
        .to(eyes, { opacity: 1, duration: .2, ease: "power2.out" })
        .to(eyes, { opacity: 1, duration: 1.55 });

      const lines = Array.from(stage.querySelectorAll<SVGPathElement>("[data-cable-path]"));
      const pulses = Array.from(stage.querySelectorAll<SVGGElement>("[data-cable-pulse]"));
      let previous = -1;
      function pulseOne() {
        if (!active || !stage?.isConnected) return;
        if (document.visibilityState === "hidden") {
          pending = gsap.delayedCall(1.5, pulseOne);
          return;
        }
        let index = Math.floor(Math.random() * lines.length);
        if (index === previous) index = (index + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length;
        previous = index;
        const path = lines[index], pulse = pulses[index];
        const length = path.getTotalLength();
        const travel = { distance: 0 };
        gsap.set(pulse, { opacity: 1 });
        travelling = gsap.to(travel, {
          distance: length, duration: gsap.utils.random(1.1, 1.75), ease: "none",
          onUpdate: () => {
            const point = path.getPointAtLength(travel.distance);
            pulse.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
          },
          onComplete: () => gsap.set(pulse, { opacity: 0 }),
        });
        // Independent non-synchronized light flows, approximately every five seconds.
        pending = gsap.delayedCall(gsap.utils.random(3.8, 6.2), pulseOne);
      }
      pending = gsap.delayedCall(2.8, pulseOne);
    }, stage);
    return () => {
      active = false;
      pending?.kill();
      travelling?.kill();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={stageRef} className="sh-robot-scene" aria-label="ربات سه‌بعدی دایرا با یازده قابلیت متصل به سیم‌های شناور و جریان نوری مستقل">
      <div className="sh-robot-world">
        <svg className="sh-robot-svg" viewBox="0 0 1200 710" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="robotCeramic" x1="0" y1="0" x2=".9" y2="1">
              <stop offset="0%" stopColor="#fff"/><stop offset="25%" stopColor="#f8fcff"/><stop offset="54%" stopColor="#d2e3f6"/><stop offset="83%" stopColor="#ecf7ff"/><stop offset="100%" stopColor="#87a8d1"/>
            </linearGradient>
            <linearGradient id="robotSteel" x1=".1" y1="0" x2=".95" y2="1">
              <stop stopColor="#526b91"/><stop offset=".22" stopColor="#d3e5f9"/><stop offset=".48" stopColor="#7b99be"/><stop offset=".74" stopColor="#ecf7ff"/><stop offset="1" stopColor="#58779d"/>
            </linearGradient>
            <linearGradient id="robotNeck" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#385476"/><stop offset=".5" stopColor="#9fb9d7"/><stop offset="1" stopColor="#264769"/></linearGradient>
            <linearGradient id="robotVisor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#071b37"/><stop offset=".42" stopColor="#143b6f"/><stop offset=".7" stopColor="#071a38"/><stop offset="1" stopColor="#24558b"/></linearGradient>
            <linearGradient id="robotEye" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#168dff"/><stop offset=".45" stopColor="#daffff"/><stop offset="1" stopColor="#3fb9ff"/></linearGradient>
            <linearGradient id="robotCable" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#668db9"/><stop offset=".5" stopColor="#a9c3de"/><stop offset="1" stopColor="#4478b5"/></linearGradient>
            <radialGradient id="robotHalo"><stop stopColor="#8cc9ff" stopOpacity=".30"/><stop offset=".7" stopColor="#a4c1ff" stopOpacity=".08"/><stop offset="1" stopColor="#a3cfff" stopOpacity="0"/></radialGradient>
            <filter id="robotEyeGlow" x="-80%" y="-200%" width="260%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
            <filter id="robotLightGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4"/></filter>
            <filter id="robotDepth" x="-40%" y="-30%" width="180%" height="175%"><feDropShadow dx="0" dy="19" stdDeviation="18" floodColor="#315991" floodOpacity=".25"/></filter>
          </defs>
          <circle cx="608" cy="359" r="290" fill="url(#robotHalo)"/>
          <g className="sh-robot-cables">
            {cables.map((cable)=>(
              <g key={cable.id} data-robot-assembly="cable" className="sh-robot-cable-assembly">
                <g className="sh-robot-cable-sway" style={{ transformOrigin: cable.sx+"px "+cable.sy+"px", animationDuration: cable.duration+"s", animationDelay: cable.phase+"s" } as CSSProperties}>
                  <path d={cable.path} stroke="#3d658f" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".12"/>
                  <path d={cable.path} stroke="url(#robotCable)" strokeWidth="5.2" strokeLinecap="round" fill="none"/>
                  <path d={cable.path} stroke="#eaf7ff" strokeWidth="1.35" strokeLinecap="round" fill="none" opacity=".9"/>
                </g>
                <path data-cable-path d={cable.path} stroke="transparent" strokeWidth=".1" fill="none"/>
                <g data-cable-pulse opacity="0" pointerEvents="none">
                  <circle r="12" fill="#73cbff" opacity=".7" filter="url(#robotLightGlow)"/>
                  <circle r="5.5" fill="#5ce4ff" stroke="#fff" strokeWidth="1.5"/>
                </g>
                <circle cx={cable.x} cy={cable.y} r="6" fill="#80cfff" stroke="#fff" strokeWidth="2"/>
              </g>
            ))}
          </g>
          <g filter="url(#robotDepth)"><RobotHead /></g>
          <g className="sh-robot-iris-glow" opacity=".65" filter="url(#robotEyeGlow)" pointerEvents="none">
            <path d="M539 349 Q559 332 589 349 Q560 367 539 349Z" fill="#59ceff"/>
            <path d="M625 349 Q653 332 677 349 Q654 367 625 349Z" fill="#59ceff"/>
          </g>
          <g aria-hidden="true">
            <circle cx="603" cy="338" r="257" stroke="#78a9ed" strokeWidth="1" strokeDasharray="3 14" opacity=".16" fill="none"/>
            <circle cx="603" cy="338" r="215" stroke="#9bd4ff" strokeWidth="1" strokeDasharray="5 18" opacity=".19" fill="none"/>
          </g>
        </svg>
        {cables.map((cable,i)=>{
          const Icon = cable.Icon;
          return (
            <div key={cable.id} data-robot-assembly="node"
              className={"sh-robot-node-anchor sh-robot-node-anchor--"+cable.id}
              style={{left:(cable.x / 1200 * 100)+"%",top:(cable.y / 710 * 100)+"%"}}>
              <div className="sh-robot-node" style={{animationDuration:(cable.duration + 1)+"s",animationDelay:cable.phase+"s"}}>
                <span className="sh-robot-node__icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true"/></span>
                <span className="sh-robot-node__label">{cable.label}</span>
              </div>
            </div>
          );
        })}
        <span className="sh-robot-scene__caption" aria-hidden="true"><Headphones size={13}/> DAIRA · CONNECTED INTELLIGENCE <CheckCheck size={13}/></span>
      </div>
    </div>
  );
}
