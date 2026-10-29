import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpLeft, BarChart3, BellRing, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Layers3, LockKeyhole, MessageCircle,
  MessagesSquare, MessageSquareText, Radio, Send, ShieldCheck, Sparkles, Zap,
} from "lucide-react";
import {
  LandingHeader, LandingReveal, CommentFlowDemo, InboxPreview,
  PublishingPreview, DirectExperienceDemo,
} from "../components/landing/LightInteractions";
import "./landing-light.css";

export const metadata: Metadata = {
  title: "دایرا | پاسخ خودکار اینستاگرام، دایرکت و انتشار محتوا",
  description: "دایرا، پنل یکپارچه برای پاسخ به کامنت، استوری و دایرکت، مدیریت گفتگوها، انتشار محتوا و تحلیل پیج حرفه‌ای اینستاگرام.",
  openGraph: {
    title: "دایرا | هر تعامل، شروع یک ارتباط بهتر",
    description: "ابزارهای مدیریت تعاملات و محتوای پیجت، کنار هم در دایرا.",
    type: "website",
    locale: "fa_IR",
  },
};

const featureCards = [
  { title: "پاسخ به کامنت", desc: "پاسخ‌های متنوع و کلمات کلیدی دلخواه", art: "/dashboard-art/comment-reply.webp", icon: MessageCircle, accent: "blue" },
  { title: "پاسخ به استوری", desc: "تعامل با مخاطبان از طریق استوری", art: "/dashboard-art/story-reply.webp", icon: Sparkles, accent: "violet" },
  { title: "پاسخ خودکار دایرکت", desc: "پاسخ‌های تعریف‌شده برای پیام‌های ورودی", art: "/dashboard-art/direct-automation.webp", icon: Send, accent: "blue" },
  { title: "اشتراک‌گذاری و منشن", desc: "مدیریت تعاملات مرتبط با محتوا", art: "/dashboard-art/share-mention.webp", icon: Layers3, accent: "violet" },
  { title: "پاسخ به لایو", desc: "پاسخ بر اساس کلمات مشخص در لایو", art: "/dashboard-art/live-reply.webp", icon: Radio, accent: "blue" },
  { title: "یادآوری هوشمند", desc: "پیگیری گفتگو در زمان تنظیم‌شده", art: "/dashboard-art/smart-reminders.webp", icon: BellRing, accent: "violet" },
  { title: "صندوق دایرکت", desc: "همه گفتگوها در یک فضای منظم", art: "/dashboard-art/inbox.webp", icon: MessagesSquare, accent: "blue" },
  { title: "انتشار محتوا", desc: "آماده‌سازی و زمان‌بندی انتشار", art: "/dashboard-art/publishing.webp", icon: CalendarDays, accent: "violet" },
  { title: "تحلیل پیج", desc: "نمایی خوانا از روند عملکرد", art: "/dashboard-art/insights.webp", icon: BarChart3, accent: "blue" },
  { title: "منوی دایرکت", desc: "دسترسی ساده به گزینه‌های گفتگو", art: "/dashboard-art/direct-menu.webp", icon: MessageSquareText, accent: "violet" },
  { title: "پیام شروع گفتگو", desc: "شروع مکالمه با گزینه‌های آماده", art: "/dashboard-art/icebreakers.webp", icon: Zap, accent: "blue" },
] as const;

function Eyebrow({ children, number }: { children: React.ReactNode; number: string }) {
  return <span className="hl-eyebrow"><span className="hl-eyebrow__number">{number}</span>{children}</span>;
}

