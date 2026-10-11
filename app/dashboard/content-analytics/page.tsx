import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import InstagramContentAnalytics from "../../../components/dashboard/InstagramContentAnalytics";
import { DashboardPageLayout } from "../../../components/dashboard/DashboardPageLayout";

export default function ContentAnalyticsPage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout
        title="عملکرد محتوا"
        description="عملکرد پست‌ها، Reels و Carousel را جداگانه بررسی کنید."
      >
        <InstagramContentAnalytics />
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
