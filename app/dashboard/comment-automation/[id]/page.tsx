import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import CommentAutomationEditor from "../../../../components/dashboard/CommentAutomationEditor";

export default async function CommentAutomationEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mediaId?: string | string[] }>;
}) {
  const { id } = await params;
  const { mediaId } = await searchParams;
  const selectedMediaId = typeof mediaId === "string" ? mediaId : undefined;

  return (
    <DashboardRoute>
      <CommentAutomationEditor id={id} mediaId={selectedMediaId} />
    </DashboardRoute>
  );
}
