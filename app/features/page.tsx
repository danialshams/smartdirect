import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
import { featureDetails } from "@/components/landing/feature-detail-data";
import { productGuides } from "@/components/landing/feature-ui-guides";
import { showcaseScenes } from "@/components/landing/showcase-scenes";
import "./features.css";

export const metadata: Metadata = {
  title:"امکانات دایرا | راهنمای تصویری همه ابزارها",
  description:"۱۱ ابزار دایرا را با جریان کار و راهنمای گام‌به‌گام مربوط به داشبورد بشناس."
};

export default function FeaturesPage(){
  return <PublicInfoPage eyebrow="راهنمای تصویری · یازده ابزار" title="برای هر تعامل، یک ابزار دقیق" description="از اولین کامنت تا آخرین پیام دایرکت؛ هر قابلیت را با مسیر انجام کار در داشبورد و مراحل تنظیم آن بشناس.">
    <div className="da-feature-grid">
      {featureDetails.map(detail=>{
        const scene=showcaseScenes.find(item=>item.id===detail.id)!;
        const guide=productGuides[detail.id];
        return <Link href={"/features/"+detail.id} key={detail.id} className="da-feature-tile">
          <div className="da-feature-tile__image">
            <Image src={detail.image} alt={detail.alt} width={300} height={300} sizes="(max-width:620px) 160px, (max-width:850px) 180px, 280px"/>
          </div>
          <div className="da-feature-tile__content">
            <span className="da-feature-tile__no">{scene.no} / ۱۱</span>
            <span className="da-feature-tile__category">{guide.group}</span>
            <h2>{scene.title}</h2>
            <p>{guide.outcome}</p>
            <span className="da-feature-tile__hint">راهنمای تصویری در ۳ گام</span>
            <span className="da-feature-tile__more">دیدن مراحل کار <ArrowUpLeft size={17} aria-hidden="true"/></span>
          </div>
        </Link>;
      })}
    </div>
    <p className="da-feature-caption">تصاویر نمادین و پیش‌نمایش‌های مراحل، بازسازی رابط دایرا هستند؛ اطلاعات خصوصی یا اسکرین‌شات واقعی حساب کاربران نمایش داده نمی‌شود.</p>
  </PublicInfoPage>;
}
