import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import PublishingWithTags from "../../../components/dashboard/publishing/PublishingWithTags";

export const dynamic = "force-dynamic";

export default function PublishingPage() {
  return (
    <DashboardRoute>
      <PublishingWithTags />
    </DashboardRoute>
  );
}
