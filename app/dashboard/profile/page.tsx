import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import { DashboardPageLayout } from "../../../components/dashboard/DashboardPageLayout";

export default function ProfilePage() {
  return (
    <DashboardRoute>
      <DashboardPageLayout title="پروفایل پیج" description="اطلاعات عمومی و آمار پایه پیج متصل.">
        <DashboardAccountsClient mode="profile" />
      </DashboardPageLayout>
    </DashboardRoute>
  );
}
