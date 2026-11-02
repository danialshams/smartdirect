import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { showcaseScenes, type ShowcaseKind } from "./showcase-scenes";
import { VeloraDashboardMockup } from "./VeloraDashboardMockup";

// Hero + exactly eight optical scenes + footer = ten captured source tiles.
// Keep individual showcase scenes as direct LandingGlassBackdrop children,
// so the existing Safari Liquid Glass engine remains untouched.
const pairs: readonly (readonly ShowcaseKind[])[] = [
  ["comment", "story"],
  ["direct", "share"],
  ["live", "reminder"],
  ["inbox", "publishing"],
  ["insights", "menu"],
  ["icebreaker"],
];
const artwork: Record<ShowcaseKind, string> = {
  comment: "/dashboard-art/comment-reply.webp",
  story: "/dashboard-art/story-reply.webp",
  direct: "/dashboard-art/direct-automation.webp",
  share: "/dashboard-art/share-mention.webp",
  live: "/dashboard-art/live-reply.webp",
  reminder: "/dashboard-art/smart-reminders.webp",
  inbox: "/dashboard-art/inbox.webp",
  publishing: "/dashboard-art/publishing.webp",
  insights: "/dashboard-art/insights.webp",
  menu: "/dashboard-art/direct-menu.webp",
  icebreaker: "/dashboard-art/icebreakers.webp",
};

function FeatureCard({ id, index }: { id: ShowcaseKind; index: number }) {
  const scene = showcaseScenes.find(item => item.id === id);
  if (!scene) throw new Error("Missing Daira showcase feature: "+id);
  return (
    <article className="ap-social-card dm-card" id={"feature-"+id}
      aria-labelledby={"feature-title-"+id}
      style={{ "--reveal-index": index } as CSSProperties}>
      <div className="ap-social-card__visual dm-card__visual">
        <div className="ig-preview dm-card__picture" aria-hidden="true">
          <Image src={artwork[id]} width={142} height={142} alt=""
            sizes="(max-width: 650px) 110px, 142px" />
        </div>
      </div>
      <div className="ap-social-card__copy dm-card__copy">
        <span className="ap-social-card__index" aria-hidden="true">{scene.no}</span>
        <h3 id={"feature-title-"+id}>{scene.title}</h3>
        <p>{scene.tagline}</p>
        <Link className="ap-social-card__more dm-card__more" href={"/features/"+id}>
          آشنایی با قابلیت <ArrowUpLeft size={16} aria-hidden="true"/>
        </Link>
      </div>
    </article>
  );
}

export function FeatureShowcase() {
  return (
    <>
      <section id="features" className="ap-showcase-capture dm-section dm-section--intro"
        aria-labelledby="ap-features-title">
        <div className="ap-shell dm-heading">
          <span className="dm-eyebrow">امکانات دایرا</span>
          <h2 id="ap-features-title" className="ap-motion-reveal-title">
            <span>همه ابزارها، در یک فضای ساده</span>
          </h2>
          <p>هر قابلیتی که نیاز داری، درست سر جای خودش.</p>
        </div>
      </section>

      {pairs.map((ids, rowIndex) => (
        <section key={ids.join("-")} className={"ap-showcase-capture dm-section dm-section--cards dm-section--row-"+rowIndex}
          aria-label={"امکانات دایرا: "+ids.map(id=>showcaseScenes.find(s=>s.id===id)?.title).join(" و ")}>
          <div className="ap-shell ap-social-grid dm-card-grid">
            {ids.map((id, index)=><FeatureCard id={id} index={index} key={id}/>)}
          </div>
        </section>
      ))}

      <section className="ap-showcase-capture dm-section dm-section--product"
        aria-labelledby="dm-product-title">
        <div className="ap-shell dm-product">
          <div className="dm-product__intro">
            <span className="dm-eyebrow">دایرا در یک نگاه</span>
            <h2 id="dm-product-title">مدیریت پیج، بدون شلوغی</h2>
            <p>ابزارهای پاسخ خودکار، گفتگوها و انتشار محتوا، در یک داشبورد.</p>
            <Link href="/features" className="dm-product__link">
              مشاهده همه امکانات <ArrowUpLeft size={16} aria-hidden="true"/>
            </Link>
          </div>
          <div className="dm-product__view">
            <VeloraDashboardMockup />
            <span>نمای شماتیک از بخش‌های داشبورد دایرا</span>
          </div>
        </div>
      </section>
    </>
  );
}
