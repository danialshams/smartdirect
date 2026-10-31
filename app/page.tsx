import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown, ArrowLeft, ArrowUpLeft, BarChart3,
  CalendarDays, MessageCircle, MessagesSquare,
} from "lucide-react";
import { SimpleHeader } from "../components/landing/SimpleHeader";
import { HeroMotion } from "../components/landing/HeroMotion";
import "./simple-home.css";

export const metadata: Metadata = {
  title: "دایرا | همه‌چیز، ساده‌تر",
  description: "پاسخ خودکار کامنت و دایرکت، مدیریت گفتگوها، انتشار محتوا و تحلیل پیج در یک فضای ساده.",
  openGraph: {
    title: "دایرا | تعاملات پیجت، ساده‌تر از همیشه",
    description: "برای گفتگوهای بهتر، وقت بیشتری داشته باش.",
    locale: "fa_IR",
    type: "website",
  },
};

const capabilities = [
  {
    no: "01",
    Icon: MessageCircle,
    title: "پاسخ‌های خودکار",
    description: "کامنت، استوری، دایرکت، لایو و منشن؛ پاسخ‌ها را تو تعیین می‌کنی.",
  },
  {
    no: "02",
    Icon: MessagesSquare,
    title: "گفتگوهای منظم",
    description: "صندوق دایرکت، یادآوری هوشمند، منوی دایرکت و پیام شروع گفتگو.",
  },
  {
    no: "03",
    Icon: CalendarDays,
    title: "انتشار و تحلیل",
    description: "محتوا را زمان‌بندی کن و عملکرد پیجت را ببین.",
  },
] as const;

export default function Home() {
  return (
    <div className="ap-site" dir="rtl" id="top">
      <SimpleHeader />
      <a className="ap-skip" href="#content">رفتن به محتوای صفحه</a>
      <HeroMotion />

      <main id="content">
        <section className="ap-hero" aria-labelledby="ap-hero-title">
          <div className="ap-hero__ambient" aria-hidden="true" />
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
              <a className="ap-text-link" href="#experience">
                بیشتر ببین <ArrowDown size={17} aria-hidden="true"/>
              </a>
            </div>
          </div>
          <div className="ap-hero__footer" aria-hidden="true">
            <span>DAIRA</span>
            <span className="ap-hero__footline"/>
            <span>سادگی، در هر تعامل</span>
          </div>
        </section>

        <section className="ap-story" id="experience" aria-labelledby="ap-story-title">
          <div className="ap-story__visual" aria-hidden="true">
            <span className="ap-story__glow" />
            <span className="ap-story__ring ap-story__ring--outer" />
            <span className="ap-story__ring ap-story__ring--middle" />
            <span className="ap-story__ring ap-story__ring--inner" />
            <span className="ap-story__core" />
          </div>
          <div className="ap-story__sticky">
            <div className="ap-shell ap-story__copy">
              <span className="ap-label ap-label--light" data-story-reveal>پاسخ خودکار</span>
              <h2 id="ap-story-title">
                <span className="ap-story__headline" data-story-reveal>پیام‌ها می‌رسند.</span>
                <span className="ap-story__headline ap-story__headline--soft" data-story-reveal>پاسخ‌ها آماده‌اند.</span>
              </h2>
              <p data-story-reveal>یک‌بار تنظیم کن. بقیه را با خیال راحت دنبال کن.</p>
            </div>
          </div>
        </section>

        <section className="ap-capabilities" id="features" aria-labelledby="ap-features-title">
          <div className="ap-shell">
            <div className="ap-capabilities__heading">
              <span className="ap-label" data-reveal>تمام ابزارهای مهم، یکجا</span>
              <h2 id="ap-features-title" data-reveal>کنترل بیشتر.<br/><span>پیچیدگی کمتر.</span></h2>
            </div>
            <div className="ap-capabilities__list">
              {capabilities.map(item=>(
                <article className="ap-capability" key={item.no} data-reveal>
                  <span className="ap-capability__number" aria-hidden="true">{item.no}</span>
                  <span className="ap-capability__icon"><item.Icon size={25} strokeWidth={1.55} aria-hidden="true"/></span>
                  <div className="ap-capability__copy">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <ArrowLeft className="ap-capability__arrow" size={19} aria-hidden="true"/>
                </article>
              ))}
            </div>
            <div className="ap-capabilities__foot" data-reveal>
              <span>همه‌چیز مطابق تنظیمات تو و مجوزهای Meta انجام می‌شود.</span>
              <BarChart3 size={16} aria-hidden="true"/>
            </div>
          </div>
        </section>

        <section className="ap-close" id="start" aria-labelledby="ap-close-title">
          <div className="ap-shell ap-close__content">
            <span className="ap-label" data-reveal>همین‌قدر ساده</span>
            <h2 id="ap-close-title" data-reveal>آماده‌ای شروع کنی؟</h2>
            <p data-reveal>پیجت را متصل کن و اولین پاسخ خودکار را بساز.</p>
            <Link href="/login" className="ap-button ap-button--solid" data-reveal>
              ورود به دایرا <ArrowUpLeft size={18} aria-hidden="true"/>
            </Link>
          </div>
        </section>
      </main>

      <footer className="ap-footer">
        <div className="ap-shell ap-footer__main">
          <Link href="/" className="ap-brand" aria-label="دایرا، صفحه اصلی">
            <Image src="/daira-header-logo-hd.webp" alt="" width={40} height={40} />
            <span>دایرا</span>
          </Link>
          <nav aria-label="لینک‌های پایانی">
            <a href="#features">امکانات</a>
            <Link href="/login">ورود</Link>
            <Link href="/privacy-policy">حریم خصوصی</Link>
            <Link href="/data-deletion">حذف اطلاعات</Link>
          </nav>
        </div>
        <div className="ap-shell ap-footer__bottom">
          <span>© {new Date().getFullYear()} دایرا</span>
          <a href="#top">بازگشت به بالا <ArrowUpLeft size={14} aria-hidden="true"/></a>
        </div>
      </footer>
    </div>
  );
}
