import DashboardRoute from "@/components/dashboard/DashboardRoute";
import SmartReminderEditor from "@/components/dashboard/SmartReminderEditor";

export default async function SmartReminderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardRoute><SmartReminderEditor id={id} /></DashboardRoute>;
}
