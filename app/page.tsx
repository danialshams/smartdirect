import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpLeft, BarChart3, BellRing, CalendarDays,
  Check, ChevronDown, CircleHelp, Command, Headphones,
  MessageCircle, MessagesSquare, MousePointer2, Radio,
  Send, ShieldCheck, Sparkles, WandSparkles,
} from "lucide-react";
import { SimpleHeader } from "../components/landing/SimpleHeader";
import { HeroMotion } from "../components/landing/HeroMotion";
import "./simple-home.css";

export const metadata: Metadata = {
  title: "دایرا | مدیریت ساده تعاملات اینستاگرام",
  description: "پاسخ خودکار کامنت و دایرکت، صندوق پیام‌ها، انتشار محتوا و تحلیل پیج؛ همه در یک داشبورد منظم.",
  openGraph: {
    title: "دایرا | همه تعاملات پیج، در یک جای ساده",
    description: "یک فضای خلوت برای مدیریت تعاملات، دایرکت و انتشار محتوای اینستاگرام.",
    locale: "fa_IR",
    type: "website",
  },
};

const features = [
  { icon: MessageCircle, title: "پاسخ خودکار به تعاملات", description: "برای کامنت، استوری، لایو، اشتراک‌گذاری و منشن پاسخ دلخواه بساز.", detail: "کامنت · استوری · لایو" },
  { icon: Send, title: "پاسخ خودکار دایرکت", description: "با کلمات کلیدی و قوانین مشخص، پاسخ پیام‌ها را از قبل تنظیم کن.", detail: "قوانین ساده و قابل تنظیم" },
  { icon: MessagesSquare, title: "صندوق دایرکت", description: "پیام‌ها و گفتگوها را در یک محیط مرتب و یکپارچه پیگیری کن.", detail: "همه گفتگوها، یکجا" },
  { icon: CalendarDays, title: "انتشار محتوا", description: "پست، ریلز، استوری و پست اسلایدی را آماده و زمان‌بندی کن.", detail: "برنامه‌ریزی و انتشار" },
  { icon: BarChart3, title: "تحلیل پیج", description: "عملکرد محتوا و روند تعاملات حساب اینستاگرامت را ببین.", detail: "آمارهای کاربردی" },
  { icon: BellRing, title: "ابزارهای تکمیلی", description: "یادآوری هوشمند، منوی دایرکت و پیام شروع گفتگو را مدیریت کن.", detail: "گفتگوهای منظم‌تر" },
] as const;

const steps = [
  { n: "۰۱", title: "پیجت را متصل کن", description: "حساب حرفه‌ای اینستاگرام را با مجوزهای موردنیاز متصل کن." },
  { n: "۰۲", title: "پاسخت را تنظیم کن", description: "مشخص کن برای هر تعامل چه پاسخ یا اقدامی انجام شود." },
  { n: "۰۳", title: "همه‌چیز را دنبال کن", description: "پیام‌ها، پاسخ‌ها و محتوایت را در داشبورد مدیریت کن." },
] as const;

const faqs = [
  {
    q: "دایرا برای چه پیج‌هایی قابل استفاده است؟",
    a: "برای حساب‌های حرفه‌ای اینستاگرام که شرایط اتصال و مجوزهای موردنیاز Meta را داشته باشند.",
  },
  {
    q: "پاسخ‌های خودکار چطور ارسال می‌شوند؟",
    a: "پاسخ‌ها بر اساس متن‌ها، کلمات کلیدی و قوانینی که خودت تعریف می‌کنی عمل می‌کنند. ارسال هر نوع پاسخ تابع محدودیت‌ها و مجوزهای Meta است.",
  },
  {
    q: "آیا پاسخ‌ها با هوش مصنوعی نوشته می‌شوند؟",
    a: "در حال حاضر پاسخ‌های خودکار با متن‌ها و قوانین تنظیم‌شده توسط خودت کار می‌کنند؛ تولید خودکار متن با هوش مصنوعی فعال نیست.",
  },
] as const;

