import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proxyInstagramAccountProfileUrl } from "@/lib/instagram/media-proxy";
import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import UnansweredCommentsPost from "../../../../components/dashboard/comments/UnansweredCommentsPost";

export const dynamic = "force-dynamic";

export default async function UnansweredCommentsPostPage({
  params,
}: {
  params: Promise<{ mediaId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { mediaId } = await params;

  const account = await prisma.instagramAccount.findFirst({
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

  if (!account) {
    return (
      <DashboardRoute>
        <div dir="rtl" className="py-24 text-center text-sm text-muted-foreground">
          هیچ پیج متصلی وجود ندارد.
        </div>
      </DashboardRoute>
    );
  }

  const activeAccount = {
    ...account,
    profilePictureUrl: proxyInstagramAccountProfileUrl(account.id),
  };

  return (
    <DashboardRoute>
      <UnansweredCommentsPost
        account={activeAccount}
        mediaId={decodeURIComponent(mediaId)}
      />
    </DashboardRoute>
  );
}
