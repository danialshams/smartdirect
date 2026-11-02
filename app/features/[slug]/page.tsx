import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpLeft, MoveLeft } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
import { featureDetails, getFeatureDetail } from "@/components/landing/feature-detail-data";
import { productGuides } from "@/components/landing/feature-ui-guides";
import { DashboardGuidePanel } from "@/components/landing/DashboardGuidePanel";
import { showcaseScenes } from "@/components/landing/showcase-scenes";
import "../features.css";

type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return featureDetails.map(item=>({slug:item.id}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const detail=getFeatureDetail(slug);
  const scene=showcaseScenes.find(item=>item.id===slug);
  return detail&&scene?{title:scene.title+" | راهنمای تصویری دایرا",description:detail.description}:{title:"صفحه پیدا نشد | دایرا"};
}
export default async function FeaturePage({params}:Props){
  const {slug}=await params;
  const detail=getFeatureDetail(slug);
  const scene=showcaseScenes.find(item=>item.id===slug);
  if(!detail||!scene)notFound();
  const guide=productGuides[detail.id];
  return <PublicInfoPage eyebrow={guide.group+" · قابلیت "+scene.no+" از ۱۱"} title={scene.title} description={guide.outcome}>
    <div className="da-feature-detail">
      <div className="da-feature-head">
        <span className="da-feature-head__tag">راهنمای ۳ مرحله‌ای</span>
        <p>براساس کنترل‌ها و مراحل بخش مربوطه در داشبورد دایرا</p>
      </div>
      <div className="da-feature-flow">
        {guide.steps.map((step,index)=><section className="da-feature-step" key={step.heading}>
          <div className="da-feature-step__text">
            <span className="da-feature-step__number">STEP ۰{index+1} / ۰۳</span>
            <h2>{step.heading}</h2>
            <p>{step.explanation}</p>
          </div>
          <div className="da-feature-step__screen"><DashboardGuidePanel step={step}/></div>
        </section>)}
      </div>
      <p className="da-feature-note">تصاویر مراحل، بازسازی رابط کاربری همین بخش از داشبورد دایرا هستند و اسکرین‌شات حساب واقعی نیستند. اجرای قابلیت‌ها تابع مجوزها و محدودیت‌های متا است.</p>
      <nav className="da-feature-next" aria-label="مسیر ادامه">
        <Link href="/features"><MoveLeft size={17} aria-hidden="true"/> مشاهده سایر امکانات</Link>
        <Link href="/login">شروع استفاده در دایرا <ArrowUpLeft size={17} aria-hidden="true"/></Link>
      </nav>
    </div>
  </PublicInfoPage>;
}
