import { prisma } from "@/lib/prisma";

export async function writeAdminAudit(input: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as never,
    },
  });
}
