import StorageUsagePanel from "../../../components/dashboard/StorageUsagePanel";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout, DashboardPageSection } from "../../../components/dashboard/DashboardPageLayout";

export default function SettingsPage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout title="تنظیمات" description="تنظیمات حساب و ترجیحات SmartDirect.">
        <DashboardPageSection title="تنظیمات حساب">
          <p className="text-sm leading-7 text-muted-foreground">
            گزینه‌های تنظیمات حساب در این بخش قرار می‌گیرند.
          </p>
        </DashboardPageSection>
        <StorageUsagePanel />
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
