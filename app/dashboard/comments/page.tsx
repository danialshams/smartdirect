import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstagramProfile } from "@/lib/instagram/api";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { proxyInstagramAccountProfileUrl } from "@/lib/instagram/media-proxy";
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
        return {
          ...account,
          profilePictureUrl: null,
        };
      }
    }),
  );

  return <UnansweredComments accounts={accountsWithProfiles} />;
}
