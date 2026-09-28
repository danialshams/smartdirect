import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstagramProfile } from "@/lib/instagram/api";
import { getValidInstagramAccessToken } from "@/lib/instagram/token-manager";
import { proxyInstagramAccountProfileUrl } from "@/lib/instagram/media-proxy";
import DashboardRoute from "../../../components/dashboard/DashboardRoute";
import UnansweredComments from "../../../components/dashboard/comments/UnansweredComments";

export const dynamic = "force-dynamic";

export default async function UnansweredCommentsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) redirect("/login");

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
        <div dir="rtl" className="py-24 text-center">
          <p className="text-sm font-medium text-foreground">
            هیچ پیج متصلی وجود ندارد
          </p>
          <a
            href="/api/instagram/connect"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-foreground px-4 text-xs font-medium text-background"
          >
            اتصال پیج
          </a>
        </div>
      </DashboardRoute>
    );
  }

  let activeAccount = {
    ...account,
    profilePictureUrl: proxyInstagramAccountProfileUrl(account.id),
  };

  try {
    const accessToken = await getValidInstagramAccessToken(account.id);
    const profile = await getInstagramProfile(accessToken);
    activeAccount = {
      ...activeAccount,
      igUsername: profile.username ?? account.igUsername,
    };
  } catch {
    // The username stored on the connected account is a sufficient fallback.
  }

  return (
    <DashboardRoute>
      <UnansweredComments account={activeAccount} />
    </DashboardRoute>
  );
}
