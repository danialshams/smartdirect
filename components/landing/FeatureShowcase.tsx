import type { CSSProperties } from "react";
import { Camera } from "lucide-react";
import { showcaseScenes, type ShowcaseKind } from "./showcase-scenes";
import { InstagramPreview } from "./InstagramPreview";

/**
 * Each row is a direct LiquidGlassScene child. A single 11-card wrapper is
 * several screens tall; capturing that whole wrapper delayed iOS backdrop
 * updates and occasionally skipped newly revealed content behind the header.
 *
 * Independent clipped rows bound captures to roughly one screen each.
 */
const rows: readonly (readonly ShowcaseKind[])[] = [
  ["comment", "story"],
  ["direct"],
  ["share", "live"],
  ["reminder", "icebreaker"],
  ["inbox"],
  ["publishing"],
  ["insights"],
  ["menu"],
];

export function FeatureShowcase() {
  return (
    <>
      {rows.map((ids, rowIndex) => {
        const scenes = ids.map(id => {
          const scene = showcaseScenes.find(item => item.id === id);
          if (!scene) throw new Error("Missing landing feature: " + id);
          return scene;
        });
        return (
          <section
            key={ids.join("-")}
            id={rowIndex === 0 ? "features" : undefined}
            className={"ap-showcase ap-showcase-capture" +
              (rowIndex === 0 ? " ap-showcase-capture--first" : "") +
              (rowIndex === rows.length - 1 ? " ap-showcase-capture--last" : "") +
              (rowIndex % 2 ? " ap-showcase-capture--alternate" : "")}
            aria-labelledby={rowIndex === 0 ? "ap-features-title" : undefined}
            aria-label={rowIndex === 0 ? undefined : scenes.map(scene => scene.title).join(" و ")}
          >
            <div className="ap-shell ap-showcase__inner">
              {rowIndex === 0 && (
                <div className="ap-showcase__intro" data-reveal>
                  <span className="ap-showcase__eyebrow"><Camera size={17} aria-hidden="true"/> امکانات دایرا</span>
                  <h2 id="ap-features-title" data-reveal>از یک پیام ساده، تا مدیریت کل پیج</h2>
                  <p data-reveal>هر قابلیت، در محیطی آشنا شبیه اینستاگرام.</p>
                </div>
              )}
              <div className="ap-social-grid">
                {scenes.map((scene, index) => (
                  <article
                    key={scene.id}
                    id={"feature-" + scene.id}
                    className={"ap-social-card" + (scenes.length === 1 ? " ap-social-card--wide" : "")}
                    data-reveal
                    style={{ "--reveal-index": index } as CSSProperties}
                    aria-labelledby={"feature-title-" + scene.id}
                  >
                    <div className="ap-social-card__copy">
                      <span className="ap-social-card__icon" aria-hidden="true"><scene.Icon size={22} strokeWidth={1.8}/></span>
                      <span className="ap-social-card__count" aria-hidden="true">{scene.no} / ۱۱</span>
                      <h3 id={"feature-title-" + scene.id} data-reveal>{scene.title}</h3>
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
      })}
    </>
  );
}
