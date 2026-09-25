import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function SubscriptionPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-border pb-5">
          <p className="text-xs font-medium text-muted-foreground">حساب</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">اشتراک</h1>
          <p className="mt-2 text-sm text-muted-foreground">مدیریت پلن و وضعیت اشتراک SmartDirect.</p>
        </header>
        <section className="rounded-2xl border border-border bg-background p-6 sm:p-8">
          <h2 className="text-base font-bold text-foreground">اشتراک ماهانه</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            سیستم پرداخت و پلن‌های اشتراکی در مرحله بعدی به این بخش اضافه می‌شوند.
          </p>
        </section>
      </div>
    </DashboardRoute>
  );
}