function SectionHeading({ label, title, description }: {label: string; title: string; description?: string}) {
  return (
    <div className="sh-section-heading sh-reveal">
      <span className="sh-eyebrow">{label}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

/** A lightweight, CSS-only product illustration, not a misleading screenshot. */
function DashboardPreview() {
  return (
    <div className="sh-preview" aria-label="نمای نمونه از محیط مدیریت تعاملات دایرا">
      <div className="sh-preview__halo" aria-hidden="true"/>
      <div className="sh-preview__window" data-hero-entrance>
        <div className="sh-preview__top">
          <div className="sh-preview__brand"><span className="sh-preview__brand-icon"><Command size={17}/></span><span>داشبورد دایرا</span></div>
          <div className="sh-preview__top-status"><span/> نمای نمونه</div>
        </div>
        <div className="sh-preview__content">
          <div className="sh-preview__headline"><span>مدیریت تعاملات</span><span className="sh-preview__date">همه ابزارها، یکجا</span></div>
          <div className="sh-preview__message">
            <span className="sh-preview__avatar"><MessageCircle size={20}/></span>
            <div className="sh-preview__message-body">
              <span className="sh-preview__muted">کامنت جدید</span>
              <strong>سلام، قیمت این محصول چنده؟</strong>
            </div>
            <span className="sh-preview__message-dot" aria-hidden="true"/>
          </div>
          <div className="sh-preview__flow">
            <div className="sh-preview__flow-line"><span className="sh-preview__flow-icon"><WandSparkles size={17}/></span><span>قانون پاسخ خودکار</span><span className="sh-preview__flow-check"><Check size={14}/></span></div>
            <div className="sh-preview__flow-answer">سلام! جزئیات و اطلاعات محصول رو برات فرستادیم. 💙</div>
          </div>
          <div className="sh-preview__bottom">
            <span><span className="sh-preview__live-dot"/> پاسخ آماده</span>
            <span>تنظیم‌شده توسط شما <Check size={13}/></span>
          </div>
        </div>
      </div>
      <div className="sh-preview__float sh-preview__float--one" data-hero-entrance>
        <span><Sparkles size={16}/></span> ساده و قابل تنظیم
      </div>
      <div className="sh-preview__float sh-preview__float--two" data-hero-entrance>
        <span><Headphones size={16}/></span> یک صندوق مرتب
      </div>
    </div>
  );
}

function ExampleFlow() {
  return (
    <div className="sh-example__visual sh-reveal" aria-label="نمایش نمونه مراحل پاسخ به کامنت">
      <div className="sh-example__message"><span className="sh-example__user"><MessageCircle size={19}/></span><div><small>کامنت کاربر</small><strong>قیمت چنده؟</strong></div></div>
      <div className="sh-example__path"><span/> <ArrowLeft size={16}/> پاسخ طبق تنظیمات تو <span/></div>
      <div className="sh-example__message sh-example__message--response"><span className="sh-example__user"><Check size={19}/></span><div><small>پاسخ تعریف‌شده</small><strong>سلام! اطلاعات رو برات فرستادیم 💙</strong></div></div>
      <p>این تصویر یک نمونه نمایشی است. پاسخ خصوصی و سایر تعاملات مطابق مجوزها و محدودیت‌های Meta انجام می‌شوند.</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="sh-site" dir="rtl" id="top">
      <SimpleHeader />
      <a className="sh-skip" href="#content">رفتن به محتوای صفحه</a>
      <main id="content">
        <section className="sh-hero" aria-labelledby="sh-hero-title">
          <HeroMotion />
          <div className="sh-container sh-hero__inner">
            <div className="sh-hero__copy">
              <span className="sh-pill" data-hero-entrance><span className="sh-pill__dot"/> مدیریت ساده‌تر اینستاگرام</span>
              <h1 id="sh-hero-title" data-hero-entrance>برای مدیریت پیجت، <span>همه‌چیز ساده‌تر می‌شود.</span></h1>
              <p className="sh-hero__description" data-hero-entrance>از پاسخ خودکار به کامنت و دایرکت تا انتشار محتوا و تحلیل پیج. همه ابزارهای موردنیازت، در یک فضای مرتب و بدون پیچیدگی.</p>
              <div className="sh-hero__actions" data-hero-entrance>
                <Link href="/login" className="sh-button sh-button--primary">شروع با دایرا <ArrowUpLeft size={18} aria-hidden="true"/></Link>
                <a href="#features" className="sh-button sh-button--secondary">آشنایی با امکانات <ArrowLeft size={17} aria-hidden="true"/></a>
              </div>
              <div className="sh-hero__note" data-hero-entrance><ShieldCheck size={16} aria-hidden="true"/> تنظیمات شفاف، کنترل کامل در اختیار تو</div>
            </div>
            <DashboardPreview />
          </div>
          <div className="sh-hero__bottomline" aria-hidden="true"><span>DAIRA</span><span>یک فضای ساده برای کارهای روزمره پیج</span></div>
        </section>

        <section className="sh-section sh-features" id="features" aria-labelledby="sh-features-title">
          <div className="sh-container">
            <SectionHeading label="امکانات" title="هر آنچه لازم داری، بدون شلوغی." description="ابزارهای اصلی پیجت را بشناس و همه را از یک داشبورد مدیریت کن."/>
            <div className="sh-feature-grid">
              {features.map(({icon: Icon,title,description,detail},i)=>(
                <article key={title} className="sh-feature sh-reveal">
                  <div className="sh-feature__top"><span className="sh-feature__icon"><Icon size={22} strokeWidth={1.9} aria-hidden="true"/></span><span className="sh-feature__index">{String(i+1).padStart(2,"0")}</span></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="sh-feature__detail">{detail}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-section sh-example" id="example" aria-labelledby="sh-example-title">
          <div className="sh-container sh-example__inner">
            <div className="sh-example__copy sh-reveal">
              <span className="sh-eyebrow">یک مثال ساده</span>
              <h2 id="sh-example-title">یک کامنت،<br/><span>یک پاسخ به‌موقع.</span></h2>
              <p>کلمه کلیدی و پاسخ دلخواه را یک‌بار تنظیم کن؛ دایرا طبق همان قانون برای تعاملات پشتیبانی‌شده اقدام می‌کند.</p>
              <a href="#how" className="sh-inline-link">ببین چطور کار می‌کند <ArrowLeft size={17} aria-hidden="true"/></a>
            </div>
            <ExampleFlow />
          </div>
        </section>

        <section className="sh-section sh-how" id="how" aria-labelledby="sh-how-title">
          <div className="sh-container">
            <SectionHeading label="نحوه کار" title="شروعی ساده، در سه قدم." description="بدون نیاز به کدنویسی، قانون‌ها و پاسخ‌های خودت را تنظیم کن."/>
            <div className="sh-steps">
              {steps.map(step=>(
                <article className="sh-step sh-reveal" key={step.n}>
                  <span className="sh-step__number">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-section sh-faq" id="faq" aria-labelledby="sh-faq-title">
          <div className="sh-container sh-faq__inner">
            <div className="sh-faq__copy sh-reveal"><span className="sh-eyebrow"><CircleHelp size={16} aria-hidden="true"/> سؤالات متداول</span><h2 id="sh-faq-title">قبل از شروع،<br/>این‌ها را بدان.</h2><p>پاسخ‌های کوتاه به چند سؤال رایج درباره دایرا.</p></div>
            <div className="sh-faq__list">
              {faqs.map(({q,a})=>(
                <details key={q} className="sh-faq__item sh-reveal">
                  <summary>{q}<ChevronDown size={19} aria-hidden="true"/></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="sh-cta">
          <div className="sh-container">
            <div className="sh-cta__inner sh-reveal">
              <div className="sh-cta__orb" aria-hidden="true"/>
              <div className="sh-cta__copy"><span className="sh-cta__eyebrow">وقت یک شروع مرتب‌تر است</span><h2>پیجت را راحت‌تر مدیریت کن.</h2><p>تمرکزت روی ارتباط با مخاطب باشد، نه کارهای تکراری.</p></div>
              <Link href="/login" className="sh-button sh-button--light">ورود و شروع <ArrowUpLeft size={18} aria-hidden="true"/></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="sh-footer">
        <div className="sh-container sh-footer__inner">
          <div className="sh-footer__about">
            <Link href="/" className="sh-brand" aria-label="دایرا، صفحه اصلی"><Image src="/daira-header-logo-hd.webp" width={45} height={45} alt=""/> <span>دایرا</span></Link>
            <p>راهی ساده‌تر برای مدیریت تعاملات و محتوای اینستاگرام.</p>
          </div>
          <nav aria-label="پیوندهای اصلی"><a href="#features">امکانات</a><a href="#how">نحوه کار</a><a href="#faq">سؤالات متداول</a><Link href="/login">ورود</Link></nav>
          <nav aria-label="پیوندهای حقوقی"><Link href="/privacy-policy">حریم خصوصی</Link><Link href="/data-deletion">حذف اطلاعات (Data Deletion)</Link></nav>
        </div>
        <div className="sh-container sh-footer__bottom"><span>© {new Date().getFullYear()} دایرا</span><a href="#top">بازگشت به بالا <ArrowUpLeft size={15} aria-hidden="true"/></a></div>
      </footer>
    </div>
  );
}
