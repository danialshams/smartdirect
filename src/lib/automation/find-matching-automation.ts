import { prisma } from "@/lib/prisma";
import { AutomationTriggerType } from "@/generated/prisma/client";

type FindAutomationInput =
  | {
      instagramAccountId: string;
      triggerType: "COMMENT_KEYWORD";
      keyword: string;
      mediaId?: string | null;
    }
  | {
      instagramAccountId: string;
      triggerType: "DM";
    }
  | {
      instagramAccountId: string;
      triggerType: "STORY_REPLY_KEYWORD";
      keyword: string;
      mediaId?: string | null;
    };

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export async function findMatchingAutomation(
  input: FindAutomationInput
) {
  const automations = await prisma.automation.findMany({
    where: {
      instagramAccountId: input.instagramAccountId,
      triggerType:
        input.triggerType as AutomationTriggerType,
      isActive: true,
    },
    include: {
      messages: {
        orderBy: {
          order: "asc",
        },
        include: {
          quickReplies: {
            orderBy: {
              createdAt: "asc",
            },
          },
          showcase: {
            include: {
              items: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
          form: {
            include: {
              fields: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (input.triggerType === "DM") {
    return automations[0] ?? null;
  }

  const normalizedKeyword = normalizeText(input.keyword);

  const matchedAutomation = automations.find((automation) => {
    if (!automation.keyword) {
      return false;
    }

    const automationKeyword = normalizeText(automation.keyword);

    if (automationKeyword !== normalizedKeyword) {
      return false;
    }

    if (
      automation.mediaId &&
      input.mediaId &&
      automation.mediaId !== input.mediaId
    ) {
      return false;
    }

    if (automation.mediaId && !input.mediaId) {
      return false;
    }

    return true;
  });

  return matchedAutomation ?? null;
}