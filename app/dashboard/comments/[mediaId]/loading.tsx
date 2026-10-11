import { DashboardLoading } from "@/components/dashboard/DashboardUI";

export default function Loading() {
  return (
    <DashboardLoading
      label="در حال دریافت کامنت‌های این پست..."
      className="dashboard-loading--page"
    />
  );
}
