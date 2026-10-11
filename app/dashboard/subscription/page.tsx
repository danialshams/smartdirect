import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout, DashboardPageSection } from "../../../components/dashboard/DashboardPageLayout";

export default function SubscriptionPage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout title="اشتراک" description="مدیریت پلن و وضعیت اشتراک SmartDirect.">
        <DashboardPageSection title="اشتراک ماهانه">
          <p className="text-sm leading-7 text-muted-foreground">
            سیستم پرداخت و پلن‌های اشتراکی در مرحله بعدی به این بخش اضافه می‌شوند.
          </p>
        </DashboardPageSection>
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
