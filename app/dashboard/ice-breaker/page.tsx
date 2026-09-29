import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function IceBreakerPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="ice-breaker" />
    </DashboardRoute>
  );
}
