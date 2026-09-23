import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import PublishingWithTags from "../../../components/dashboard/publishing/PublishingWithTags";

export const dynamic = "force-dynamic";

export default function PublishingPage() {
  return (
    <DashboardRoute>
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-xs font-medium text-slate-400">انتشار</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            انتشار محتوا
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            انتشار و زمان‌بندی محتوای Instagram.
          </p>
        </header>
        <PublishingWithTags />
      </div>
    </DashboardRoute>
  );
}
