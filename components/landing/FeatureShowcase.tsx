"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextPlugin } from "gsap/TextPlugin";
import {
  Check, CheckCheck, Clock3, Ellipsis, Image as ImageIcon,
  MessageCircle, Radio,
} from "lucide-react";
import { showcaseScenes, type ShowcaseScene } from "./showcase-scenes";

gsap.registerPlugin(ScrollTrigger, TextPlugin);

/** Every element here is live HTML/SVG, not a video, gif or screenshot. */
function PreviewContext({ scene }: {scene:ShowcaseScene}) {
  switch(scene.id) {
    case "comment":
      return <div className="ap-demo__inbox-strip ap-demo__part">
        <span className="ap-demo__avatar">م</span><div><small>کامنت جدید روی پست</small><strong>سلام، قیمت این محصول چنده؟</strong></div>
        <MessageCircle size={19} aria-hidden="true"/>
      </div>;
    case "story":
      return <div className="ap-demo__story-card ap-demo__part">
        <div className="ap-demo__story-line"/><div className="ap-demo__story-surface"><span>STORY</span><i/></div>
        <div className="ap-demo__story-bottom">پاسخ به همه استوری‌ها</div>
      </div>;
    case "direct":
      return <div className="ap-demo__messages ap-demo__part">
        <div className="ap-demo__bubble ap-demo__bubble--user">سلام، آدرس شما کجاست؟</div>
        <div className="ap-demo__bubble ap-demo__bubble--reply">سلام! خوش اومدی 💙</div>
      </div>;
    case "share":
      return <div className="ap-demo__shared ap-demo__part">
        <div className="ap-demo__shared-art"><ImageIcon size={31} strokeWidth={1.4}/></div>
        <div><small>محتوای انتخاب‌شده</small><strong>پست و ریلز</strong><span>اشتراک‌گذاری و منشن</span></div>
      </div>;
    case "live":
      return <div className="ap-demo__live ap-demo__part">
        <div className="ap-demo__live-head"><Radio size={15}/> پخش زنده <span>LIVE</span></div>
        <div className="ap-demo__live-box"><span className="ap-demo__live-circle"/><span>کاربر: لینک محصول رو می‌فرستید؟</span></div>
      </div>;
    case "reminder":
      return <div className="ap-demo__reminder ap-demo__part">
        <Clock3 size={30} strokeWidth={1.3}/><div><small>زمان پیگیری</small><strong>بعد از ارسال پیام</strong></div>
        <div className="ap-demo__clock-ring"/>
      </div>;
    case "inbox":
      return <div className="ap-demo__thread ap-demo__part">
        <div className="ap-demo__thread-header"><span className="ap-demo__avatar">س</span><strong>گفتگوی جدید</strong><span>● آنلاین</span></div>
        <div className="ap-demo__bubble ap-demo__bubble--user">سلام! برای خرید راهنمایی می‌خوام.</div>
        <div className="ap-demo__bubble ap-demo__bubble--reply">سلام، خوش اومدی 💙 <CheckCheck size={13}/></div>
      </div>;
    case "publishing":
      return <div className="ap-demo__publish ap-demo__part">
        <div className="ap-demo__publish-art"><ImageIcon size={32} strokeWidth={1.3}/></div>
        <div><small>محتوای آماده انتشار</small><strong>پست جدید</strong><span>زمان‌بندی محتوا</span></div>
        <div className="ap-demo__publish-schedule"><Clock3 size={16}/> زمان‌بندی</div>
      </div>;
    case "insights":
      return <div className="ap-demo__analytics ap-demo__part">
        <div className="ap-demo__analytics-head"><div><small>تعاملات</small><strong>روند عملکرد</strong></div><span>۳۰ روز گذشته</span></div>
        <svg className="ap-demo__analytics-chart" viewBox="0 0 480 158" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 145 H480 M0 95 H480 M0 45 H480" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".18"/>
          <path className="ap-demo__chart-area" d="M0 135 L56 126 L105 141 L160 98 L205 106 L252 70 L296 88 L340 43 L391 57 L430 19 L480 30 L480 158 L0 158 Z" fill="currentColor" opacity=".10"/>
          <path className="ap-demo__chart-line" d="M0 135 L56 126 L105 141 L160 98 L205 106 L252 70 L296 88 L340 43 L391 57 L430 19 L480 30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>;
    case "menu":
      return <div className="ap-demo__menu-scene ap-demo__part">
        <div className="ap-demo__mini-head">گفتگو با دایرا <Ellipsis size={17}/></div>
        <div className="ap-demo__mini-options">
          <span>مشاهده محصولات</span><span>پیگیری سفارش</span><span>ارتباط با پشتیبانی</span>
        </div>
      </div>;
    case "icebreaker":
      return <div className="ap-demo__icebreaker ap-demo__part">
        <div className="ap-demo__bubble ap-demo__bubble--reply">سلام! چطور می‌تونم کمکت کنم؟</div>
        <div className="ap-demo__ice-options"><span>راهنمای خرید</span><span>سؤالات متداول</span><span>پشتیبانی</span></div>
      </div>;
  }
}

