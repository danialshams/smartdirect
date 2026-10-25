import DashboardIceBreakerClient from "../../../components/dashboard/DashboardIceBreakerClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function IceBreakerPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px]">
        <DashboardIceBreakerClient />
      </div>
    </DashboardRoute>
  );
}
