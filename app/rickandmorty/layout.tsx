import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminProviders from "@/components/admin/AdminProviders";
import "./admin.css";
import { prisma } from "@/lib/prisma";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isBlocked: true } });
  if (!admin || admin.role !== "ADMIN" || admin.isBlocked) redirect("/dashboard");

  return (
    <AdminProviders>
      <AdminShell>{children}</AdminShell>
    </AdminProviders>
  );
}
