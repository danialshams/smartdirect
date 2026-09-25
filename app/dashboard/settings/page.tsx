import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function SettingsPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-border pb-5">
          <p className="text-xs font-medium text-muted-foreground">حساب</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">تنظیمات</h1>
          <p className="mt-2 text-sm text-muted-foreground">تنظیمات حساب و ترجیحات SmartDirect.</p>
        </header>
        <section className="rounded-2xl border border-border bg-background p-6 sm:p-8">
          <h2 className="text-base font-bold text-foreground">تنظیمات حساب</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            گزینه‌های تنظیمات حساب در این بخش قرار می‌گیرند.
          </p>
        </section>
      </div>
    </DashboardRoute>
  );
}
