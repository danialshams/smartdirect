import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PublishingJobEditor, {
  type PublishingJobInitialData,
} from "@/components/dashboard/publishing/PublishingJobEditor";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export default async function PublishingJobPage({ params }: Context) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    notFound();
  }

  const { id } = await params;

  const job = await prisma.instagramPublishJob.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      media: {
        orderBy: { sortOrder: "asc" },
      },
      instagramAccount: {
        select: {
          id: true,
          igUsername: true,
        },
      },
    },
  });

  if (
    !job ||
    (job.status === "PUBLISHED" &&
      job.type === "STORY" &&
      (!job.publishedAt ||
        Date.now() - job.publishedAt.getTime() >= 24 * 60 * 60 * 1000))
  ) {
    notFound();
  }

  const initialJob: PublishingJobInitialData = {
    id: job.id,
    type: job.type as PublishingJobInitialData["type"],
    status: job.status,
    caption: job.caption,
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    publishedAt: job.publishedAt?.toISOString() ?? null,
    media: job.media.map((item) => ({
      id: item.id,
      type: item.type as "IMAGE" | "VIDEO",
      publicUrl: item.publicUrl,
      fileName: item.fileName,
    })),
    commentAutomationId: job.commentAutomationId,
    storyReplyAutomationId: job.storyReplyAutomationId,
    instagramAccount: {
      id: job.instagramAccount.id,
      igUsername: job.instagramAccount.igUsername,
    },
  };

  return <PublishingJobEditor initialJob={initialJob} />;
}
