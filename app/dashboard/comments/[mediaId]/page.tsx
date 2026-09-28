import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstagramProfile } from "@/lib/instagram/api";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { proxyInstagramAccountProfileUrl } from "@/lib/instagram/media-proxy";
import DashboardRoute from "../../../../components/dashboard/DashboardRoute";
import UnansweredCommentsPost from "../../../../components/dashboard/comments/UnansweredCommentsPost";

export const dynamic = "force-dynamic";

export default async function UnansweredCommentsPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ mediaId: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { mediaId } = await params;
  const query = await searchParams;

  const accounts = await prisma.instagramAccount.findMany({
    where: { userId: session.user.id, isConnected: true },
    select: { id: true, igUsername: true },
    orderBy: { createdAt: "desc" },
  });

  const accountsWithProfiles = await Promise.all(
    accounts.map(async (account) => {
      try {
        const accessToken = await getValidInstagramAccessToken(account.id);
        const profile = await getInstagramProfile(accessToken);
        return {
          ...account,
          profilePictureUrl: proxyInstagramAccountProfileUrl(account.id),
          igUsername: profile.username ?? account.igUsername,
        };
      } catch {
        return { ...account, profilePictureUrl: null };
      }
    }),
  );

  const account =
    accountsWithProfiles.find((item) => item.id === query.account) ??
    accountsWithProfiles[0];

  if (!account) {
    return (
      <DashboardRoute>
        <div className="rounded-2xl border bg-background p-8 text-center text-sm text-muted-foreground">
          هیچ اکانت متصلی وجود ندارد.
        </div>
      </DashboardRoute>
    );
  }

  return (
    <DashboardRoute>
      <UnansweredCommentsPost account={account} mediaId={decodeURIComponent(mediaId)} />
    </DashboardRoute>
  );
}
