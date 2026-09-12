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

export async function findMatchingAutomation(input: FindAutomationInput) {
  console.log("========================================");
  console.log("FIND MATCHING AUTOMATION");
  console.log("========================================");

  console.log("Input:");
  console.log({
    instagramAccountId: input.instagramAccountId,
    triggerType: input.triggerType,
    keyword: "keyword" in input ? input.keyword : undefined,
    mediaId: "mediaId" in input ? input.mediaId : undefined,
  });

  const automations = await prisma.automation.findMany({
    where: {
      instagramAccountId: input.instagramAccountId,
      triggerType: input.triggerType as AutomationTriggerType,
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

  console.log("Active automations found:", automations.length);

  if (automations.length > 0) {
    console.log("Automation summary:");

    automations.forEach((automation) => {
      console.log({
        id: automation.id,
        triggerType: automation.triggerType,
        keyword: automation.keyword,
        mediaId: automation.mediaId,
        isActive: automation.isActive,
      });
    });
  }

  if (input.triggerType === "DM") {
    const result = automations[0] ?? null;

    console.log(
      "DM automation result:",
      result
        ? {
            id: result.id,
          }
        : null,
    );

    return result;
  }

  const normalizedKeyword = normalizeText(input.keyword);

  console.log("Normalized incoming keyword:", normalizedKeyword);

  const matchedAutomation = automations.find((automation) => {
    console.log("----------------------------------------");
    console.log("Checking automation:", automation.id);

    console.log("Automation values:", {
      id: automation.id,
      triggerType: automation.triggerType,
      keyword: automation.keyword,
      mediaId: automation.mediaId,
      isActive: automation.isActive,
    });

    // ----------------------------------------
    // KEYWORD CHECK
    // ----------------------------------------

    if (!automation.keyword) {
      console.log("❌ REJECTED: Automation has no keyword");

      return false;
    }

    const automationKeyword = normalizeText(automation.keyword);

    console.log("Keyword comparison:", {
      automationKeyword,
      incomingKeyword: normalizedKeyword,
      equal: automationKeyword === normalizedKeyword,
    });

    if (automationKeyword !== normalizedKeyword) {
      console.log("❌ REJECTED: Keyword does not match");

      return false;
    }

    // ----------------------------------------
    // STORY ID / MEDIA ID CHECK
    // ----------------------------------------

    if (automation.mediaId) {
      console.log("Media ID comparison:", {
        automationMediaId: automation.mediaId,
        incomingMediaId: input.mediaId,
        equal: automation.mediaId === input.mediaId,
      });

      if (!input.mediaId) {
        console.log(
          "❌ REJECTED: Automation requires mediaId but incoming event has none",
        );

        return false;
      }

      if (automation.mediaId !== input.mediaId) {
        console.log("❌ REJECTED: Story ID does not match");

        return false;
      }
    } else {
      console.log("ℹ️ Automation has no mediaId - matches any Story");
    }

    // ----------------------------------------
    // MATCH
    // ----------------------------------------

    console.log("✅ AUTOMATION MATCHED:", automation.id);

    return true;
  });

  if (matchedAutomation) {
    console.log("========================================");
    console.log("✅ MATCHED STORY REPLY AUTOMATION");
    console.log({
      id: matchedAutomation.id,
      triggerType: matchedAutomation.triggerType,
      keyword: matchedAutomation.keyword,
      mediaId: matchedAutomation.mediaId,
      isActive: matchedAutomation.isActive,
    });
    console.log("========================================");
  } else {
    console.log("========================================");
    console.log("❌ NO MATCHING AUTOMATION FOUND");
    console.log("========================================");
  }

  return matchedAutomation ?? null;
}
