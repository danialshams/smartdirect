type SkeletonCardProps = { kind: "quick" | "tool"; index: number; featured?: boolean };

function SkeletonCard({ kind, index, featured = false }: SkeletonCardProps) {
  const rootClass = kind === "quick"
    ? "daira-home__quick-card" + (featured ? " daira-home__quick-card--inbox" : index === 1 ? " daira-home__quick-card--publishing" : "") + (index < 2 ? " daira-home__quick-card--status" : "")
    : "daira-home__tool-card";

  return (
    <div className={rootClass + " daira-home__skeleton-card"} aria-hidden="true" key={index}>
      <span className={kind === "quick" ? "daira-home__quick-art" : "daira-home__tool-art"}>
        <span className="daira-home__skeleton-block daira-home__skeleton-art" />
      </span>
      <span className={kind === "quick" ? "daira-home__quick-copy" : "daira-home__tool-copy"}>
        <span className="daira-home__skeleton-block daira-home__skeleton-title" />
        <span className="daira-home__skeleton-block daira-home__skeleton-description" />
      </span>
      {kind === "quick" && index < 2 ? <span className="daira-home__skeleton-block daira-home__status-skeleton" /> : null}
    </div>
  );
}

function SkeletonHeading({ title, withStatus = false }: { title: string; withStatus?: boolean }) {
  return (
    <div className={"daira-home__section-heading" + (withStatus ? " daira-home__section-heading--automation" : "")}>
      <span className="daira-home__section-icon" aria-hidden="true">
        <span className="daira-home__skeleton-block daira-home__skeleton-heading-icon" />
      </span>
      <span className="daira-home__section-title">
        <h2>{title}</h2>
      </span>
      {withStatus ? <span className="daira-home__skeleton-block daira-home__automation-count-skeleton" aria-hidden="true" /> : null}
    </div>
  );
}

export default function DashboardHomeSkeleton() {
  return (
    <div className="daira-home" dir="rtl" role="status" aria-busy="true" aria-label="در حال بارگذاری صفحه اصلی داشبورد">
      <span className="sr-only">در حال بارگذاری صفحه اصلی داشبورد</span>
      <div className="daira-home__account-bar" aria-hidden="true">
        <div className="daira-home__account-panel daira-home__account-panel--skeleton">
          <span className="daira-home__account-avatar"><span className="daira-home__skeleton-block daira-home__skeleton-avatar" /></span>
          <span className="daira-home__account-details">
            <span className="daira-home__skeleton-block daira-home__skeleton-account-label" />
            <span className="daira-home__skeleton-block daira-home__skeleton-account-name" />
          </span>
          <span className="daira-home__skeleton-block daira-home__skeleton-account-status" />
        </div>
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
