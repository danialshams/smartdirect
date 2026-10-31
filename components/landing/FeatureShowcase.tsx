import { ArrowUpLeft, CalendarClock, Check, MessageCircle, Send } from "lucide-react";
import { showcaseScenes } from "./showcase-scenes";

const responseFeatures = showcaseScenes.filter(item => !["inbox", "publishing", "insights"].includes(item.id));

/**
 * Four scannable feature groups, with truthful static product previews.
 * The eight response-related tools are individually named, so all 11
 * dashboard capabilities remain discoverable without a long editorial list.
 */
export function FeatureShowcase() {
  return (
    <section id="features" className="ap-showcase" aria-labelledby="ap-features-title">
      <div className="ap-shell ap-showcase__inner">
        <div className="ap-showcase__intro" data-reveal>
          <span className="ap-showcase__eyebrow">امکانات دایرا</span>
          <h2 id="ap-features-title">همه ابزارها، در یک نگاه</h2>
          <p>از اولین تعامل تا انتشار محتوا و بررسی نتیجه.</p>
        </div>
        <div className="ap-bento">
          <article className="ap-bento__card ap-bento__card--responses" data-reveal aria-labelledby="feature-responses">
            <div className="ap-bento__heading">
              <span className="ap-bento__icon"><MessageCircle size={22} aria-hidden="true"/></span>
              <div>
                <h3 id="feature-responses">پاسخ‌گویی خودکار</h3>
                <p>برای تعامل‌های مختلف پیج، پاسخ دلخواهت را تنظیم کن.</p>
              </div>
            </div>
            <div className="ap-bento__response-preview" aria-label="نمونه نمایشی از پاسخ به کامنت">
              <div className="ap-bento__bubble ap-bento__bubble--incoming"><span className="ap-bento__bubble-dot"/>کامنت جدید <strong>«قیمت چنده؟»</strong></div>
              <div className="ap-bento__bubble ap-bento__bubble--outgoing"><Check size={15} aria-hidden="true"/> پاسخ تنظیم‌شده ارسال می‌شود</div>
            </div>
            <div className="ap-bento__chips" aria-label="انواع پاسخ‌گویی در دایرا">
              {responseFeatures.map(item => (
                <span className="ap-bento__chip" key={item.id} id={"feature-"+item.id}>
                  <item.Icon size={15} strokeWidth={1.8} aria-hidden="true"/>
                  <span>{item.title}</span>
                </span>
              ))}
            </div>
          </article>

          <article className="ap-bento__card ap-bento__card--inbox" id="feature-inbox" data-reveal aria-labelledby="feature-inbox-title">
            <div className="ap-bento__heading">
              <span className="ap-bento__icon"><Send size={22} aria-hidden="true"/></span>
              <div><h3 id="feature-inbox-title">صندوق دایرکت</h3><p>گفتگوها را یک‌جا دنبال کن.</p></div>
            </div>
            <div className="ap-bento__inbox-preview" aria-label="نمایش نمونه صندوق پیام">
              <div className="ap-bento__inbox-row"><span className="ap-bento__avatar">۱</span><div><strong>پیام جدید</strong><small>سلام، موجوده؟</small></div><span className="ap-bento__unread"/></div>
              <div className="ap-bento__inbox-row"><span className="ap-bento__avatar">۲</span><div><strong>گفتگوی اخیر</strong><small>ممنون از راهنمایی شما</small></div><Check size={16} aria-hidden="true"/></div>
              <div className="ap-bento__inbox-row"><span className="ap-bento__avatar">۳</span><div><strong>پاسخ به مشتری</strong><small>سفارش چطور ثبت می‌شه؟</small></div><span className="ap-bento__unread"/></div>
            </div>
          </article>

          <article className="ap-bento__card ap-bento__card--publishing" id="feature-publishing" data-reveal aria-labelledby="feature-publishing-title">
            <div className="ap-bento__heading">
              <span className="ap-bento__icon"><CalendarClock size={22} aria-hidden="true"/></span>
              <div><h3 id="feature-publishing-title">انتشار محتوا</h3><p>پست، ریلز، پست اسلایدی و استوری را زمان‌بندی کن.</p></div>
            </div>
            <div className="ap-bento__publish-preview" aria-label="پیش‌نمایش نمایشی زمان‌بندی انتشار">
              <div className="ap-bento__publish-image"><span>DAIRA</span><span className="ap-bento__publish-orb"/></div>
              <div className="ap-bento__publish-details">
                <span className="ap-bento__publish-tag">انتشار زمان‌بندی‌شده</span>
                <strong>محتوای بعدی</strong>
                <div className="ap-bento__publish-progress"><span/></div>
                <span className="ap-bento__publish-status"><Check size={15} aria-hidden="true"/> آماده انتشار</span>
              </div>
            </div>
          </article>

          <article className="ap-bento__card ap-bento__card--insights" id="feature-insights" data-reveal aria-labelledby="feature-insights-title">
            <div className="ap-bento__heading">
              <span className="ap-bento__icon"><span aria-hidden="true">↗</span></span>
              <div><h3 id="feature-insights-title">تحلیل پیج</h3><p>روند عملکرد و تعامل مخاطبان را واضح‌تر ببین.</p></div>
            </div>
            <div className="ap-bento__insights-preview">
              <div className="ap-bento__insights-label"><span>نمایش نمونه روند تعامل</span><ArrowUpLeft size={17} aria-hidden="true"/></div>
              <svg viewBox="0 0 520 170" preserveAspectRatio="none" role="img" aria-label="نمودار نمایشی رو به رشد، بدون داده واقعی">
                <defs><linearGradient id="ap-bento-chart" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6195ff" stopOpacity=".25"/><stop offset="1" stopColor="#6195ff" stopOpacity="0"/></linearGradient></defs>
                <path d="M0 150 C60 138 65 93 118 116 S181 144 225 92 S297 99 334 69 S406 95 447 43 S485 43 520 18 L520 170 L0 170Z" fill="url(#ap-bento-chart)"/>
                <path d="M0 150 C60 138 65 93 118 116 S181 144 225 92 S297 99 334 69 S406 95 447 43 S485 43 520 18" fill="none" stroke="#2f61fd" strokeWidth="4" strokeLinecap="round"/>
                <circle cx="447" cy="43" r="7" fill="#2f61fd" stroke="white" strokeWidth="4"/>
              </svg>
              <div className="ap-bento__insights-foot"><span>تعاملات</span><span>بازدید محتوا</span><span>روند رشد</span></div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
