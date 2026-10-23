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
    !matchesAutomationTrigger({
      triggerType: "STORY_REPLY_KEYWORD",
      configuredKeyword: "1",
      incomingKeyword: "1",
      automationMediaId: "story-1",
      incomingMediaId: "story-2",
    }),
    "Story keyword trigger must reject a different story.",
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
        mediaScopedTriggers: ["COMMENT_KEYWORD", "STORY_REPLY_KEYWORD"],
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
