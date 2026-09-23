import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function ProfilePage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">پروفایل</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">پروفایل پیج</h1>
          <p className="mt-2 text-sm text-slate-500">اطلاعات عمومی و آمار پایه پیج متصل.</p>
        </header>
        <DashboardAccountsClient mode="profile" />
      </div>
    </DashboardRoute>
  );
}
