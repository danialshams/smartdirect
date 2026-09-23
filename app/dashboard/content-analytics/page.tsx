import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import InstagramContentAnalytics from "../../../components/dashboard/InstagramContentAnalytics";

export default function ContentAnalyticsPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">تحلیل محتوا</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            عملکرد محتوا
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            عملکرد پست‌ها، Reels و Carousel را جداگانه بررسی کنید.
          </p>
        </header>
        <InstagramContentAnalytics />
      </div>
    </DashboardRoute>
  );
}
