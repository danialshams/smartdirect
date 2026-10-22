import DashboardHomeSkeleton from "@/components/dashboard/DashboardHomeSkeleton";

export default function DashboardLoading() {
  return (
    <div className="daira-app-shell" dir="rtl" role="status" aria-busy="true" aria-label="در حال بارگذاری داشبورد">
      <div className="daira-header-backdrop" aria-hidden="true" />
      <div className="daira-home__header daira-home__loading-header" aria-hidden="true">
        <span className="daira-home__skeleton-block daira-home__skeleton-header-icon" />
        <span className="daira-home__skeleton-block daira-home__skeleton-logo" />
        <span className="daira-home__skeleton-block daira-home__skeleton-header-icon" />
      </div>
      <main className="daira-app-main daira-app-main--home">
        <div className="daira-app-content">
          <DashboardHomeSkeleton />
        </div>
      </main>
      <div className="daira-bottom-nav-backdrop" aria-hidden="true" />
      <div className="daira-bottom-nav daira-home__loading-nav" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span className="daira-home__skeleton-nav-item" key={index}>
            <span className="daira-home__skeleton-block daira-home__skeleton-nav-icon" />
            <span className="daira-home__skeleton-block daira-home__skeleton-nav-label" />
          </span>
        ))}
      </div>
    </div>
  );
}
