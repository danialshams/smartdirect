import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardShell from "../../components/dashboard/DahboardShell";


type DashboardPageProps = {
  searchParams: Promise<{
    instagram?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,

      instagramAccounts: {
        select: {
          id: true,
          igUsername: true,
          igUserId: true,
          isConnected: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const instagramStatus = params.instagram ?? null;

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      }}
      instagramAccounts={user.instagramAccounts}
      instagramStatus={instagramStatus}
    />
  );
}