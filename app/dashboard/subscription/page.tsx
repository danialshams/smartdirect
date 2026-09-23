import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function SubscriptionPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">حساب</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">اشتراک</h1>
          <p className="mt-2 text-sm text-slate-500">مدیریت پلن و وضعیت اشتراک SmartDirect.</p>
        </header>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-base font-bold text-slate-950">اشتراک ماهانه</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            سیستم پرداخت و پلن‌های اشتراکی در مرحله بعدی به این بخش اضافه می‌شوند.
          </p>
        </section>
      </div>
    </DashboardRoute>
  );
}
