import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { LandingGlassBackdrop } from "./LandingGlassBackdrop";
import { SimpleHeader } from "./SimpleHeader";
import "@/app/simple-home.css";
import "@/app/showcase.css";

export function PublicInfoPage({eyebrow,title,description,children}:{
  eyebrow:string;title:string;description:string;children:React.ReactNode;
}) {
  return (
    <LandingGlassBackdrop>
      <SimpleHeader />
      <main className="ap-info" dir="rtl">
        <article className="ap-info__inner">
          <Link className="ap-info__back" href="/">صفحه اصلی <ArrowUpLeft size={16} aria-hidden="true"/></Link>
          <p className="ap-info__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="ap-info__description">{description}</p>
          <div className="ap-info__body">{children}</div>
        </article>
      </main>
    </LandingGlassBackdrop>
  );
}
