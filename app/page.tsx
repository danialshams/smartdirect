import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpLeft, BarChart3, BellRing, CalendarCheck2,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3,
  HeartHandshake, Layers3, MessageCircle, MessageSquareText,
  MessagesSquare, Radio, Send, ShieldCheck, Sparkles,
  Search, MoreHorizontal, CheckCheck,
} from "lucide-react";
import { SimpleHeader } from "../components/landing/SimpleHeader";
import { HeroMotion } from "../components/landing/HeroMotion";
import { LandingGlass } from "../components/landing/LandingGlass";
import "./simple-home.css";

export const metadata: Metadata = {
  title: "دایرا | مدیریت کامنت، دایرکت و انتشار محتوای اینستاگرام",
  description: "دایرا، فضایی ساده برای پاسخ‌های خودکار اینستاگرام، مدیریت دایرکت، انتشار محتوا و تحلیل پیج.",
  openGraph: {
    title: "دایرا | مدیریت ساده‌تر تعاملات اینستاگرام",
    description: "پاسخ‌های خودکار، گفتگوها، انتشار محتوا و تحلیل پیج در یک پنل.",
    locale: "fa_IR",
    type: "website",
  },
};

const groups = [
  {
    icon: MessageCircle,
    image: "/dashboard-art/comment-reply.webp",
    title: "پاسخ به تعاملات",
    description: "برای کامنت‌ها و تعاملات مختلف، پاسخ‌های دلخواهت را از قبل تنظیم کن.",
    tags: ["کامنت", "استوری", "لایو", "اشتراک‌گذاری و منشن"],
  },
  {
    icon: Send,
    image: "/dashboard-art/direct-automation.webp",
    title: "پاسخ خودکار دایرکت",
    description: "پیام‌های ورودی را با قوانین و کلمات کلیدی خودت مدیریت کن.",
    tags: ["کلمات کلیدی", "پاسخ‌های تعریف‌شده"],
  },
  {
    icon: MessagesSquare,
    image: "/dashboard-art/inbox.webp",
    title: "صندوق دایرکت",
    description: "گفتگوها را در یک فضای مرتب ببین و پاسخ بده.",
    tags: ["همه پیام‌ها", "خوانده", "خوانده‌نشده"],
  },
  {
    icon: CalendarCheck2,
    image: "/dashboard-art/publishing.webp",
    title: "انتشار محتوا",
    description: "محتوایت را آماده کن و زمان انتشارش را مشخص کن.",
    tags: ["پست", "ریلز", "استوری", "پست اسلایدی"],
  },
  {
    icon: BarChart3,
    image: "/dashboard-art/insights.webp",
    title: "تحلیل پیج",
    description: "شاخص‌های عملکرد و روند تعاملات پیجت را یکجا ببین.",
    tags: ["عملکرد پیج", "روند تعاملات"],
  },
  {
    icon: BellRing,
    image: "/dashboard-art/smart-reminders.webp",
    title: "ابزارهای گفتگو",
    description: "با ابزارهای مکمل، شروع و ادامه مکالمه را منظم‌تر کن.",
    tags: ["یادآوری هوشمند", "منوی دایرکت", "پیام شروع گفتگو"],
  },
] as const;

const steps = [
  { number: "۰۱", title: "حساب پیجت را متصل کن", copy: "حساب حرفه‌ای اینستاگرام را با دسترسی‌های موردنیاز متصل کن.", icon: ShieldCheck },
  { number: "۰۲", title: "قانون پاسخ بساز", copy: "نوع تعامل، کلمات کلیدی و پاسخ دلخواهت را مشخص کن.", icon: MessageCircle },
  { number: "۰۳", title: "همه‌چیز را یکجا مدیریت کن", copy: "گفتگوها، پاسخ‌ها و محتوایت را در داشبورد دنبال کن.", icon: CheckCircle2 },
] as const;

