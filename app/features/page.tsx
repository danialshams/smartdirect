import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
import { featureDetails } from "@/components/landing/feature-detail-data";
import { showcaseScenes } from "@/components/landing/showcase-scenes";
import "./features.css";

export const metadata: Metadata = {title:"امکانات دایرا | ابزارهای مدیریت اینستاگرام",description:"آشنایی با ۱۱ قابلیت دایرا؛ پاسخ خودکار، صندوق دایرکت، انتشار محتوا و تحلیل پیج."};

export default function FeaturesPage(){
  return <PublicInfoPage eyebrow="امکانات دایرا" title="برای هر کاری، ابزار مناسب" description="قابلیت‌های دایرا را یک‌جا ببین و عملکرد هر کدام را جداگانه بشناس.">
    <div className="da-feature-grid">
      {featureDetails.map(detail=>{
        const scene=showcaseScenes.find(s=>s.id===detail.id)!;
        return <Link href={"/features/"+detail.id} key={detail.id} className="da-feature-tile">
          <div className="da-feature-tile__image"><Image src={detail.image} alt={detail.alt} width={132} height={132} sizes="(max-width:700px) 100px,132px"/></div>
          <span className="da-feature-tile__no">{scene.no} / ۱۱</span>
          <h2>{scene.title}</h2>
          <p>{scene.tagline}</p>
          <span className="da-feature-tile__more">مشاهده جزئیات <ArrowLeft size={16}/></span>
        </Link>;
      })}
    </div>
    <p className="da-feature-caption">تصاویر، نمادهای اختصاصی بخش‌های دایرا هستند؛ تصاویر نمایشی به جای اطلاعات واقعی کاربران استفاده شده‌اند.</p>
  </PublicInfoPage>;
}