import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readPublicCommentReplies, storePublicCommentReplies, pickPublicCommentReply, validatePublicCommentReplies } from "../src/lib/automation/comment-reply-variants";

const options = ["سپاس از نظرتان", "از همراهی شما ممنونیم", "ممنون از پیام شما"];
const encoded = storePublicCommentReplies(options);
assert.deepEqual(readPublicCommentReplies(encoded), options);
assert.deepEqual(readPublicCommentReplies("پاسخ قدیمی"), ["پاسخ قدیمی"]);
assert.deepEqual(readPublicCommentReplies(null), []);
assert.equal(readPublicCommentReplies("__DAIRA_PUBLIC_COMMENT_VARIANTS_V1__:broken").length, 0);
for (let i=0;i<300;i++) assert(options.includes(pickPublicCommentReply(encoded)!), "Random reply must come from configured options");
assert.throws(() => validatePublicCommentReplies(["a", "b"]));
assert.throws(() => validatePublicCommentReplies(["a","b","c","d","e","f"]));
assert.throws(() => validatePublicCommentReplies(["a", "", "c"]));
assert.throws(() => validatePublicCommentReplies(["same", "same", "c"]));
assert.throws(() => validatePublicCommentReplies(["کفش جدید", "كفش جديد", "پاسخ متفاوت"]));
assert.throws(() => validatePublicCommentReplies(["می روم", "می‌روم", "پاسخ دیگری"]));
assert.throws(() => validatePublicCommentReplies(["  سلام  دنیا ", "سلام دنیا", "درود"]));
assert.throws(() => validatePublicCommentReplies(["a","b","c".repeat(2001)]));
assert.equal(validatePublicCommentReplies(["a","b","c","d","e"]).length, 5);
const flow = readFileSync("components/dashboard/AutomationCreationFlow.tsx", "utf8");
assert(flow.includes("CommentReplyVariantsField") && flow.includes("commentReplyVariants: validatePublicCommentReplies(commentReplies)"));
assert(flow.includes("readPublicCommentReplies(item.commentReplyText).length > 0") &&
  flow.includes("item.sendDm !== false && normalizeMessages(item.messages).length > 0") &&
  flow.includes('item.mediaId !== "__smartdirect_live_comments_v1__"') &&
  flow.includes("setAutomationTemplates(existingAutomations.filter(") &&
  flow.includes("setLoadingResources(false);"),
  "Previous comment rules with one historical comment reply or a usable DM must remain selectable without relaxing new-rule 3-reply validation");
assert(flow.includes("Promise.allSettled([") &&
  flow.includes("const automationResult = await readAccountAutomations(account.id)") &&
  flow.includes("triggerType === \"STORY_REPLY_KEYWORD\"") &&
  flow.includes("controller.abort()"),
  "Previous-response readiness must not wait for showcase/form/saved-response reads");
const create=readFileSync("components/dashboard/CommentAutomationCreateConfigure.tsx","utf8");
assert(create.includes("useDashboardAccountSelection()") &&
  !create.includes('fetch("/api/instagram/accounts"') &&
  create.includes("mediaValidation?.key !== validationKey") &&
  create.includes("controller.abort()"),
  "Comment editor must reuse layout-verified accounts, but retain account-scoped deep-link media verification");
const landing=readFileSync("components/dashboard/CommentAutomationLanding.tsx","utf8");
assert(landing.includes('<Link') &&
  landing.includes('href="/dashboard/comment-automation/new"') &&
  !landing.includes("router.push("),
  "Comment-create navigation must be prefetched by Next Link rather than imperatively pushed");
const editor = readFileSync("components/dashboard/MediaAutomationEditor.tsx","utf8");
assert(editor.includes("CommentReplyVariantsField") && editor.includes("commentReplyVariants: validatePublicCommentReplies(commentReplies)"));
const webhook=readFileSync("app/api/webhooks/instagram/route.ts","utf8");
assert(webhook.includes("selectedPublicCommentReply = pickPublicCommentReply") && webhook.includes("replyText: selectedPublicCommentReply!") && webhook.includes("selectedPublicCommentReply ??"));
const api=readFileSync("app/api/automations/route.ts","utf8");
assert(api.includes("storePublicCommentReplies(commentReplyVariants)"));
const editApi=readFileSync("app/api/automations/[id]/comment-edit/route.ts","utf8");
assert(editApi.includes("storePublicCommentReplies(body.commentReplyVariants)"));
const tickets = readFileSync("components/dashboard/SupportTicketsClient.tsx", "utf8");
assert(tickets.includes('<span>درخواست جدید</span><Plus'));
const supportNew=readFileSync("components/dashboard/SupportTicketNewClient.tsx", "utf8");
assert(supportNew.includes('انتخاب تصویر <ImagePlus') && supportNew.includes('"ثبت درخواست"}<Send'));
console.log("COMMENT_REPLY_VARIANTS_AND_SUPPORT_RTL_OK");
