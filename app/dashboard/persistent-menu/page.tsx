import DashboardPersistentMenuClient from "../../../components/dashboard/DashboardPersistentMenuClient";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";

export default function PersistentMenuPage() {
  return (
    <DashboardRoute>
      <div dir="rtl" className="mx-auto w-full max-w-[1400px]">
        <DashboardPersistentMenuClient />
      </div>
    </DashboardRoute>
  );
}
