import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UnansweredComments from "../../../components/dashboard/comments/UnansweredComments";

export const dynamic = "force-dynamic";

export default async function UnansweredCommentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const accounts = await prisma.instagramAccount.findMany({
    where: {
      userId: session.user.id,
      isConnected: true,
    },
    select: {
      id: true,
      igUsername: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return <UnansweredComments accounts={accounts} />;
}
