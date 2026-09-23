import AdvancedAnalyticsReports from "../../../components/dashboard/AdvancedAnalyticsReports";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function ReportsPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">گزارش‌ها</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">گزارش عملکرد</h1>
          <p className="mt-2 text-sm text-slate-500">مقایسه بازه‌های زمانی و دریافت خروجی گزارش.</p>
        </header>
        <AdvancedAnalyticsReports />
      </div>
    </DashboardRoute>
  );
}
