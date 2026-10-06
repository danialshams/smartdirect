import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import AutoRepliesManager from "../../../components/dashboard/AutoRepliesManager";

export const dynamic = "force-dynamic";

export default function AutoRepliesPage() {
  return (
    <DashboardRoute>
      <AutoRepliesManager />
    </DashboardRoute>
  );
}
