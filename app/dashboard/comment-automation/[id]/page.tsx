import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import CommentAutomationEditor from "../../../../components/dashboard/CommentAutomationEditor";

export default async function CommentAutomationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <DashboardRoute>
      <CommentAutomationEditor id={id} />
    </DashboardRoute>
  );
}
