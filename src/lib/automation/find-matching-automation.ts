import { prisma } from "@/lib/prisma";
import { AutomationTriggerType } from "@/generated/prisma/client";

type FindAutomationInput =
  | { instagramAccountId: string; triggerType: "COMMENT_KEYWORD"; keyword: string; mediaId?: string | null }
  | { instagramAccountId: string; triggerType: "DM" }
  | { instagramAccountId: string; triggerType: "STORY_REPLY_KEYWORD"; keyword: string; mediaId?: string | null };

function normalizePersianDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}
function normalizeText(value: string) { return normalizePersianDigits(value).trim().toLowerCase(); }
function splitKeywords(value: string) { return value.split(/[\n,،;؛]+/).map(normalizeText).filter(Boolean); }

export async function findMatchingAutomation(input: FindAutomationInput) {
  const automations = await prisma.automation.findMany({
    where: { instagramAccountId: input.instagramAccountId, triggerType: input.triggerType as AutomationTriggerType, isActive: true },
    include: {
      messages: {
        orderBy: { order: "asc" },
        include: {
          quickReplies: { orderBy: { createdAt: "asc" } },
          showcase: { include: { items: { where: { isActive: true }, orderBy: { order: "asc" } } } },
          form: { include: { fields: { orderBy: { order: "asc" } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (input.triggerType === "DM") return automations[0] ?? null;

  const normalizedIncoming = normalizeText(input.keyword);
  return automations.find((automation) => {
    if (!automation.keyword) return false;
    const configuredKeywords = splitKeywords(automation.keyword);
    if (!configuredKeywords.includes(normalizedIncoming)) return false;
    if (automation.mediaId && automation.mediaId !== input.mediaId) return false;
    if (automation.mediaId && !input.mediaId) return false;
    return true;
  }) ?? null;
}
