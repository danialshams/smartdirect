import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function CommentAutomationPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="comments" />
    </DashboardRoute>
  );
}