const faqs = [
  {
    q: "دایرا برای چه حساب‌هایی قابل استفاده است؟",
    a: "برای حساب‌های حرفه‌ای اینستاگرام که شرایط اتصال و مجوزهای موردنیاز Meta را داشته باشند.",
  },
  {
    q: "پاسخ‌های خودکار چگونه کار می‌کنند؟",
    a: "پاسخ‌ها بر اساس قوانین، کلمات کلیدی و متن‌هایی ارسال می‌شوند که خودت تنظیم کرده‌ای. امکانات ارسال تابع مجوزها و سیاست‌های Meta هستند.",
  },
  {
    q: "آیا می‌توانم محتوای اینستاگرام را زمان‌بندی کنم؟",
    a: "دایرا بخش انتشار و زمان‌بندی پست، ریلز، استوری و پست اسلایدی دارد. نوع محتوای قابل انتشار به دسترسی‌های حساب بستگی دارد.",
  },
  {
    q: "آیا پاسخ‌ها با هوش مصنوعی نوشته می‌شوند؟",
    a: "در حال حاضر پاسخ‌های خودکار طبق تنظیمات و متن‌های خودت عمل می‌کنند، نه با تولید خودکار متن توسط هوش مصنوعی.",
  },
] as const;

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="sh-section-heading sh-reveal">
      <span className="sh-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

function DirectInboxPreview() {
  return (
    <div className="sh-inbox-stage" aria-label="نمای نمونه از صندوق دایرکت دایرا">
      <div className="sh-inbox-aura" aria-hidden="true" />
      <div className="sh-inbox-depth-glow" aria-hidden="true" />
      <div className="sh-inbox-stage__float">
        <div className="sh-inbox-perspective" data-hero-panel>
          <div className="sh-inbox-window">
          <div className="sh-inbox-topbar" data-hero-bar>
            <span className="sh-inbox-topbrand"><MessagesSquare size={19} aria-hidden="true" /> صندوق دایرکت</span>
            <span className="sh-inbox-demo-label">نمای نمونه</span>
          </div>
          <div className="sh-inbox-body">
            <div className="sh-inbox-threads" aria-hidden="true" data-hero-threads>
              <div className="sh-inbox-threads__title"><strong>گفتگوها</strong><Search size={15} /></div>
              <div className="sh-inbox-thread sh-inbox-thread--selected"><span className="sh-inbox-avatar sh-inbox-avatar--blue">م</span><span><strong>مشتری نمونه</strong><small>قیمت این محصول چنده؟</small></span><i aria-hidden="true" /></div>
              <div className="sh-inbox-thread"><span className="sh-inbox-avatar sh-inbox-avatar--pink">ن</span><span><strong>نگار</strong><small>ممنون از راهنمایی‌تون</small></span></div>
              <div className="sh-inbox-thread"><span className="sh-inbox-avatar sh-inbox-avatar--violet">س</span><span><strong>سارا</strong><small>سلام، وقت بخیر</small></span></div>
            </div>
            <div className="sh-inbox-chat">
              <div className="sh-inbox-chat__header" data-hero-chat><span className="sh-inbox-avatar sh-inbox-avatar--blue">م</span><span><strong>مشتری نمونه</strong><small>گفتگوی نمایشی</small></span><MoreHorizontal size={19} aria-hidden="true" /></div>
              <div className="sh-inbox-chat__messages">
                <span className="sh-inbox-chat__day">امروز</span>
                <div className="sh-chat-message sh-chat-message--incoming" data-hero-incoming>سلام، قیمت این محصول چنده؟<small>۱۰:۴۲</small></div>
                <div className="sh-chat-message sh-chat-message--outgoing" data-hero-outgoing>سلام! اطلاعات محصول رو برات فرستادم 💙<small>۱۰:۴۲ <CheckCheck size={13} aria-hidden="true" /></small></div>
              </div>
              <div className="sh-inbox-compose" aria-hidden="true"><span>پیام خود را بنویسید...</span><span className="sh-inbox-compose__send"><Send size={16}/></span></div>
            </div>
          </div>
        </div>
        </div>
      </div>
      <div className="sh-inbox-float sh-inbox-float--new" data-hero-float><LandingGlass className="sh-inbox-float__inner"><span className="sh-inbox-float__icon"><MessageCircle size={18}/></span><span><strong>پیام جدید</strong><small>قیمت این محصول چنده؟</small></span></LandingGlass></div>
      <div className="sh-inbox-float sh-inbox-float--sent" data-hero-float><LandingGlass className="sh-inbox-float__inner"><CheckCircle2 size={18}/><strong>پاسخ خودکار آماده شد</strong></LandingGlass></div>
    </div>
  );
}

