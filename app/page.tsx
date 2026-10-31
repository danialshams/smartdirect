import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft, BadgeCheck, Check, ShieldCheck } from "lucide-react";
import { LandingGlassBackdrop } from "../components/landing/LandingGlassBackdrop";
import { SimpleHeader } from "../components/landing/SimpleHeader";
import { HeroMotion } from "../components/landing/HeroMotion";
import { FeatureShowcase } from "../components/landing/FeatureShowcase";
import "./simple-home.css";
import "./showcase.css";

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
const initialScrollGuard = "(function(){try{var n=performance.getEntriesByType('navigation')[0];var reload=n&&n.type==='reload';if(reload&&location.hash){history.replaceState(null,'',location.pathname+location.search);}if(reload||!location.hash){history.scrollRestoration='manual';scrollTo(0,0);addEventListener('pageshow',function(){if(!location.hash)scrollTo(0,0);},{once:true});}}catch(e){}})();";

const footerLinks=[
  {label:"امکانات",href:"#features"},
  {label:"حفظ حریم خصوصی",href:"/privacy-policy"},
  {label:"قوانین و مقررات",href:"/terms"},
  {label:"حذف اطلاعات",href:"/data-deletion"},
  {label:"ارتباط با ما",href:"/contact"},
  {label:"درباره ما",href:"/about"},
] as const;

export default function Home() {
  return (
    <LandingGlassBackdrop>
      <script dangerouslySetInnerHTML={{__html:initialScrollGuard}} />
      <SimpleHeader />
      <a className="ap-skip" href="#content">رفتن به محتوای صفحه</a>
      <HeroMotion />
      <main id="content">
        <section className="ap-hero" aria-labelledby="ap-hero-title">
          <div className="ap-hero__ambient" aria-hidden="true"/>
          <div className="ap-shell ap-hero__content">
            <div className="ap-hero__topline" data-hero-entrance>دایرا، یک راه ساده‌تر.</div>
            <h1 id="ap-hero-title">
              <span className="ap-hero__line" data-hero-entrance>کمتر درگیر شو.</span>
              <span className="ap-hero__line ap-hero__line--accent" data-hero-entrance>بیشتر ارتباط بگیر.</span>
            </h1>
            <p className="ap-hero__subtitle" data-hero-entrance>
              کامنت‌ها، دایرکت‌ها و محتوای پیجت. همه در یک جای ساده.
            </p>
            <div className="ap-hero__actions" data-hero-entrance>
              <Link className="ap-button ap-button--solid" href="/login">
                شروع با دایرا <ArrowUpLeft size={18} aria-hidden="true"/>
              </Link>
            </div>
          </div>
          <div className="ap-hero__footer" aria-hidden="true">
            <span>DAIRA</span><span className="ap-hero__footline"/><span>سادگی، در هر تعامل</span>
          </div>
        </section>

        <FeatureShowcase />
      </main>

      <footer className="ap-footer ap-footer--extended">
        <div className="ap-shell ap-footer__hero">
          <div className="ap-footer__brand">
            <Link href="/" className="ap-brand" aria-label="دایرا، صفحه اصلی">
              <Image src="/daira-header-logo-hd.webp" alt="" width={42} height={42}/>
              <span>دایرا</span>
            </Link>
            <p>تعاملات بیشتر. پیچیدگی کمتر.</p>
            <Link className="ap-footer__login" href="/login">
              ورود به پنل <ArrowUpLeft size={17} aria-hidden="true"/>
            </Link>
          </div>
          <nav className="ap-footer__links" aria-label="راهنمای سایت">
            {footerLinks.map(item=><Link href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
        </div>
        <div className="ap-shell ap-footer__trust">
          <div>
            <span className="ap-footer__trust-title"><ShieldCheck size={17} aria-hidden="true"/> بخش مجوزها و اعتبارسنجی</span>
            <p>پس از دریافت مجوز، نشان معتبر و لینک استعلام در این قسمت قرار می‌گیرد.</p>
          </div>
          <div className="ap-footer__badge-list" aria-label="جایگاه مجوزهای آینده">
            <div className="ap-footer__badge-placeholder"><BadgeCheck size={23} aria-hidden="true"/><span>Meta</span><small>در آینده</small></div>
            <div className="ap-footer__badge-placeholder"><Check size={23} aria-hidden="true"/><span>اینماد</span><small>در آینده</small></div>
          </div>
        </div>
        <div className="ap-shell ap-footer__bottom">
          <span>© {new Date().getFullYear()} دایرا</span>
          <a href="#top">بازگشت به بالا <ArrowUpLeft size={14} aria-hidden="true"/></a>
        </div>
      </footer>
    </LandingGlassBackdrop>
  );
}
