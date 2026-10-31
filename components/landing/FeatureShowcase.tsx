import { showcaseScenes } from "./showcase-scenes";

/**
 * An editorial introduction to the eleven real dashboard tools.
 * Deliberately static: no canvas, videos, scroll timelines, fake UI, or
 * background animations. The full text is readable before hydration.
 */
export function FeatureShowcase() {
  return (
    <section id="features" className="ap-showcase" aria-labelledby="ap-features-title">
      <div className="ap-shell ap-showcase__inner">
        <div className="ap-showcase__intro">
          <span className="ap-showcase__eyebrow">امکانات دایرا</span>
          <h2 id="ap-features-title">همه‌چیز، در یک جا.</h2>
          <p>ابزارهایی که مدیریت پیج را ساده‌تر می‌کنند.</p>
        </div>
        <div className="ap-showcase__list">
          {showcaseScenes.map((item)=>(
            <article
              id={"feature-"+item.id}
              className="ap-feature"
              aria-labelledby={"feature-title-"+item.id}
              key={item.id}
            >
              <span className="ap-feature__number" aria-hidden="true">{item.no}</span>
              <span className="ap-feature__symbol" aria-hidden="true"><item.Icon size={25} strokeWidth={1.65}/></span>
              <div className="ap-feature__body">
                <h3 id={"feature-title-"+item.id}>{item.title}</h3>
                <p>{item.tagline}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