function FeatureScene({ scene }: {scene:ShowcaseScene}) {
  const rootRef=useRef<HTMLElement>(null);

  useEffect(()=>{
    const root=rootRef.current;
    if(!root)return;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(media.matches) return;

    let running=false;
    const ctx=gsap.context(()=>{
      const pieces=gsap.utils.toArray<HTMLElement>("[data-assemble]");
      const input=root.querySelector<HTMLElement>("[data-type-target]");
      const action=root.querySelector<HTMLElement>("[data-demo-action]");
      const result=root.querySelector<HTMLElement>("[data-demo-result]");
      const cursor=root.querySelector<HTMLElement>("[data-demo-cursor]");
      const progress=root.querySelector<HTMLElement>("[data-demo-progress]");
      if(!input||!action||!result||!cursor||!progress)return;

      // The opening stage is a physical UI assembly from scattered positions.
      const timeline=gsap.timeline({
        paused:true,repeat:-1,repeatDelay:1.25,
        defaults:{ease:"power3.out"},
      });
      timeline
        .set(input,{text:""},0)
        .set(result,{autoAlpha:0,y:15},0)
        .set(progress,{scaleX:0,transformOrigin:"right center"},0)
        .fromTo(pieces,{autoAlpha:0,scale:.87,x:(i)=>i%2===0?52:-48,y:(i)=>i%3===0?48:-26,rotate:(i)=>i%2?3:-3},
          {autoAlpha:1,scale:1,x:0,y:0,rotate:0,duration:.8,stagger:.105},0)
        .fromTo(cursor,{autoAlpha:0,x:75,y:-30},{autoAlpha:1,x:0,y:0,duration:.55,ease:"power2.out"},1.02)
        .to(input,{text:{value:scene.keyword},duration:Math.min(2.0,Math.max(.75,scene.keyword.length*.06)),ease:"none"},1.2)
        .to(cursor,{x:-15,y:21,duration:.48,ease:"power2.inOut"},2.88)
        .to(action,{scale:.955,duration:.1,yoyo:true,repeat:1,ease:"power1.inOut"},3.31)
        .to(result,{autoAlpha:1,y:0,duration:.46},3.56)
        .to(cursor,{autoAlpha:0,duration:.22},3.75)
        .to(progress,{scaleX:1,duration:5.4,ease:"none"},0)
        .to({}, {duration:1.18},4.30)
        .to(pieces,{autoAlpha:0,x:(i)=>i%2===0?-42:45,y:20,scale:.94,duration:.54,stagger:.045},5.35)
        .to(result,{autoAlpha:0,duration:.32},5.45);

      const enter=()=>{
        if(document.hidden||running)return;
        running=true;
        root.classList.add("is-playing");
        timeline.restart();
      };
      const leave=()=>{
        running=false;
        root.classList.remove("is-playing");
        timeline.pause(0);
      };
      const trigger=ScrollTrigger.create({
        trigger:root,
        start:"top 72%",
        end:"bottom 28%",
        onEnter:enter,
        onEnterBack:enter,
        onLeave:leave,
        onLeaveBack:leave,
      });
      const onVis=()=>{if(document.hidden)timeline.pause();else if(running)timeline.resume();};
      document.addEventListener("visibilitychange",onVis);
      return ()=>{
        root.classList.remove("is-playing");
        document.removeEventListener("visibilitychange",onVis);
        trigger.kill();
        timeline.kill();
      };
    },root);
    return ()=>ctx.revert();
  },[scene]);

  return (
    <section
      ref={rootRef}
      id={"feature-"+scene.id}
      className={"ap-showcase-scene ap-showcase-scene--"+scene.theme}
      aria-labelledby={"feature-title-"+scene.id}
      data-demo-id={scene.id}
    >
      <div className="ap-showcase-scene__ambient" aria-hidden="true"><span/><span/><span/></div>
      <div className="ap-shell ap-showcase-scene__inner">
        <div className="ap-showcase-scene__heading" data-assemble>
          <span className="ap-showcase-scene__eyebrow">{scene.no} / {scene.eyebrow}</span>
          <h2 id={"feature-title-"+scene.id}>{scene.title}</h2>
          <p>{scene.tagline}</p>
        </div>
        <div className="ap-showcase-scene__stage" aria-label={"نمایش خودکار مراحل "+scene.title}>
          <div className="ap-demo">
            <div className="ap-demo__top" data-assemble>
              <div className="ap-demo__identity">
                <span className="ap-demo__icon"><scene.Icon size={18} strokeWidth={1.8}/></span>
                <strong>{scene.title}</strong>
              </div>
              <div className="ap-demo__top-tag"><span/> پیش‌نمایش عملکرد</div>
            </div>
            <div className="ap-demo__content">
              <div className="ap-demo__context" data-assemble>
                <PreviewContext scene={scene}/>
              </div>
              <div className="ap-demo__editor" data-assemble>
                <div className="ap-demo__field-label">{scene.inputLabel}</div>
                <div className="ap-demo__field">
                  <span className="ap-demo__typed" data-type-target>{scene.keyword}</span>
                  <span className="ap-demo__caret" aria-hidden="true"/>
                </div>
                {scene.id!=="insights" && <div className="ap-demo__reply"><span>پاسخ / نتیجه</span><p>{scene.response}</p></div>}
                <button className="ap-demo__action" data-demo-action type="button" tabIndex={-1} aria-hidden="true">
                  {scene.id==="insights"?"نمایش آمار":"ثبت تنظیمات"} <Check size={15} aria-hidden="true"/>
                </button>
                <div className="ap-demo__cursor" data-demo-cursor aria-hidden="true">
                  <svg width="20" height="22" viewBox="0 0 20 22" fill="none"><path d="M2 2L17 12H9.4L6.8 19L2 2Z" fill="#2563eb" stroke="white" strokeWidth="1.5"/></svg>
                </div>
              </div>
            </div>
            <div className="ap-demo__result" data-demo-result aria-hidden="true"><Check size={15}/>{scene.outcome}</div>
            <div className="ap-demo__progress-track" aria-hidden="true"><span data-demo-progress/></div>
          </div>
        </div>
        <p className="ap-showcase-scene__disclaimer">نمایش نمونه از مراحل کار؛ بدون اجرای عملیات واقعی.</p>
      </div>
    </section>
  );
}

export function FeatureShowcase() {
  return (
    <div id="features" className="ap-showcase" aria-label="معرفی تصویری و خودکار یازده قابلیت دایرا">
      {showcaseScenes.map(scene=><FeatureScene key={scene.id} scene={scene}/>)}
    </div>
  );
}
