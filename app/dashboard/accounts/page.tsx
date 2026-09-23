import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import ConnectedAccounts from "../../../components/dashboard/ConnectedAccounts";

export default function AccountsPage() {
  return (
    <DashboardRoute>
      <ConnectedAccounts />
    </DashboardRoute>
  );
}
