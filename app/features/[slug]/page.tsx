import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PublicInfoPage } from "@/components/landing/PublicInfoPage";
import { InstagramPreview } from "@/components/landing/InstagramPreview";
import { featureDetails, getFeatureDetail } from "@/components/landing/feature-detail-data";
import { showcaseScenes } from "@/components/landing/showcase-scenes";
import "../features.css";
import "@/app/landing-instagram.css";

type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return featureDetails.map(item=>({slug:item.id}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
  const {slug}=await params;
  const detail=getFeatureDetail(slug);
  const scene=showcaseScenes.find(item=>item.id===slug);
  return detail&&scene?{title:scene.title+" | امکانات دایرا",description:detail.description}:{title:"صفحه پیدا نشد | دایرا"};
}
export default async function FeaturePage({params}:Props){
  const {slug}=await params;
  const detail=getFeatureDetail(slug);
  const scene=showcaseScenes.find(item=>item.id===slug);
  if(!detail||!scene)notFound();
  return <PublicInfoPage eyebrow={"قابلیت "+scene.no+" از ۱۱"} title={scene.title} description={detail.description}>
    <div className="da-feature-detail">
      <div className="da-feature-detail__preview">
        <InstagramPreview kind={detail.id}/>
        <p>پیش‌نمایش شماتیک تعامل در اینستاگرام؛ داده یا اسکرین‌شات واقعی کاربران نیست.</p>
      </div>
      <div className="da-feature-detail__how">
        <div className="da-feature-detail__art"><Image src={detail.image} alt={detail.alt} width={140} height={140}/></div>
        <h2>چطور کار می‌کند؟</h2>
        <ol>{detail.steps.map(step=><li key={step}>{step}</li>)}</ol>
        <p>عملکرد هر بخش به نوع حساب، مجوزهای فعال و محدودیت‌های API متا بستگی دارد.</p>
        <Link className="da-feature-detail__cta" href="/login">شروع در دایرا <ArrowLeft size={17}/></Link>
      </div>
    </div>
    <div className="da-feature-detail__bottom"><Link href="/features">مشاهده همه امکانات <ArrowLeft size={16}/></Link></div>
  </PublicInfoPage>;
}