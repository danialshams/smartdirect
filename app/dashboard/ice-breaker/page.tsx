import DashboardAccountsClient from "../../../components/dashboard/DashboardAccountsClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function IceBreakerPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px]">
        <DashboardAccountsClient mode="ice-breaker" />
      </div>
    </DashboardRoute>
  );
}
