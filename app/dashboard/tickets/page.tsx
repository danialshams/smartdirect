import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function TicketsPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">پشتیبانی</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            تیکت‌ها
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            درخواست‌های پشتیبانی و پیگیری گفتگوهای شما در این بخش مدیریت می‌شود.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">
            بخش مدیریت تیکت‌ها در مرحله بعدی تکمیل می‌شود.
          </p>
        </section>
      </div>
    </DashboardRoute>
  );
}
