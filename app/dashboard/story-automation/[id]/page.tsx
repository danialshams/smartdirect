import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import StoryAutomationEdit from "../../../../components/dashboard/StoryAutomationEdit";

export default async function StoryAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <DashboardRoute>
      <StoryAutomationEdit id={id} />
    </DashboardRoute>
  );
}
