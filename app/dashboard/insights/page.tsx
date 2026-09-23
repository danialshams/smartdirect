import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import InstagramInsights from "../../../components/dashboard/InstagramInsights";

export default function InsightsPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">تحلیل پیج</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            تحلیل عملکرد
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            آمار و روند عملکرد پیج را در بازه‌های مختلف بررسی کنید.
          </p>
        </header>
        <InstagramInsights />
      </div>
    </DashboardRoute>
  );
}
