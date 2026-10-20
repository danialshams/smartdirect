import DashboardRoute from "@/components/dashboard/DashboardRoute";
import LiveAutomationEditor from "@/components/dashboard/LiveAutomationEditor";
export default async function EditLiveAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardRoute><LiveAutomationEditor id={id} /></DashboardRoute>;
}
