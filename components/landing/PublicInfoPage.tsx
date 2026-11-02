import { LandingGlassBackdrop } from "./LandingGlassBackdrop";
import { SimpleHeader } from "./SimpleHeader";
import "@/app/simple-home.css";
import "@/app/showcase.css";
import "@/app/public-redesign.css";

export function PublicInfoPage({eyebrow,title,description,children}:{ 
  eyebrow:string;title:string;description:string;children:React.ReactNode;
}) {
  return (
    <LandingGlassBackdrop>
      <SimpleHeader />
      <main className="ap-info" dir="rtl">
        <article className="ap-info__inner">
          <header className="ap-info__hero">
            <span className="ap-info__eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="ap-info__description">{description}</p>
          </header>
          <div className="ap-info__body">{children}</div>
        </article>
      </main>
    </LandingGlassBackdrop>
  );
}