function Actions({ secondary = true }: { secondary?: boolean }) {
  return (
    <div className="hl-actions">
      <Link href="/login" className="hl-btn hl-btn--primary">شروع استفاده <ArrowUpLeft size={18} aria-hidden="true" /></Link>
      {secondary && <a href="#features" className="hl-btn hl-btn--outline">مشاهده امکانات <ArrowLeft size={18} aria-hidden="true" /></a>}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="hl-hero-visual" aria-label="پیش‌نمایش مفهومی داشبورد دایرا و پاسخ خودکار">
      <div className="hl-stage-glow" aria-hidden="true" />
      <div className="hl-stage-grid" aria-hidden="true" />
      <div className="hl-stage-perspective">
        <div className="hl-product-window">
          <div className="hl-product-window__top"><div className="hl-window-dots" aria-hidden="true"><i/><i/><i/></div><span>نمای نمونه داشبورد دایرا</span><span className="hl-window-mark">D</span></div>
          <div className="hl-product-window__body">
            <div className="hl-product-window__sidebar" aria-hidden="true">
              <div className="hl-sb-active"><MessageCircle size={17} /><span>پاسخ‌ها</span></div>
              <div><MessagesSquare size={17} /><span>دایرکت</span></div>
              <div><CalendarDays size={17} /><span>انتشار</span></div>
              <div><BarChart3 size={17} /><span>تحلیل</span></div>
            </div>
            <div className="hl-product-window__content">
              <div className="hl-mini-title">مدیریت تعاملات <span className="hl-online-dot" /></div>
              <div className="hl-mini-stats">
                <div><span>پاسخ به کامنت</span><MessageCircle size={20} /></div>
                <div><span>صندوق دایرکت</span><MessagesSquare size={20} /></div>
              </div>
              <div className="hl-mini-feed">
                <div className="hl-mini-feed__head">نمونه روند پاسخ</div>
                <div className="hl-mini-feed__line"><span className="hl-avatar">م</span><span className="hl-mini-bubble">قیمت این محصول چنده؟</span></div>
                <div className="hl-mini-feed__line hl-mini-feed__line--reply"><span className="hl-mini-bubble">سلام! جزئیات رو برات فرستادم 💙</span><Check size={14}/></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hl-float-card hl-float-card--comment">
        <span className="hl-float-icon"><MessageCircle size={19}/></span>
        <div><b>کامنت جدید</b><span>قیمت لطفاً 🙌</span></div>
      </div>
      <div className="hl-float-card hl-float-card--sent">
        <span className="hl-float-icon hl-float-icon--blue"><CheckCircle2 size={19}/></span>
        <div><b>پاسخ تنظیم‌شده</b><span>آماده ارسال طبق قوانین شما</span></div>
      </div>
      <div className="hl-float-orb hl-float-orb--one" aria-hidden="true" />
      <div className="hl-float-orb hl-float-orb--two" aria-hidden="true" />
      <span className="hl-visual-caption">پیش‌نمایش مفهومی • داده نمایشی</span>
    </div>
  );
}

function FeatureCard({ item, index }: { item: typeof featureCards[number]; index: number }) {
  const Icon = item.icon;
  return (
    <article className={"hl-feature-card hl-feature-card--" + item.accent + (index < 2 ? " hl-feature-card--large" : "")}>
      <div className="hl-feature-card__top">
        <span className="hl-feature-card__art"><Image src={item.art} alt="" width={88} height={88} sizes="(max-width: 480px) 56px, 88px" /></span>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div className="hl-feature-card__bottom"><h3>{item.title}</h3><p>{item.desc}</p></div>
    </article>
  );
}

function InsightsPreview() {
  return (
    <div className="hl-insights-preview" aria-label="نمودار و شاخص‌های نمونه تحلیل پیج">
      <div className="hl-preview-top"><span><BarChart3 size={18}/> تحلیل پیج</span><span className="hl-demo-pill">داده نمایشی</span></div>
      <div className="hl-insights-cards"><div><span>بازدید محتوا</span><b>روند بازدید</b></div><div><span>تعاملات</span><b>روند تعامل</b></div><div><span>عملکرد</span><b>مقایسه دوره‌ها</b></div></div>
      <div className="hl-insights-chart">
        <svg viewBox="0 0 560 200" role="img" aria-label="نمودار نمایشی برای نشان‌دادن قابلیت تحلیل روند">
          <defs><linearGradient id="hl-graph-shade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--daira-primary)" stopOpacity=".21"/><stop offset="1" stopColor="var(--daira-primary)" stopOpacity="0"/></linearGradient></defs>
          {[50,100,150].map(y => <line key={y} x1="4" y1={y} x2="556" y2={y} stroke="var(--daira-chart-grid)" strokeDasharray="5 8" />)}
          <path d="M8 164 C45 159 69 175 99 143 S153 125 185 137 S248 92 288 102 S352 76 390 95 S462 42 499 63 S536 44 552 28 L552 190 L8 190Z" fill="url(#hl-graph-shade)" />
          <path className="hl-chart-line" d="M8 164 C45 159 69 175 99 143 S153 125 185 137 S248 92 288 102 S352 76 390 95 S462 42 499 63 S536 44 552 28" fill="none" stroke="var(--daira-primary)" strokeWidth="4" strokeLinecap="round"/>
        </svg>
        <div className="hl-insights-chart__legend"><span><i/> روند نمایشی تعاملات</span><span>بدون اتصال به داده واقعی</span></div>
      </div>
    </div>
  );
}

