import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function PersistentMenuPage() {
  return (
    <DashboardRoute>
      <DashboardAccountsClient mode="persistent-menu" />
    </DashboardRoute>
  );
}
