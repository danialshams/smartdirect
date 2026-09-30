import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function PersistentMenuPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px]">
        <DashboardAccountsClient mode="persistent-menu" />
      </div>
    </DashboardRoute>
  );
}
