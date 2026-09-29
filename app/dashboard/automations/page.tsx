import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function AutomationsPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="automations" />
    </DashboardRoute>
  );
}
