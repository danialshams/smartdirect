import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function IceBreakerPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px] space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            سؤال‌های شروع گفتگو
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            سؤال‌های شروع گفتگو را تنظیم کنید و برای هرکدام Flow پاسخ اختصاصی بسازید.
          </p>
        </header>
        <DashboardAccountsClient mode="ice-breaker" />
      </div>
    </DashboardRoute>
  );
}
