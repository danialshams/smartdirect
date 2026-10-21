import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const component = read("components/dashboard/InstagramInbox.tsx");
const inbox = read("app/api/instagram/inbox/route.ts");
const handoff = read("app/api/instagram/inbox/handoff/route.ts");

const readRoute = inbox.slice(inbox.indexOf("export async function GET("), inbox.indexOf("export async function POST("));
assert.ok(!readRoute.includes("conversationMessage.updateMany"), "Reading conversation must not mark messages read");
assert.ok(readRoute.includes("take: 51") && readRoute.includes("skip: conversationOffset"), "Thread list must be paginated");
assert.ok(readRoute.includes('searchParams.get("before")') && readRoute.includes('cursor: { id: cursor.id }'), "Older message cursor pagination missing");
assert.ok(readRoute.includes('searchParams.get("focusId")') && readRoute.includes("hasNewerMessages"), "Focused result context missing");
assert.ok(readRoute.includes('searchParams.get("messageSearch")') && readRoute.includes('text: { contains: messageSearch'), "Scoped message search missing");
assert.ok(readRoute.includes('searchParams.get("conversationSearch")') && readRoute.includes("participantUsername"), "Global conversation search missing");
assert.ok(component.includes("document.visibilityState") && component.includes("8000"), "Background polling must be bounded");
assert.ok(component.includes('selectedConversation.messagingWindow?.canSend'), "Sending must honor Instagram response window");
assert.ok(component.includes('sendStatus: "SENDING"') && component.includes('sendStatus: "FAILED"'), "Outgoing state machine missing");
assert.ok(component.includes("failedRetryRef.current.set"), "Failed sends must be retryable");
assert.ok(component.includes("setRecordedVoice(new File(") && !component.includes('aria-label="ارسال Voice"'), "Voice must offer a preview before sending");
assert.ok(component.includes("conversationSearchOpen") && component.includes("focusSearchResult"), "Message search interaction missing");
assert.ok(component.includes("persistQuickReplies") && component.includes("window.localStorage"), "Editable quick replies missing");
assert.ok(component.includes("toggleHumanMode") && handoff.includes('action === "transfer"'), "Human handoff missing");
assert.ok(component.includes("hasMoreMessages") && component.includes("loadMessages({ before: first.id })"), "Older messages must load on demand");
assert.ok(component.includes("showJumpToLatest") && component.includes("forceScrollToBottom"), "Scroll-to-latest interaction missing");
assert.ok(component.includes("data-mobile-chat-open") && component.includes(".daira-bottom-nav"), "Mobile immersive conversation missing");
console.log("INBOX_MODERN_REGRESSION_OK");
