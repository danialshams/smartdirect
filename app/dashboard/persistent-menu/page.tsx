import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function PersistentMenuPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">ورودی گفتگو</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">منوی ثابت</h1>
          <p className="mt-2 text-sm text-slate-500">منوی دائمی دایرکت و مسیرهای متصل به آن.</p>
        </header>
        <DashboardAccountsClient mode="persistent-menu" />
      </div>
    </DashboardRoute>
  );
}
