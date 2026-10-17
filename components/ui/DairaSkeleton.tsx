import type { CSSProperties } from "react";

type DairaSkeletonVariant = "dashboard" | "page" | "section";

type DairaSkeletonProps = {
  variant?: DairaSkeletonVariant;
  label?: string;
};

function SkeletonBar({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`daira-skeleton__bar ${className}`} style={style} />;
}

/** Shared loading placeholder. Reuse this in route loading.tsx files and async sections. */
export default function DairaSkeleton({
  variant = "page",
  label = "در حال بارگذاری...",
}: DairaSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <main className="daira-skeleton daira-skeleton--dashboard" dir="rtl" aria-label={label} role="status">
        <span className="daira-skeleton__sr-only">{label}</span>
        <header className="daira-skeleton__dashboard-header">
          <SkeletonBar className="daira-skeleton__icon" />
          <div className="daira-skeleton__brand">
            <SkeletonBar className="daira-skeleton__brand-mark" />
            <div><SkeletonBar className="daira-skeleton__line daira-skeleton__brand-title" /><SkeletonBar className="daira-skeleton__line daira-skeleton__brand-caption" /></div>
          </div>
        </header>
        <section className="daira-skeleton__dashboard-grid" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <article className="daira-skeleton__dashboard-card" key={index}>
              <SkeletonBar className="daira-skeleton__illustration" />
              <div className="daira-skeleton__card-copy">
                <SkeletonBar className="daira-skeleton__line daira-skeleton__card-title" />
                <SkeletonBar className="daira-skeleton__line daira-skeleton__card-description" />
                <SkeletonBar className="daira-skeleton__line daira-skeleton__card-description daira-skeleton__card-description--short" />
              </div>
            </article>
          ))}
        </section>
        <nav className="daira-skeleton__bottom-nav" aria-hidden="true">
          <SkeletonBar className="daira-skeleton__nav-item" />
          <SkeletonBar className="daira-skeleton__nav-item daira-skeleton__nav-item--active" />
          <SkeletonBar className="daira-skeleton__nav-item" />
        </nav>
      </main>
    );
  }

  if (variant === "section") {
    return (
      <div className="daira-skeleton daira-skeleton--section" role="status" aria-label={label}>
        <span className="daira-skeleton__sr-only">{label}</span>
        <SkeletonBar className="daira-skeleton__line daira-skeleton__section-title" />
        <SkeletonBar className="daira-skeleton__line daira-skeleton__section-line" />
        <SkeletonBar className="daira-skeleton__line daira-skeleton__section-line daira-skeleton__section-line--short" />
      </div>
    );
  }

  return (
    <main className="daira-skeleton daira-skeleton--page" dir="rtl" role="status" aria-label={label}>
      <span className="daira-skeleton__sr-only">{label}</span>
      <SkeletonBar className="daira-skeleton__line daira-skeleton__page-title" />
      <SkeletonBar className="daira-skeleton__line daira-skeleton__page-subtitle" />
      <div className="daira-skeleton__page-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <section className="daira-skeleton__page-card" key={index}>
            <SkeletonBar className="daira-skeleton__line daira-skeleton__page-card-title" />
            <SkeletonBar className="daira-skeleton__line daira-skeleton__section-line" />
            <SkeletonBar className="daira-skeleton__line daira-skeleton__section-line daira-skeleton__section-line--short" />
          </section>
        ))}
      </div>
    </main>
  );
}
