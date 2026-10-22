import SupportTicketDetailClient from "@/components/dashboard/SupportTicketDetailClient";

export default async function SupportRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportTicketDetailClient id={id} />;
}
