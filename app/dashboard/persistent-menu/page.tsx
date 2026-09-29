import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function PersistentMenuPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px] space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            منوی دایرکت
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            منوی ثابت دایرکت را تنظیم کنید و برای هر گزینه Flow پاسخ اختصاصی بسازید.
          </p>
        </header>
        <DashboardAccountsClient mode="persistent-menu" />
      </div>
    </DashboardRoute>
  );
}
