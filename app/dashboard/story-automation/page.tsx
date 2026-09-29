import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function StoryAutomationPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="stories" />
    </DashboardRoute>
  );
}
