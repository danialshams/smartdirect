import { AutomationTriggerType } from "@/generated/prisma/client";

export const AUTOMATION_TRIGGER_TYPES = [
  "COMMENT_KEYWORD",
  "DM",
  "STORY_REPLY_KEYWORD",
] as const;

export type SupportedAutomationTriggerType =
  (typeof AUTOMATION_TRIGGER_TYPES)[number];

export function isSupportedAutomationTriggerType(
  value: string,
): value is SupportedAutomationTriggerType {
  return (AUTOMATION_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function normalizeAutomationText(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim()
    .toLowerCase();
}

export function splitAutomationKeywords(value: string): string[] {
  return value
    .split(/[\n,،;؛]+/)
    .map(normalizeAutomationText)
    .filter(Boolean);
}

export function matchesAutomationKeyword(
  configuredKeyword: string | null | undefined,
  incomingKeyword: string,
): boolean {
  if (!configuredKeyword) {
    return false;
  }

  const normalizedIncoming = normalizeAutomationText(incomingKeyword);

  return splitAutomationKeywords(configuredKeyword).includes(
    normalizedIncoming,
  );
}

export function matchesAutomationTrigger({
  triggerType,
  configuredKeyword,
  incomingKeyword,
  automationMediaId,
  incomingMediaId,
}: {
  triggerType: SupportedAutomationTriggerType;
  configuredKeyword?: string | null;
  incomingKeyword?: string | null;
  automationMediaId?: string | null;
  incomingMediaId?: string | null;
}): boolean {
  if (triggerType === "DM") {
    return true;
  }

  if (!incomingKeyword || !matchesAutomationKeyword(configuredKeyword, incomingKeyword)) {
    return false;
  }

  if (automationMediaId && automationMediaId !== incomingMediaId) {
    return false;
  }

  if (automationMediaId && !incomingMediaId) {
    return false;
  }

  return true;
}

// Keep the Prisma enum reference in this module so trigger values remain
// aligned with the generated schema at compile time.
export const PRISMA_AUTOMATION_TRIGGER_TYPES: readonly AutomationTriggerType[] =
  [
    AutomationTriggerType.COMMENT_KEYWORD,
    AutomationTriggerType.DM,
    AutomationTriggerType.STORY_REPLY_KEYWORD,
  ];