function FAQ() {
  const questions = [
    ["دایرا برای چه حساب‌هایی طراحی شده است؟", "برای حساب‌های حرفه‌ای اینستاگرام که شرایط اتصال و مجوزهای موردنیاز Meta را داشته باشند."],
    ["آیا پاسخ‌ها با هوش مصنوعی نوشته می‌شوند؟", "خیر. پاسخ‌های فعلی طبق قوانین، کلمات کلیدی و محتواهایی هستند که خودت تنظیم می‌کنی."],
    ["می‌توانم انتشار پست و ریلز را زمان‌بندی کنم؟", "دایرا ابزار انتشار و زمان‌بندی پست، ریلز، استوری و پست اسلایدی را ارائه می‌دهد؛ دسترسی عملی به نوع محتوا مطابق مجوزها و محدودیت‌های Meta است."],
    ["آیا پاسخ به کامنت می‌تواند با دایرکت همراه باشد؟", "در سناریوهای پشتیبانی‌شده، می‌توان در کنار پاسخ به کامنت، پیام خصوصی مرتبط تنظیم کرد. ارسال پیام تابع قوانین و محدودیت‌های اینستاگرام است."],
    ["همه قابلیت‌ها برای همه پیج‌ها فعال هستند؟", "خیر. بعضی امکانات به نوع حساب، دسترسی‌های تأییدشده و سیاست‌های فعلی Meta وابسته‌اند."],
  ];
  return (
    <div className="hl-faq__items">
      {questions.map(([q,a])=>(
        <details className="hl-faq-item" key={q}>
          <summary><span>{q}</span><span className="hl-faq-plus" aria-hidden="true">+</span></summary>
          <div className="hl-faq-item__answer"><p>{a}</p></div>
        </details>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="hl-home" dir="rtl" id="top">
      <LandingHeader />
      <LandingReveal />
      <a href="#home-content" className="hl-skip">رفتن به محتوای اصلی</a>
      <section className="hl-hero hl-section" id="home-content" aria-labelledby="hl-title">
        <div className="hl-container hl-hero__layout">
          <div className="hl-hero__copy">
            <span className="hl-kicker"><Sparkles size={16} /> یک فضای یکپارچه برای مدیریت پیج</span>
            <h1 id="hl-title">هر تعامل،<br/><span>شروع یک ارتباط بهتر.</span></h1>
            <p>پاسخ‌های خودکار، صندوق دایرکت، انتشار محتوا و تحلیل پیج؛ ابزارهایی که برای مدیریت روزانه اینستاگرامت نیاز داری، در یک فضای منظم.</p>
            <Actions />
            <div className="hl-hero__notes"><span><CheckCircle2 size={17}/> پاسخ‌ها با تنظیمات خودت</span><span><ShieldCheck size={17}/> امکانات مطابق مجوزهای Meta</span></div>
          </div>
          <HeroVisual />
        </div>
        <div className="hl-container hl-hero-bottom"><span>یک پنل برای تعامل، گفتگو و محتوا</span><a href="#demo">ببین چطور کار می‌کند <ChevronDown size={18}/></a></div>
      </section>

      <section className="hl-section hl-intro-strip" aria-label="محورهای اصلی دایرا">
        <div className="hl-container hl-strip-items">
          <span><MessageCircle size={20}/> پاسخ‌های خودکار</span><span><MessagesSquare size={20}/> صندوق دایرکت</span><span><CalendarDays size={20}/> انتشار محتوا</span><span><BarChart3 size={20}/> تحلیل پیج</span>
        </div>
      </section>

      <section className="hl-section hl-demo-section" id="demo" aria-labelledby="hl-demo-title">
        <div className="hl-container hl-split">
          <div className="hl-section-copy hl-reveal">
            <Eyebrow number="۰۱">از تعامل تا گفتگو</Eyebrow>
            <h2 id="hl-demo-title">از یک کامنت ساده،<br/><span>یک گفت‌وگو بساز.</span></h2>
            <p>کلمات کلیدی و پاسخ‌های دلخواهت را مشخص کن تا دایرا طبق تنظیماتت واکنش نشان دهد؛ از پاسخ زیر کامنت تا پیام خصوصی در شرایطی که اینستاگرام اجازه می‌دهد.</p>
            <ul className="hl-check-list"><li><Check size={17}/> کلمات کلیدی قابل تنظیم</li><li><Check size={17}/> پاسخ‌های متنوع برای کامنت‌ها</li><li><Check size={17}/> تنظیم مستقل پاسخ هر بخش</li></ul>
          </div>
          <CommentFlowDemo />
        </div>
      </section>

      <section className="hl-section hl-features" id="features" aria-labelledby="hl-features-title">
        <div className="hl-container">
          <div className="hl-section-head hl-reveal"><Eyebrow number="۰۲">قابلیت‌های دایرا</Eyebrow><h2 id="hl-features-title">هر کاری که برای مدیریت پیجت لازم داری، <span>یکجا.</span></h2><p>از پاسخ‌های خودکار تا انتشار محتوا و مدیریت گفتگوها، هر بخش ابزار مخصوص خودش را دارد.</p></div>
          <div className="hl-feature-grid">{featureCards.map((item,i)=><FeatureCard item={item} index={i} key={item.title}/>)}</div>
        </div>
      </section>

      <section className="hl-section hl-showcase" id="inbox" aria-labelledby="hl-inbox-title">
        <div className="hl-container hl-split hl-split--preview-right">
          <div className="hl-section-copy hl-reveal">
            <Eyebrow number="۰۳">صندوق دایرکت</Eyebrow>
            <h2 id="hl-inbox-title">همه گفتگوها، <span>در یک قاب.</span></h2>
            <p>پیام‌ها را مرتب ببین، بین گفتگوهای خوانده‌شده و خوانده‌نشده جابه‌جا شو و از همان صندوق گفتگوها را دنبال کن.</p>
            <span className="hl-inline-note"><MessagesSquare size={18}/> نمایش تعاملی با پیام‌های نمونه</span>
          </div>
          <InboxPreview />
        </div>
      </section>

      <section className="hl-section hl-publishing" id="publishing" aria-labelledby="hl-publishing-title">
        <div className="hl-container hl-split">
          <div className="hl-section-copy hl-reveal">
            <Eyebrow number="۰۴">انتشار محتوا</Eyebrow>
            <h2 id="hl-publishing-title">محتوا را آماده کن،<br/><span>زمان انتشارش را تنظیم کن.</span></h2>
            <p>پست، ریلز، استوری و پست اسلایدی را در یک محیط مشخص آماده و برای انتشار برنامه‌ریزی کن.</p>
            <span className="hl-inline-note"><Clock3 size={18}/> پیش‌نمایش نوع محتوا را انتخاب کن</span>
          </div>
          <PublishingPreview />
        </div>
      </section>

      <section className="hl-section hl-insights" id="insights" aria-labelledby="hl-insights-title">
        <div className="hl-container hl-split hl-split--preview-right">
          <div className="hl-section-copy hl-reveal">
            <Eyebrow number="۰۵">تحلیل پیج</Eyebrow>
            <h2 id="hl-insights-title">تصمیم بهتر، با <span>دید روشن‌تر.</span></h2>
            <p>روند شاخص‌های عملکرد، وضعیت تعاملات و اطلاعات محتوایت را در نمایی خوانا ببین. نمودار روبه‌رو فقط نمونه‌ای از شکل نمایش داده‌هاست.</p>
            <span className="hl-inline-note"><BarChart3 size={18}/> اطلاعات نمودار نمایشی است</span>
          </div>
          <InsightsPreview />
        </div>
      </section>

      <section className="hl-section hl-direct" id="direct" aria-labelledby="hl-direct-title">
        <div className="hl-container hl-split">
          <div className="hl-section-copy hl-reveal">
            <Eyebrow number="۰۶">تجربه گفتگو</Eyebrow>
            <h2 id="hl-direct-title">شروع گفتگو را هم <span>ساده‌تر کن.</span></h2>
            <p>منوی دایرکت و پیام شروع گفتگو کمک می‌کنند مخاطب راحت‌تر گزینه مناسب خودش را پیدا کند؛ دقیقاً با ساختار تعاملی مربوط به اینستاگرام.</p>
            <ul className="hl-check-list"><li><Check size={17}/> منوی دایرکت با انتخاب گزینه‌ها</li><li><Check size={17}/> پیام‌های شروع گفتگو با دکمه‌های آبی</li></ul>
          </div>
          <DirectExperienceDemo />
        </div>
      </section>

      <section className="hl-section hl-steps" id="how" aria-labelledby="hl-how-title">
        <div className="hl-container">
          <div className="hl-section-head hl-reveal"><Eyebrow number="۰۷">شروع با دایرا</Eyebrow><h2 id="hl-how-title">سه قدم تا مدیریت منظم‌تر پیج.</h2><p>بدون فرایندهای پیچیده؛ تنظیمات دست خودت است.</p></div>
          <div className="hl-steps-grid">
            <article className="hl-step hl-reveal"><span className="hl-step-num">۰۱</span><div className="hl-step-visual"><span className="hl-step-card"><LockKeyhole size={34}/></span><span className="hl-step-glint"/></div><h3>اتصال حساب</h3><p>حساب حرفه‌ای اینستاگرامت را با مجوزهای موردنیاز متصل کن.</p></article>
            <article className="hl-step hl-reveal"><span className="hl-step-num">۰۲</span><div className="hl-step-visual"><span className="hl-step-card"><MessageCircle size={34}/></span><span className="hl-step-glint"/></div><h3>تنظیم پاسخ</h3><p>تعامل، کلمات کلیدی و پاسخ دلخواهت را انتخاب کن.</p></article>
            <article className="hl-step hl-reveal"><span className="hl-step-num">۰۳</span><div className="hl-step-visual"><span className="hl-step-card"><CheckCircle2 size={34}/></span><span className="hl-step-glint"/></div><h3>مدیریت در پنل</h3><p>گفتگوها، پاسخ‌ها و انتشار محتوا را از داشبورد دنبال کن.</p></article>
          </div>
        </div>
      </section>

      <section className="hl-section hl-faq" id="faq" aria-labelledby="hl-faq-title">
        <div className="hl-container hl-faq__layout">
          <div className="hl-section-copy hl-reveal"><Eyebrow number="۰۸">سؤالات متداول</Eyebrow><h2 id="hl-faq-title">چند پاسخ،<br/><span>قبل از شروع.</span></h2><p>چیزهایی که بهتر است پیش از اتصال حساب و تنظیم پاسخ‌ها بدانی.</p><CircleHelp className="hl-faq-icon" size={65} aria-hidden="true"/></div>
          <FAQ/>
        </div>
      </section>

      <section className="hl-section hl-final" id="start" aria-labelledby="hl-final-title">
        <div className="hl-container"><div className="hl-final-panel hl-reveal"><span className="hl-final-shimmer" aria-hidden="true" /><span className="hl-kicker"><Zap size={16}/> دایرا، کنار پیج تو</span><h2 id="hl-final-title">زمانش رسیده مدیریت پیجت <span>ساده‌تر باشه.</span></h2><p>پاسخ‌های خودکار، مدیریت دایرکت، انتشار محتوا و تحلیل پیج؛ همه در یک پنل روشن و منظم.</p><Actions secondary={false} /><span className="hl-final-note"><ShieldCheck size={16}/> دسترسی به قابلیت‌ها تابع شرایط حساب و سیاست‌های Meta است.</span></div></div>
      </section>

      <footer className="hl-footer">
        <div className="hl-container hl-footer__grid">
          <div className="hl-footer__brand"><Link href="/" className="hl-brand"><Image src="/daira-header-logo-hd.webp" width={90} height={90} alt="" sizes="48px"/><span>دایرا</span></Link><p>فضایی یکپارچه برای مدیریت تعاملات، گفتگوها و محتوای اینستاگرام.</p></div>
          <nav aria-label="پیوندهای سایت"><b>دایرا</b><a href="#features">امکانات</a><a href="#how">چطور کار می‌کند؟</a><a href="#faq">سؤالات متداول</a><Link href="/login">ورود</Link></nav>
          <nav aria-label="پیوندهای حقوقی"><b>اطلاعات و قوانین</b><Link href="/privacy-policy">حریم خصوصی</Link><Link href="/data-deletion">حذف اطلاعات (Data Deletion)</Link></nav>
        </div>
        <div className="hl-container hl-footer__bottom"><span>© {new Date().getFullYear()} دایرا</span><a href="#top">بازگشت به بالا <ArrowUpLeft size={15}/></a></div>
      </footer>
    </main>
  );
}
