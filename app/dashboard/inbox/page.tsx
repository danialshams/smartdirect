import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function InboxPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="inbox" />
    </DashboardRoute>
  );
}
