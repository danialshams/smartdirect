import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpLeft, BarChart3, CalendarDays, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Headphones, Instagram, Layers3, LockKeyhole,
  Menu, MessageCircle, MessageSquareText, Play, Radio, Send, ShieldCheck,
  Sparkles, WandSparkles, Zap,
} from "lucide-react";
import { LandingMotion } from "../components/landing/LandingMotion";
import "./landing.css";

export const metadata: Metadata = {
  title: "دایرا | مدیریت پاسخ‌ها، دایرکت و انتشار محتوای اینستاگرام",
  description:
    "دایرا، ابزار یکپارچه مدیریت تعاملات پیج حرفه‌ای اینستاگرام: پاسخ‌های خودکار، صندوق دایرکت، انتشار و زمان‌بندی محتوا و تحلیل پیج.",
  openGraph: {
    title: "دایرا | یک پنل برای ابزارهای پیجت",
    description: "مدیریت تعاملات اینستاگرام با پاسخ‌های خودکار، انتشار محتوا و صندوق دایرکت.",
    type: "website",
    locale: "fa_IR",
  },
};

const tools = [
  { title: "پاسخ به کامنت", icon: MessageCircle, art: "/dashboard-art/comment-reply.webp" },
  { title: "پاسخ به استوری", icon: Instagram, art: "/dashboard-art/story-reply.webp" },
  { title: "پاسخ خودکار دایرکت", icon: Send, art: "/dashboard-art/direct-automation.webp" },
  { title: "صندوق دایرکت", icon: MessageSquareText, art: "/dashboard-art/inbox.webp" },
  { title: "انتشار محتوا", icon: CalendarDays, art: "/dashboard-art/publishing.webp" },
  { title: "تحلیل پیج", icon: BarChart3, art: "/dashboard-art/insights.webp" },
] as const;

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={"dl-brand" + (light ? " dl-brand--light" : "")} href="/" aria-label="دایرا، صفحه اصلی">
      <span className="dl-brand-mark" aria-hidden="true"><Image src="/daira-header-logo-hd.webp" alt="" width={100} height={100} sizes="42px" /></span>
      <span>دایرا</span>
    </Link>
  );
}

function Core({ small = false }: { small?: boolean }) {
  return (
    <div className={"dl-core" + (small ? " dl-core--small" : "")} aria-hidden="true">
      <div className="dl-orbit dl-orbit--one" />
      <div className="dl-orbit dl-orbit--two" />
      <div className="dl-orbit dl-orbit--three" />
      <div className="dl-core-glow" />
      <div className="dl-core-body"><span>D</span><span className="dl-core-eye" /></div>
    </div>
  );
}

function Label({ index, children }: { index: string; children: React.ReactNode }) {
  return <span className="dl-eyebrow"><span>{index}</span>{children}</span>;
}

function ActionLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={"dl-actions" + (compact ? " dl-actions--compact" : "")}>
      <Link href="/login" className="dl-button dl-button--primary">شروع استفاده <ArrowUpLeft size={18} aria-hidden="true" /></Link>
      <a href="#features" className="dl-button dl-button--outline">آشنایی با امکانات <ArrowLeft size={17} aria-hidden="true" /></a>
    </div>
  );
}

