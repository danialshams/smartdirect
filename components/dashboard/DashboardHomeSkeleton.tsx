type SkeletonCardProps = { kind: "quick" | "tool"; index: number; featured?: boolean };

function SkeletonCard({ kind, index, featured = false }: SkeletonCardProps) {
  const rootClass = kind === "quick"
    ? "daira-home__quick-card" + (featured ? " daira-home__quick-card--inbox" : "")
    : "daira-home__tool-card";

  return (
    <div className={rootClass + " daira-home__skeleton-card"} aria-hidden="true" key={index}>
      <span className={kind === "quick" ? "daira-home__quick-art" : "daira-home__tool-art"}>
        <span className="daira-home__skeleton-block daira-home__skeleton-art" />
      </span>
      <span className={kind === "quick" ? "daira-home__quick-copy" : "daira-home__tool-copy"}>
        <span className="daira-home__skeleton-block daira-home__skeleton-title" />
        <span className="daira-home__skeleton-block daira-home__skeleton-description" />
        {kind === "quick" && index < 2 ? <span className="daira-home__skeleton-block daira-home__status-skeleton" /> : null}
      </span>
    </div>
  );
}

function SkeletonHeading({ title, withStatus = false }: { title: string; withStatus?: boolean }) {
  return (
    <div className="daira-home__section-heading">
      <span className="daira-home__section-icon" aria-hidden="true">
        <span className="daira-home__skeleton-block daira-home__skeleton-heading-icon" />
      </span>
      <h2>{title}</h2>
      <span className="daira-home__section-rule" aria-hidden="true" />
      {withStatus ? <span className="daira-home__skeleton-block daira-home__automation-count-skeleton" aria-hidden="true" /> : null}
    </div>
  );
}

export default function DashboardHomeSkeleton() {
  return (
    <div className="daira-home" dir="rtl" role="status" aria-busy="true" aria-label="در حال بارگذاری صفحه اصلی داشبورد">
      <span className="sr-only">در حال بارگذاری صفحه اصلی داشبورد</span>
      <div className="daira-home__account-bar" aria-hidden="true">
        <span className="daira-home__skeleton-block daira-home__skeleton-account" />
      </div>

      <section className="daira-home__section">
        <SkeletonHeading title="پاسخ‌های هوشمند" withStatus />
        <div className="daira-home__tool-grid daira-home__tool-grid--automation">
          {Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} kind="tool" index={index} />)}
        </div>
      </section>

      <section className="daira-home__section">
        <SkeletonHeading title="دسترسی سریع" />
        <div className="daira-home__quick-grid">
          {Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} kind="quick" index={index} featured={index === 0} />)}
        </div>
      </section>

      <section className="daira-home__section">
        <SkeletonHeading title="ابزارهای تکمیلی" />
        <div className="daira-home__tool-grid daira-home__tool-grid--extra">
          {Array.from({ length: 3 }, (_, index) => <SkeletonCard key={index} kind="tool" index={index} />)}
        </div>
      </section>
    </div>
  );
}
