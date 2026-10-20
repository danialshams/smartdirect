import type { Prisma } from "@/generated/prisma/client";
import type { LiveRuleInput } from "./live-rule";
import { liveAnswerType, toStoredLiveOption } from "./live-rule";

export async function replaceLiveReplyMessage(tx: Prisma.TransactionClient, automationId: string, rule: LiveRuleInput) {
  // Cancel unsent follow-ups before replacing their content to prevent an
  // in-flight viewer reply from getting a different answer than promised.
  await tx.liveCommentReply.updateMany({
    where: { automationId, status: "WAIT_REPLY" },
    data: { status: "CANCELLED" },
  });
  await tx.automationMessage.deleteMany({ where: { automationId } });
  if (rule.mode !== "FOLLOWUP" || !rule.answer) return;
  const m = rule.answer;
  await tx.automationMessage.create({
    data: {
      automationId, order: 0, messageType: liveAnswerType(m.messageType),
      text: m.text || null,
      mediaUrl: ["IMAGE","VIDEO","AUDIO"].includes(m.messageType) ? m.mediaUrl || null : null,
      mediaId: ["IMAGE","VIDEO","AUDIO"].includes(m.messageType) ? m.mediaId || null : null,
      showcaseId: m.messageType === "SHOWCASE" ? m.showcaseId || null : null,
      formId: m.messageType === "FORM" ? m.formId || null : null,
      quickReplies: m.quickReplies.length ? { create: m.quickReplies.map(toStoredLiveOption) } : undefined,
    },
  });
}