export default function Home() {
  return (
    <main className="daira-landing" id="top" dir="rtl">
      <LandingMotion />
      <a className="dl-skip" href="#features">رفتن به معرفی امکانات</a>
      <header className="dl-header">
        <div className="dl-header__inner">
          <Brand />
          <nav className="dl-nav" aria-label="ناوبری اصلی">
            <a href="#features">امکانات</a>
            <a href="#automations">پاسخ‌های خودکار</a>
            <a href="#publishing">انتشار محتوا</a>
            <a href="#insights">تحلیل پیج</a>
            <a href="#questions">سؤالات متداول</a>
          </nav>
          <div className="dl-header__actions">
            <Link className="dl-login" href="/login">ورود</Link>
            <Link className="dl-button dl-button--primary dl-button--header" href="/login">شروع استفاده <ArrowUpLeft size={16} aria-hidden="true" /></Link>
          </div>
          <details className="dl-mobile-menu">
            <summary aria-label="باز کردن منوی سایت"><Menu size={23} /></summary>
            <nav aria-label="ناوبری موبایل">
              <a href="#features">امکانات</a><a href="#automations">پاسخ‌های خودکار</a>
              <a href="#inbox">صندوق دایرکت</a><a href="#publishing">انتشار محتوا</a>
              <a href="#insights">تحلیل پیج</a><a href="#questions">سؤالات متداول</a>
              <Link href="/login">ورود به دایرا <ArrowUpLeft size={16} /></Link>
            </nav>
          </details>
        </div>
      </header>

      <nav className="dl-progress" aria-label="رفتن به بخش‌های صفحه">
        {[
          ["start", "شروع"], ["features", "امکانات"], ["automations", "پاسخ خودکار"],
          ["inbox", "دایرکت"], ["publishing", "انتشار"], ["insights", "تحلیل"],
          ["glass", "یکپارچگی"], ["workspace", "شروع استفاده"],
        ].map(([id, label], i) => (
          <a key={id} href={"#" + id} aria-label={label} data-progress-for={id}>
            <span>{String(i + 1).padStart(2, "0")}</span><i aria-hidden="true" />
          </a>
        ))}
      </nav>

      <section className="dl-section dl-dark dl-hero" id="start" data-dl-scene>
        <div className="dl-starfield" aria-hidden="true" />
        <div className="dl-wrap dl-hero__grid">
          <div className="dl-hero__copy">
            <Label index="01">مدیریت ساده‌تر تعاملات اینستاگرام</Label>
            <h1>همه ابزارهای پیجت،<br /><em>در دایرا</em></h1>
            <p>پاسخ‌های خودکار، مدیریت دایرکت، انتشار محتوا و تحلیل پیج؛ در یک پنل ساده و منظم.</p>
            <ActionLinks />
            <div className="dl-hero__proof">
              <span><CheckCircle2 size={17} /> ابزارهای متصل به اینستاگرام</span>
              <span><ShieldCheck size={17} /> مدیریت از یک پنل</span>
            </div>
          </div>
          <div className="dl-hero__visual">
            <div className="dl-hero__halo" aria-hidden="true" />
            <Core />
            <div className="dl-float dl-float--one"><MessageCircle size={20} /> پاسخ به کامنت</div>
            <div className="dl-float dl-float--two"><Send size={20} /> دایرکت</div>
            <div className="dl-float dl-float--three"><BarChart3 size={20} /> تحلیل پیج</div>
            <div className="dl-float dl-float--four"><CalendarDays size={20} /> انتشار محتوا</div>
          </div>
        </div>
        <a href="#features" className="dl-scroll-prompt">برای کشف دایرا اسکرول کن <ChevronDown size={18} /></a>
      </section>

      <section className="dl-section dl-dark dl-ecosystem" id="features" data-dl-scene>
        <div className="dl-wrap">
          <div className="dl-section-heading dl-section-heading--center">
            <Label index="02">جهان قابلیت‌های دایرا</Label>
            <h2>همه ابزارهای موردنیازت <em>در یک مدار</em></h2>
            <p>برای هر نوع تعامل، ابزاری مشخص؛ بدون جابه‌جایی میان چند سرویس متفاوت.</p>
          </div>
          <div className="dl-ecosystem__stage">
            <div className="dl-ecosystem__rings" aria-hidden="true" />
            <Core small />
            <div className="dl-tool-grid">
              {tools.map(({ title, icon: Icon, art }, i) => (
                <div className={"dl-tool dl-tool--" + (i + 1)} key={title}>
                  <span className="dl-tool__image"><Image src={art} alt="" width={48} height={48} sizes="48px" /></span>
                  <span>{title}</span><Icon size={15} className="dl-tool__icon" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
          <div className="dl-inline-links">
            <a href="#automations">پاسخ‌های خودکار <ArrowLeft size={16} /></a>
            <a href="#publishing">انتشار و زمان‌بندی <ArrowLeft size={16} /></a>
            <a href="#insights">تحلیل پیج <ArrowLeft size={16} /></a>
          </div>
        </div>
      </section>

      <section className="dl-section dl-dark dl-detail" id="automations" data-dl-scene>
        <div className="dl-wrap dl-detail__grid">
          <div className="dl-detail__copy">
            <Label index="03">پاسخ‌های خودکار</Label>
            <h2>تعامل‌ها را<br /><em>از دست نده</em></h2>
            <p>برای کامنت‌ها، استوری‌ها، کلمات کلیدی دایرکت و تعاملات دیگر پاسخ‌های مشخص تنظیم کن؛ دایرا طبق تنظیمات تو پاسخ می‌دهد.</p>
            <ul className="dl-checks">
              <li><Check size={17} /> تنظیم پاسخ بر اساس کلمه کلیدی</li>
              <li><Check size={17} /> پاسخ‌های متنوع زیر کامنت‌ها</li>
              <li><Check size={17} /> مدیریت پاسخ‌های هر بخش به‌صورت مستقل</li>
            </ul>
          </div>
          <div className="dl-automation-visual">
            <div className="dl-connection-line" />
            <div className="dl-message dl-message--input">
              <div className="dl-message__head"><span className="dl-avatar dl-avatar--pink">س</span><span>یک کامنت جدید</span><Instagram size={18} /></div>
              <p>قیمت این محصول چنده؟</p>
              <span className="dl-message__meta"><MessageCircle size={14} /> کامنت</span>
            </div>
            <div className="dl-message dl-message--output">
              <div className="dl-message__head"><span className="dl-avatar dl-avatar--blue">D</span><span>پاسخ تنظیم‌شده در دایرا</span><CheckCircle2 size={17} /></div>
              <p>سلام! برای دریافت اطلاعات بیشتر لطفاً دایرکت رو بررسی کن 💙</p>
              <span className="dl-message__meta"><Zap size={14} /> پاسخ خودکار</span>
            </div>
            <div className="dl-automation-visual__badges"><span>کامنت</span><span>استوری</span><span>دایرکت</span><span>لایو</span></div>
          </div>
        </div>
      </section>

      <section className="dl-section dl-dark dl-detail dl-inbox-section" id="inbox" data-dl-scene>
        <div className="dl-wrap dl-detail__grid dl-detail__grid--reverse">
          <div className="dl-detail__copy">
            <Label index="04">صندوق دایرکت</Label>
            <h2>گفت‌وگوها،<br /><em>مرتب و یک‌جا</em></h2>
            <p>مکالمه‌ها را در یک محیط منظم ببین، پیام‌ها را بررسی کن و وقتی لازم است خودت ادامه گفت‌وگو را به دست بگیر.</p>
            <ul className="dl-checks">
              <li><Check size={17} /> فیلتر مکالمات خوانده‌شده و خوانده‌نشده</li>
              <li><Check size={17} /> پیام متنی، تصویر و پیام صوتی</li>
              <li><Check size={17} /> رابط سازگار با موبایل</li>
            </ul>
          </div>
          <div className="dl-app-preview dl-inbox-preview" aria-label="نمونه نمای صندوق دایرکت دایرا">
            <div className="dl-app-preview__top"><span className="dl-window-dots"><i/><i/><i/></span><span>صندوق دایرکت</span><MessageSquareText size={19}/></div>
            <div className="dl-inbox-preview__content">
              <div className="dl-inbox-preview__list">
                <span className="dl-preview-heading">گفت‌وگوها</span>
                {["سارا احمدی","فروشگاه آفتاب","مهدی","رها"].map((name, i) => (
                  <div className={"dl-conversation" + (i===0?" is-active":"")} key={name}><span className="dl-avatar">{name[0]}</span><span><b>{name}</b><small>{i===0?"سلام! موجوده؟":"آخرین پیام مکالمه"}</small></span>{i===0&&<i/>}</div>
                ))}
              </div>
              <div className="dl-inbox-preview__chat"><div className="dl-chat-top"><span className="dl-avatar">س</span><b>سارا احمدی</b><span className="dl-online-dot"/></div><div className="dl-chat-bubbles"><p>سلام، وقت بخیر! این محصول موجوده؟</p><p>سلام! خوش اومدی 🌱 بله موجوده.</p></div><div className="dl-chat-input">نوشتن پیام… <Send size={15}/></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="dl-section dl-dark dl-detail" id="publishing" data-dl-scene>
        <div className="dl-wrap dl-detail__grid">
          <div className="dl-detail__copy">
            <Label index="05">انتشار محتوا</Label>
            <h2>محتوایت را<br /><em>برای انتشار آماده کن</em></h2>
            <p>پست، ریلز، استوری و پست اسلایدی را مدیریت کن و زمان انتشار را از قبل مشخص کن.</p>
            <ul className="dl-checks">
              <li><Check size={17} /> انتشار همین حالا یا زمان‌بندی</li>
              <li><Check size={17} /> نمایش وضعیت صف انتشار</li>
              <li><Check size={17} /> مدیریت چند نوع محتوا</li>
            </ul>
          </div>
          <div className="dl-publish-scene" aria-label="نمونه نمای زمان‌بندی انتشار محتوا">
            <div className="dl-publish-post dl-publish-post--1"><div className="dl-post-art dl-post-art--1"><Play size={36} fill="white" /></div><span>ریلز</span></div>
            <div className="dl-publish-post dl-publish-post--2"><div className="dl-post-art dl-post-art--2"><Layers3 size={36}/></div><span>پست اسلایدی</span></div>
            <div className="dl-publish-post dl-publish-post--3"><div className="dl-post-art dl-post-art--3"><Instagram size={36}/></div><span>استوری</span></div>
            <div className="dl-publish-calendar"><div className="dl-publish-calendar__title"><CalendarDays size={18}/> تقویم انتشار <Clock3 size={16}/></div><div className="dl-calendar-days">{Array.from({length:21},(_,i)=><span className={i===10||i===14||i===17?"has-event":""} key={i}>{i+1}</span>)}</div><div className="dl-calendar-caption"><CheckCircle2 size={16}/> محتوای زمان‌بندی‌شده</div></div>
          </div>
        </div>
      </section>

      <section className="dl-section dl-dark dl-detail dl-insights-section" id="insights" data-dl-scene>
        <div className="dl-wrap dl-detail__grid dl-detail__grid--reverse">
          <div className="dl-detail__copy">
            <Label index="06">تحلیل پیج</Label>
            <h2>عملکرد پیجت را<br /><em>بهتر بشناس</em></h2>
            <p>روند رشد، عملکرد محتوا و شاخص‌های تعامل را در نمایی مرتب ببین و تصمیم‌های آگاهانه‌تری بگیر.</p>
            <ul className="dl-checks">
              <li><Check size={17} /> نمایش روند شاخص‌های پیج</li>
              <li><Check size={17} /> بررسی عملکرد محتوا</li>
              <li><Check size={17} /> نمودارهای خوانا و منظم</li>
            </ul>
          </div>
          <div className="dl-analytics-demo" aria-label="نمودار نمایشی تحلیل پیج؛ اطلاعات نمونه هستند">
            <div className="dl-analytics-demo__head"><span><BarChart3 size={18}/> نمای کلی عملکرد</span><small>داده نمایشی</small></div>
            <div className="dl-stat-row"><div><span>بازدید</span><b>۱۲٫۴K</b></div><div><span>تعامل</span><b>۳٫۲K</b></div><div><span>محتوا</span><b>۲۴</b></div></div>
            <svg className="dl-linechart" viewBox="0 0 460 190" role="img" aria-label="نمودار خطی نمایشی رو به رشد">
              <defs><linearGradient id="dl-graph-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4b87ff" stopOpacity=".34"/><stop offset="1" stopColor="#4b87ff" stopOpacity="0"/></linearGradient></defs>
              <path d="M10 162 L60 151 L105 136 L155 145 L200 108 L246 118 L291 84 L333 94 L378 53 L450 21 L450 189 L10 189Z" fill="url(#dl-graph-fill)"/>
              <path d="M10 162 L60 151 L105 136 L155 145 L200 108 L246 118 L291 84 L333 94 L378 53 L450 21" fill="none" stroke="#76a9ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              {[52,98,144].map(y=><path d={"M5 "+y+" H455"} key={y} stroke="#c8ddff" strokeOpacity=".12" strokeDasharray="5 8"/>)}
            </svg>
            <div className="dl-analytics-demo__foot"><span>روند عملکرد</span><span><span className="dl-legend-dot"/> مقدار نمایشی</span></div>
          </div>
        </div>
      </section>

      <section className="dl-section dl-glass-transition" id="glass" data-dl-scene>
        <div className="dl-transition-light" aria-hidden="true" />
        <div className="dl-wrap dl-glass-transition__layout">
          <div className="dl-glass-transition__core"><Core small /><div className="dl-glass-panels" aria-hidden="true"><span/><span/><span/><span/></div></div>
          <div className="dl-glass-transition__copy">
            <Label index="07">از ابزارهای پراکنده تا یک فضای منظم</Label>
            <h2>یک پنل برای<br /><em>تمام ابزارها</em></h2>
            <p>همه بخش‌ها کنار هم قرار می‌گیرند؛ همان تجربه روشن و شیشه‌ای که در داشبورد دایرا می‌بینی.</p>
          </div>
        </div>
      </section>

      <section className="dl-section dl-light dl-finale" id="workspace" data-dl-scene>
        <div className="dl-wrap dl-finale__grid">
          <div className="dl-finale__copy">
            <Label index="08">آماده شروعی؟</Label>
            <h2>دایرا، همراه<br /><em>مدیریت روزانه پیجت</em></h2>
            <p>ابزارهای مدیریت تعاملات و محتوای اینستاگرام را در یک محیط روشن، ساده و یکپارچه تجربه کن.</p>
            <ActionLinks compact />
            <span className="dl-finale__hint"><LockKeyhole size={15} /> اتصال حساب مطابق مراحل و مجوزهای اینستاگرام انجام می‌شود.</span>
          </div>
          <div className="dl-dashboard-preview" aria-label="پیش‌نمایش مفهومی داشبورد دایرا">
            <aside className="dl-dashboard-side"><span className="dl-side-logo">D</span><i/><i/><i/><i/></aside>
            <div className="dl-dashboard-main">
              <div className="dl-dashboard-top"><b>داشبورد دایرا</b><span className="dl-dash-pill">نمای نمونه</span></div>
              <div className="dl-dashboard-stats"><span><b>پاسخ‌های خودکار</b><MessageCircle size={21}/></span><span><b>صندوق دایرکت</b><MessageSquareText size={21}/></span><span><b>انتشار محتوا</b><CalendarDays size={21}/></span></div>
              <div className="dl-dashboard-panels"><div className="dl-dashboard-chart"><b>نمای کلی</b><svg viewBox="0 0 300 96" aria-hidden="true"><path d="M4 73 L52 67 L100 48 L148 61 L194 31 L247 39 L296 13" fill="none" stroke="#2f61fd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="dl-dashboard-shortcuts"><b>دسترسی به ابزارها</b><span><MessageCircle size={15}/> پاسخ به کامنت</span><span><CalendarDays size={15}/> انتشار محتوا</span><span><BarChart3 size={15}/> تحلیل پیج</span></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="dl-faq" id="questions">
        <div className="dl-wrap dl-faq__grid">
          <div><span className="dl-eyebrow dl-eyebrow--light"><CircleHelp size={17}/> سؤالات متداول</span><h2>چند سؤال قبل از شروع</h2><p>پاسخ‌های کوتاه درباره نحوه استفاده از دایرا.</p></div>
          <div className="dl-faq__items">
            <details><summary>دایرا برای چه نوع پیج‌هایی طراحی شده است؟ <ChevronDown size={19}/></summary><p>برای مدیریت حساب‌های حرفه‌ای اینستاگرام که قابلیت‌ها و مجوزهای موردنیاز Meta را داشته باشند.</p></details>
            <details><summary>آیا پاسخ‌های دایرا بر اساس هوش مصنوعی هستند؟ <ChevronDown size={19}/></summary><p>پاسخ‌های خودکار بر اساس قوانین، کلمات کلیدی و متن‌هایی که خودت تنظیم می‌کنی اجرا می‌شوند.</p></details>
            <details><summary>برای استفاده باید حساب اینستاگرام متصل کنم؟ <ChevronDown size={19}/></summary><p>بله، قابلیت‌های متصل به اینستاگرام به اتصال حساب واجد شرایط و دسترسی‌های موردنیاز وابسته‌اند.</p></details>
            <details><summary>آیا تمام قابلیت‌ها همیشه برای هر حساب فعال هستند؟ <ChevronDown size={19}/></summary><p>دسترسی به بعضی قابلیت‌ها به نوع حساب، مجوزهای تأییدشده و محدودیت‌های Meta بستگی دارد.</p></details>
          </div>
        </div>
      </section>
      <footer className="dl-footer">
        <div className="dl-wrap dl-footer__inner"><Brand light /><span>© {new Date().getFullYear()} دایرا</span><nav aria-label="پیوندهای پایین صفحه"><Link href="/privacy-policy">حریم خصوصی</Link><Link href="/data-deletion">حذف داده‌ها</Link><a href="#top">بازگشت به بالا ↑</a></nav></div>
      </footer>
    </main>
  );
}
