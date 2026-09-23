import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function AutomationsPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">اتوماسیون</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">اتوماسیون‌ها</h1>
          <p className="mt-2 text-sm text-slate-500">قوانین پاسخ‌گویی خودکار پیج را مدیریت کنید.</p>
        </header>
        <DashboardAccountsClient mode="automations" />
      </div>
    </DashboardRoute>
  );
}
