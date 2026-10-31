import type { CSSProperties } from "react";
import { Instagram } from "lucide-react";
import { showcaseScenes } from "./showcase-scenes";
import { InstagramPreview } from "./InstagramPreview";

/**
 * Each of the 11 Daira features has its own recognizable Instagram-like
 * product illustration. No copied Instagram assets, fake accounts or metrics.
 * The cards remain a responsive Bento rather than a long plain text list.
 */
const emphasized = new Set(["direct","menu","inbox","publishing"]);

export function FeatureShowcase() {
  return (
    <section id="features" className="ap-showcase ap-social-showcase" aria-labelledby="ap-features-title">
      <div className="ap-shell ap-showcase__inner">
        <div className="ap-showcase__intro" data-reveal>
          <span className="ap-showcase__eyebrow"><Instagram size={17} aria-hidden="true"/> امکانات دایرا</span>
          <h2 id="ap-features-title" data-reveal>از یک پیام ساده، تا مدیریت کل پیج</h2>
          <p data-reveal>هر قابلیت، در محیطی آشنا شبیه اینستاگرام.</p>
        </div>
        <div className="ap-social-grid">
          {showcaseScenes.map((scene,index)=>(
            <article
              key={scene.id}
              id={"feature-"+scene.id}
              className={"ap-social-card"+(emphasized.has(scene.id)?" ap-social-card--wide":"")}
              data-reveal
              style={{"--reveal-index":index%3} as CSSProperties}
              aria-labelledby={"feature-title-"+scene.id}
            >
              <div className="ap-social-card__copy">
                <span className="ap-social-card__icon" aria-hidden="true"><scene.Icon size={22} strokeWidth={1.8}/></span>
                <span className="ap-social-card__count" aria-hidden="true">{scene.no} / ۱۱</span>
                <h3 id={"feature-title-"+scene.id} data-reveal>{scene.title}</h3>
                <p data-reveal>{scene.tagline}</p>
              </div>
              <div className="ap-social-card__visual" data-reveal>
                <InstagramPreview kind={scene.id}/>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
