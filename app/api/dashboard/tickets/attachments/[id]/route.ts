import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id }, select: { bytes: true, mimeType: true, fileName: true, message: { select: { ticket: { select: { userId: true } } } } },
  });
  if (!attachment) return new Response("Not found", { status: 404 });
  if (attachment.message.ticket.userId !== session.user.id) {
    const admin = await requireAdmin();
    if (admin.response) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(attachment.bytes), {
    headers: { "Content-Type": attachment.mimeType, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}