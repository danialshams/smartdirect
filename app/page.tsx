import type { Metadata } from "next";
import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { preconnect, preload } from "react-dom";
import { LandingGlassBackdrop } from "../components/landing/LandingGlassBackdrop";
import { SimpleHeader } from "../components/landing/SimpleHeader";
import { LandingInteractions } from "../components/landing/LandingInteractions";
import { HeroAssembly } from "../components/landing/HeroAssembly";
import { FeatureShowcase } from "../components/landing/FeatureShowcase";
import "./simple-home.css";
import "./showcase.css";
import "./landing-refresh.css";
import "./landing-instagram.css";
import "./landing-polish.css";
import "./landing-refraction-fix.css";
import "./landing-live-glass.css";
import "./landing-optics-v2.css";
import "./header-library-optics.css";
import "./landing-fixes.css";
import "./landing-motion-polish.css";

export const metadata:Metadata = {
  title:"دایرا | همه تعاملات پیجت، در یک فضای ساده",
  description:"یازده ابزار مدیریت تعاملات، دایرکت، پاسخ‌های خودکار و انتشار محتوای اینستاگرام؛ همه در دایرا.",
  openGraph:{
    title:"دایرا | همه تعاملات پیجت، در یک فضای ساده",
    description:"با قابلیت‌های دایرا آشنا شو و مراحل کار هر بخش را ببین.",
    locale:"fa_IR",
    type:"website",
  },
};

/* Pre-hydration scroll reset avoids showing the old navy section before the
   first paint. Back/forward navigation is unaffected; regular reload starts
   at the hero even if the previous URL had a section hash. */
const initialScrollGuard = "(function(){document.documentElement.dataset.dairaHero='pending';try{var ua=navigator.userAgent;var webglScene=/Firefox\\/|FxiOS\\/|iPhone|iPad|iPod/.test(ua)||(/Safari\\//.test(ua)&&!/Chrome\\/|Chromium\\/|Edg\\/|OPR\\//.test(ua));if(webglScene){var root=document.querySelector('.ap-site');if(root)root.dataset.sceneCaptureStable='true';}var n=performance.getEntriesByType('navigation')[0];var reload=n&&n.type==='reload';if(reload&&location.hash){history.replaceState(null,'',location.pathname+location.search);}if(reload||!location.hash){history.scrollRestoration='manual';scrollTo(0,0);addEventListener('pageshow',function(){if(!location.hash)scrollTo(0,0);},{once:true});}}catch(e){}})();";

const heroWords=["مدیریت","کل","پیجت","رو","بسپار","به","دایرا"];

const footerLinks=[
  {label:"امکانات",href:"#features"},
  {label:"حفظ حریم خصوصی",href:"/privacy-policy"},
  {label:"قوانین و مقررات",href:"/terms"},
  {label:"حذف اطلاعات",href:"/data-deletion"},
  {label:"ارتباط با ما",href:"/contact"},
  {label:"درباره ما",href:"/about"},
] as const;

export default function Home() {
  // Start the font CDN connection before WebKit waits for font embedding.
  // No new runtime SDK or homepage paint-blocking request is introduced.
  preconnect("https://cdnjs.cloudflare.com", { crossOrigin: "anonymous" });
  // The headline uses bold Vazir: fetch it before first paint so the RTL
  // GSAP fade does not hitch during a late font swap.
  preload("https://cdnjs.cloudflare.com/ajax/libs/vazir-font/30.1.0/Vazir-Bold.woff2", {
    as: "font", type: "font/woff2", crossOrigin: "anonymous"
  });
  return (
    <LandingGlassBackdrop>
      <script dangerouslySetInnerHTML={{__html:initialScrollGuard}} />
      <SimpleHeader />
      <a className="ap-skip" data-liquid-glass-ignore="" href="#content">رفتن به محتوای صفحه</a>
      <main id="content">
        <section className="ap-hero" aria-labelledby="ap-hero-title">
          <div className="ap-hero__ambient" aria-hidden="true"/>
          <div className="ap-shell ap-hero__content">
            <h1 id="ap-hero-title" dir="rtl" aria-label="مدیریت کل پیجت رو بسپار به دایرا" data-hero-assembly data-liquid-glass-ignore="">
              {heroWords.map((word,index)=>(
                <Fragment key={word}>
                  <span className="ap-hero__word" data-hero-word style={{"--hero-delay":`${index*170}ms`} as CSSProperties}>{word}</span>
                  {index<heroWords.length-1?" ":""}
                </Fragment>
              ))}
            </h1>
            <p className="ap-hero__description" data-hero-description>از پاسخ خودکار و صندوق دایرکت تا انتشار محتوا؛ همه در یک فضای ساده.</p>
            <div className="ap-hero__actions" data-hero-cta>
              <Link className="ap-button ap-button--solid ap-hero__cta" href="/login">
                رایگان شروع کن
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Separate clipped rows must be direct scene children for fast WebGL captures. */}
      <FeatureShowcase />

      <footer className="ap-footer ap-footer--extended">
        <div className="ap-footer__halo" aria-hidden="true"/>
        <div className="ap-shell ap-footer__invitation">
          <h2 className="daira-text-mask" data-text-reveal><span className="daira-text-mask__inner">آماده‌ای مدیریت پیجت ساده‌تر بشه؟</span></h2>
          <p>با دایرا شروع کن و تعاملات پیجت رو یک‌جا مدیریت کن.</p>
          <Link className="ap-button ap-button--solid ap-footer__cta" href="/login">رایگان شروع کن</Link>
        </div>
        <div className="ap-shell ap-footer__hero">
          <div className="ap-footer__brand" data-reveal>
            <Link href="/" className="ap-brand" aria-label="دایرا، صفحه اصلی">
              <Image src="/daira-header-logo-hd.webp" alt="" width={42} height={42}/>
              <span>دایرا</span>
            </Link>
            <p>مدیریت ساده‌تر تعامل‌ها، گفتگوها و محتوای اینستاگرام.</p>
          </div>
          <nav className="ap-footer__links" aria-label="راهنمای سایت">
            {footerLinks.map((item,index)=><Link href={item.href} key={item.href} data-reveal style={{"--link-index":index} as CSSProperties}>{item.label}</Link>)}
          </nav>
        </div>
        <div className="ap-shell ap-footer__trust">
          <p>اطلاعات مربوط به حریم خصوصی، قوانین و حذف اطلاعات در لینک‌های بالا در دسترس است.</p>
        </div>
        <div className="ap-shell ap-footer__bottom">
          <span>© {new Date().getFullYear()} دایرا</span>
          <span>ساخته‌شده برای مدیریت ساده‌تر پیج</span>
        </div>
      </footer>
      <HeroAssembly />
      <LandingInteractions />
    </LandingGlassBackdrop>
  );
}