function ConversationPreview() {
  return (
    <div className="sh-conversation sh-reveal" aria-label="نمونه نمایشی از پاسخ به کامنت و دایرکت">
      <div className="sh-conversation__top"><span><MessageCircle size={18}/> یک سناریوی آشنا</span><span>نمای نمونه</span></div>
      <div className="sh-conversation__body">
        <div className="sh-conversation__item">
          <span className="sh-conversation__avatar">ک</span>
          <div><small>کامنت کاربر</small><span className="sh-bubble">قیمت این محصول چنده؟</span></div>
        </div>
        <div className="sh-conversation__arrow"><ArrowLeft size={17}/><span>پاسخ طبق تنظیمات تو</span></div>
        <div className="sh-conversation__item sh-conversation__item--reply">
          <span className="sh-conversation__avatar sh-conversation__avatar--reply"><Check size={18}/></span>
          <div><small>پاسخ تعریف‌شده</small><span className="sh-bubble sh-bubble--reply">سلام! جزئیات رو برات فرستادم 💙</span></div>
        </div>
      </div>
      <p className="sh-conversation__foot">این یک نمایش نمونه است. پاسخ خصوصی و سایر تعاملات مطابق محدودیت‌ها و مجوزهای Meta انجام می‌شوند.</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="sh-site" dir="rtl" id="top">
      <div className="sh-optics-backdrop" id="sh-optics-backdrop" aria-hidden="true"><span className="sh-optics-orb sh-optics-orb--one" /><span className="sh-optics-orb sh-optics-orb--two" /></div>
      <SimpleHeader />
      <a className="sh-skip" href="#content">رفتن به محتوای صفحه</a>
      <main id="content">
        <section className="sh-hero" aria-labelledby="sh-hero-title">
          <HeroMotion />
          <div className="sh-container sh-hero__grid">
            <div className="sh-hero__copy">
              <span className="sh-hero__eyebrow" data-hero-entrance><Sparkles size={15} aria-hidden="true" /> دستیار تعاملات اینستاگرام</span>
              <h1 id="sh-hero-title" data-hero-entrance>دایرکت‌هات رو <span>با دایرا مدیریت کن.</span></h1>
              <p className="sh-hero__description" data-hero-entrance>از پاسخ به کامنت تا صندوق دایرکت؛ همه تعاملات پیجت در یک فضای ساده و منظم.</p>
              <div className="sh-actions" data-hero-entrance>
                <Link className="sh-button sh-button--primary" href="/login">شروع با دایرا <ArrowUpLeft size={18}/></Link>
                <a className="sh-button sh-button--ghost" href="#features">مشاهده امکانات <ArrowLeft size={17}/></a>
              </div>
            </div>
            <DirectInboxPreview />
          </div>
        </section>

        <section className="sh-strip" aria-label="دسته‌های اصلی ابزارها">
          <div className="sh-container sh-strip__inner">
            <span><MessageCircle size={18}/> پاسخ خودکار</span>
            <span><MessagesSquare size={18}/> صندوق دایرکت</span>
            <span><CalendarCheck2 size={18}/> انتشار محتوا</span>
            <span><BarChart3 size={18}/> تحلیل پیج</span>
          </div>
        </section>

        <section className="sh-section sh-features" id="features">
          <div className="sh-container">
            <SectionHeading eyebrow="امکانات دایرا" title="هر چیزی که لازم داری، در یک جا." description="ابزارهای مختلف را از یک داشبورد مدیریت کن؛ بدون شلوغی و مراحل اضافی."/>
            <div className="sh-feature-grid">
              {groups.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="sh-feature sh-reveal" key={item.title}>
                    <div className="sh-feature__top"><span className="sh-feature__art"><Image src={item.image} alt="" width={84} height={84} sizes="(max-width: 600px) 58px, 84px"/></span><Icon size={20} aria-hidden="true"/></div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="sh-tags">{item.tags.map((tag)=><span key={tag}>{tag}</span>)}</div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="sh-section sh-example-section" id="example">
          <div className="sh-container sh-example-grid">
            <div className="sh-example-copy sh-reveal">
              <span className="sh-eyebrow">یک نمونه ساده</span>
              <h2>از یک کامنت،<br/><span>تا یک گفت‌وگوی بهتر.</span></h2>
              <p>کلمات کلیدی را مشخص کن و پاسخ دلخواهت را بنویس. دایرا به تعاملات پشتیبانی‌شده، مطابق قوانین تنظیم‌شده پاسخ می‌دهد.</p>
              <div className="sh-mini-points"><span><Check size={16}/> کلمات کلیدی دلخواه</span><span><Check size={16}/> پاسخ‌های متنوع برای کامنت</span><span><Check size={16}/> تنظیم جداگانه هر بخش</span></div>
            </div>
            <ConversationPreview />
          </div>
        </section>

        <section className="sh-section sh-how" id="how">
          <div className="sh-container">
            <SectionHeading eyebrow="چطور شروع کنیم؟" title="در سه قدم، کار را شروع کن." description="برای تنظیم پاسخ‌های خودکار لازم نیست برنامه‌نویسی بلد باشی."/>
            <div className="sh-steps">
              {steps.map((step) => {
                const Icon = step.icon;
                return <article className="sh-step sh-reveal" key={step.number}>
                  <span className="sh-step__number">{step.number}</span>
                  <span className="sh-step__icon"><Icon size={24}/></span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section className="sh-section sh-faq" id="faq">
          <div className="sh-container sh-faq__grid">
            <div className="sh-faq__intro sh-reveal"><span className="sh-eyebrow"><CircleHelp size={16}/> سؤالات متداول</span><h2>چند پاسخ قبل از شروع.</h2><p>سؤالات اصلی درباره استفاده از دایرا و اتصال حساب اینستاگرام.</p></div>
            <div className="sh-faq__items">{faqs.map((item)=><details className="sh-faq__item" key={item.q}><summary><span>{item.q}</span><ChevronDown size={19} aria-hidden="true"/></summary><p>{item.a}</p></details>)}</div>
          </div>
        </section>

        <section className="sh-cta">
          <div className="sh-container">
            <div className="sh-cta__panel sh-reveal">
              <div><span className="sh-eyebrow"><HeartHandshake size={16}/> دایرا، کنار پیج تو</span><h2>مدیریت پیجت را ساده‌تر کن.</h2><p>کامنت‌ها، دایرکت‌ها و محتواها را از یک پنل مرتب مدیریت کن.</p></div>
              <Link className="sh-button sh-button--primary" href="/login">شروع استفاده <ArrowUpLeft size={18}/></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="sh-footer">
        <div className="sh-container sh-footer__content">
          <div className="sh-footer__brand"><Link href="/" className="sh-brand"><Image src="/daira-header-logo-hd.webp" width={90} height={90} alt="" sizes="44px"/><span>دایرا</span></Link><p>ابزارهای مدیریت تعاملات و محتوای اینستاگرام، در یک فضای منظم.</p></div>
          <nav aria-label="لینک‌های صفحه"><strong>دایرا</strong><a href="#features">امکانات</a><a href="#how">چطور کار می‌کند؟</a><a href="#faq">سؤالات متداول</a><Link href="/login">ورود</Link></nav>
          <nav aria-label="لینک‌های حقوقی"><strong>قوانین و اطلاعات</strong><Link href="/privacy-policy">حریم خصوصی</Link><Link href="/data-deletion">حذف اطلاعات (Data Deletion)</Link></nav>
        </div>
        <div className="sh-container sh-footer__bottom"><span>© {new Date().getFullYear()} دایرا</span><a href="#top">بازگشت به بالا <ArrowUpLeft size={15}/></a></div>
      </footer>
    </div>
  );
}
