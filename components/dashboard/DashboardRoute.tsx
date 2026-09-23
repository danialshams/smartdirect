import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import DashboardShell from "./DahboardShell";

export default async function DashboardRoute({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

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

  return (
    <DashboardShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      }}
      instagramAccounts={user.instagramAccounts}
      instagramStatus={null}
    >
      {children}
    </DashboardShell>
  );
}
