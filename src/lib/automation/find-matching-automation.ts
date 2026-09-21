import { prisma } from "@/lib/prisma";
import { cacheKey, getOrSetCachedJson } from "@/lib/cache/redis-cache";
import { CACHE_TTL } from "@/lib/cache/instagram";
import { AutomationTriggerType } from "@/generated/prisma/client";
import {
  matchesAutomationTrigger,
  normalizeAutomationText,
} from "./trigger";

type FindAutomationInput =
  | {
      instagramAccountId: string;
      triggerType: "COMMENT_KEYWORD";
      keyword: string;
      mediaId?: string | null;
    }
  | { instagramAccountId: string; triggerType: "DM" }
  | {
      instagramAccountId: string;
      triggerType: "STORY_REPLY_KEYWORD";
      keyword: string;
      mediaId?: string | null;
    };

export async function findMatchingAutomation(input: FindAutomationInput) {
  const cacheKeyValue = cacheKey("automation", input.instagramAccountId, input.triggerType);\n\n  const automations = await getOrSetCachedJson(cacheKeyValue, () => prisma.automation.findMany({
    where: {
      instagramAccountId: input.instagramAccountId,
      triggerType: input.triggerType as AutomationTriggerType,
      isActive: true,
    },
    include: {
      messages: {
        orderBy: { order: "asc" },
        include: {
          quickReplies: { orderBy: { createdAt: "asc" } },
          showcase: {
            include: {
              items: {
                where: { isActive: true },
                orderBy: { order: "asc" },
              },
            },
          },
          form: {
            include: {
              fields: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  ), CACHE_TTL.AUTOMATION);

  if (input.triggerType === "DM") {
    return automations[0] ?? null;
  }

  const normalizedIncoming = normalizeAutomationText(input.keyword);

  return (
    automations.find((automation) =>
      matchesAutomationTrigger({
        triggerType: input.triggerType,
        configuredKeyword: automation.keyword,
        incomingKeyword: normalizedIncoming,
        automationMediaId: automation.mediaId,
        incomingMediaId: input.mediaId,
      }),
    ) ?? null
  );
}
