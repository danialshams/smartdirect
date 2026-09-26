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
  const cacheKeyValue = cacheKey("automation", input.instagramAccountId, input.triggerType);

  const automations = await getOrSetCachedJson(cacheKeyValue, () => prisma.automation.findMany({
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
  }),
  CACHE_TTL.AUTOMATION,
);

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


function findQuickReplyPayload(node: unknown, payload: string): boolean {
  if (!node || typeof node !== "object") return false;

  const value = node as { payload?: unknown; quickReplies?: unknown };

  if (value.payload === payload) return true;

  if (Array.isArray(value.quickReplies)) {
    return value.quickReplies.some((child) =>
      findQuickReplyPayload(child, payload),
    );
  }

  return false;
}

export async function findAutomationByQuickReplyPayload({
  instagramAccountId,
  payload,
}: {
  instagramAccountId: string;
  payload: string;
}) {
  if (!instagramAccountId || !payload) return null;

  const cacheKeyValue = cacheKey(
    "automation",
    instagramAccountId,
    "QUICK_REPLY_PAYLOAD",
  );

  const automations = await getOrSetCachedJson(cacheKeyValue, () =>
    prisma.automation.findMany({
      where: {
        instagramAccountId,
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
    }),
    CACHE_TTL.AUTOMATION,
  );

  return (
    automations.find((automation) =>
      automation.messages.some((message) =>
        message.quickReplies.some((quickReply) => {
          if (quickReply.payload === payload) return true;
          if (!quickReply.replyText) return false;

          try {
            return findQuickReplyPayload(
              JSON.parse(quickReply.replyText),
              payload,
            );
          } catch {
            return false;
          }
        }),
      ),
    ) ?? null
  );
}
