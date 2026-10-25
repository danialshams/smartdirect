import {
  AUTOMATION_TRIGGER_TYPES,
  isSupportedAutomationTriggerType,
  matchesAutomationKeyword,
  matchesAutomationTrigger,
  normalizeAutomationText,
  splitAutomationKeywords,
} from "../src/lib/automation/trigger";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  // 95 — Architecture / trigger model
  assert(
    AUTOMATION_TRIGGER_TYPES.length === 5,
    "Expected exactly 5 supported automation trigger types.",
  );
  assert(
    AUTOMATION_TRIGGER_TYPES.includes("COMMENT_KEYWORD"),
    "COMMENT_KEYWORD trigger is missing.",
  );
  assert(
    AUTOMATION_TRIGGER_TYPES.includes("DM"),
    "DM trigger is missing.",
  );
  assert(
    AUTOMATION_TRIGGER_TYPES.includes("STORY_REPLY_KEYWORD"),
    "STORY_REPLY_KEYWORD trigger is missing.",
  );

  assert(AUTOMATION_TRIGGER_TYPES.includes("DM_MEDIA_SHARE"), "DM_MEDIA_SHARE trigger is missing.");
  assert(AUTOMATION_TRIGGER_TYPES.includes("STORY_MENTION"), "STORY_MENTION trigger is missing.");

  // 96 — Trigger resolution primitives
  assert(
    isSupportedAutomationTriggerType("COMMENT_KEYWORD"),
    "COMMENT_KEYWORD should resolve as supported.",
  );
  assert(
    isSupportedAutomationTriggerType("DM"),
    "DM should resolve as supported.",
  );
  assert(
    !isSupportedAutomationTriggerType("UNKNOWN"),
    "Unknown trigger must be rejected.",
  );

  // 97 — Keyword matching
  assert(
    normalizeAutomationText("  ۱Hello  ") === "1hello",
    "Persian digit normalization failed.",
  );
  assert(
    normalizeAutomationText("  ١Hello  ") === "1hello",
    "Arabic digit normalization failed.",
  );

  const keywords = splitAutomationKeywords("1, ۲، hello; world");
  assert(
    JSON.stringify(keywords) === JSON.stringify(["1", "2", "hello", "world"]),
    "Keyword splitting failed.",
  );

  assert(
    matchesAutomationKeyword("1, hello", " ۱ "),
    "Equivalent Persian-digit keyword should match.",
  );
  assert(
    !matchesAutomationKeyword("1, hello", "2"),
    "Non-configured keyword should not match.",
  );

  assert(
    matchesAutomationKeyword("قیمت, خرید", "لطفاً قیمت را بگو", "CONTAINS_ANY"),
    "Contains-any mode should match a configured keyword inside a comment.",
  );
  assert(
    !matchesAutomationKeyword("قیمت, خرید", "سلام وقت بخیر", "CONTAINS_ANY"),
    "Contains-any mode must reject comments without configured keywords.",
  );

  assert(
    matchesAutomationKeyword(null, "سلام، قیمت چنده؟", "CONTAINS_ANY"),
    "Contains-any mode without configured keywords should match any non-empty comment.",
  );
  assert(
    !matchesAutomationKeyword(null, "   ", "CONTAINS_ANY"),
    "Contains-any mode should reject empty comments.",
  );

  assert(
    !matchesAutomationTrigger({
      triggerType: "COMMENT_KEYWORD",
      configuredKeyword: "قیمت", incomingKeyword: "قیمت",
      automationMediaId: null, configuredMediaIds: null, incomingMediaId: "post-345",
    }),
    "Detaching every media must never turn a comment response into a global reply.",
  );
  assert(
    matchesAutomationTrigger({
      triggerType: "COMMENT_KEYWORD",
      configuredKeyword: "1, hello",
      incomingKeyword: "۱",
    }),
    "Comment keyword trigger should match.",
  );

  assert(
    matchesAutomationTrigger({
      triggerType: "STORY_REPLY_KEYWORD",
      configuredKeyword: "1",
      incomingKeyword: "1",
      automationMediaId: "story-1",
      incomingMediaId: "story-1",
    }),
    "Story keyword trigger should match the configured story.",
  );

  assert(
    matchesAutomationTrigger({
      triggerType: "STORY_REPLY_KEYWORD",
      configuredKeyword: "1",
      incomingKeyword: "1",
      automationMediaId: "story-1",
      incomingMediaId: "story-2",
    }),
    "Story keyword automations must work across all stories on the account.",
  );
  assert(
    !matchesAutomationTrigger({
      triggerType: "STORY_REPLY_KEYWORD",
      configuredKeyword: "قیمت",
      incomingKeyword: "قیمت",
      automationMediaId: "pending:scheduled-story-1",
      incomingMediaId: "story-123",
    }),
    "A scheduled story rule must remain dormant until publishing binds its media ID.",
  );

  assert(
    matchesAutomationTrigger({
      triggerType: "COMMENT_KEYWORD",
      configuredKeyword: "قیمت",
      incomingKeyword: "لطفاً قیمت را بگو",
      keywordMatchMode: "CONTAINS_ANY",
      configuredMediaIds: "media-1,media-2",
      incomingMediaId: "media-2",
    }),
    "Contains-any mode should match one of the selected media IDs.",
  );
  assert(
    !matchesAutomationTrigger({
      triggerType: "COMMENT_KEYWORD",
      configuredKeyword: "قیمت",
      incomingKeyword: "لطفاً قیمت را بگو",
      keywordMatchMode: "CONTAINS_ANY",
      configuredMediaIds: "media-1,media-2",
      incomingMediaId: "media-3",
    }),
    "Multi-media targeting must reject unselected media.",
  );
  assert(
    matchesAutomationTrigger({
      triggerType: "COMMENT_KEYWORD",
      configuredKeyword: "قیمت",
      incomingKeyword: "لطفاً قیمت را بگو",
      keywordMatchMode: "CONTAINS_ANY",
    }),
    "An automation without a media restriction should match all media.",
  );

  assert(
    matchesAutomationTrigger({
      triggerType: "DM",
    }),
    "DM trigger should resolve without a keyword.",
  );

  console.log("95-97 Automation trigger foundation: OK");
  console.log(
    JSON.stringify(
      {
        success: true,
        architecture: "central-trigger-model",
        supportedTriggers: AUTOMATION_TRIGGER_TYPES,
        keywordNormalization: "persian-arabic-digits",
        mediaScopedTriggers: ["COMMENT_KEYWORD"],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("95-97 Automation trigger foundation: FAILED");
  throw error;
});

const fs = await import("node:fs");
const storyApi = fs.readFileSync("app/api/automations/route.ts", "utf8");
const storyEdit = fs.readFileSync("app/api/automations/[id]/story-edit/route.ts", "utf8");
const storyActivation = fs.readFileSync("src/lib/automation/story-activation.ts", "utf8");
const storyPublishing = fs.readFileSync("src/lib/instagram/publishing.ts", "utf8");
const storyCreation = fs.readFileSync("components/dashboard/AutomationCreationFlow.tsx", "utf8");
const storyCard = fs.readFileSync("components/dashboard/AutoRepliesManager.tsx", "utf8");
const storyMigration = fs.readFileSync("prisma/migrations/20261025155000_single_active_story_reply/migration.sql", "utf8");
assert(storyApi.includes('triggerType === "STORY_REPLY_KEYWORD" ? false : Boolean(isActive)'),
  "New story rules must be disabled until full response save.");
assert(storyActivation.includes('FOR UPDATE') && storyActivation.includes('isActive: false') &&
  storyActivation.includes('isActive: true') && storyActivation.includes('tx.$queryRawUnsafe'),
  "Activation of a new story reply must serialize sibling deactivation per account.");
assert(storyCreation.includes("setStoryReplacement(") && storyCreation.includes("confirmedStoryReplacement") &&
  storyCreation.includes("تأیید و ایجاد") && storyCreation.includes('body: JSON.stringify({ isActive: true })'),
  "New story response must ask before replacing active keywords and activate only when fully saved.");
assert(storyPublishing.includes('await activateStoryReply(job.storyReplyAutomationId, job.instagramAccountId)') &&
  storyPublishing.includes('await activateStoryReply(automation.id, instagramAccountId)'),
  "Publishing and legacy story automation paths must keep the single-active invariant.");
assert(!storyEdit.includes('const siblings = await prisma.automation.findMany'),
  "Inactive story reply keyword reuse must remain available.");
assert(storyMigration.includes('ROW_NUMBER() OVER') && storyMigration.includes('ranked.ord > 1'),
  "Existing accounts must retain a single active story reply.");
assert(storyCard.includes('absolute left-3 top-3') && storyCard.includes('dateTime={item.date || undefined}'),
  "Reply cards must show their dates in the upper-left.");
