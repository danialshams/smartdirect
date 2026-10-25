import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const component = read("components/dashboard/InstagramInbox.tsx");
const inbox = read("app/api/instagram/inbox/route.ts");

const readRoute = inbox.slice(inbox.indexOf("export async function GET("), inbox.indexOf("export async function POST("));

const sendRoute = inbox.slice(inbox.indexOf("export async function POST("));
const ownerCheck = sendRoute.indexOf("const conversation = await prisma.conversation.findFirst");
const unreadCheck = sendRoute.indexOf("const unreadInbound = await prisma.conversationMessage.findFirst");
const accessTokenCheck = sendRoute.indexOf("const accessToken = await getValidInstagramAccessToken(account.id)");
const metaReceipt = sendRoute.indexOf('sender_action: "mark_seen"');
assert.ok(ownerCheck >= 0 && unreadCheck > ownerCheck && accessTokenCheck > unreadCheck &&
  metaReceipt > accessTokenCheck &&
  sendRoute.includes('if (action === "mark_seen") {') &&
  sendRoute.includes("readAt: null,") &&
  sendRoute.includes("if (!unreadInbound) {") &&
  sendRoute.includes("markedSeen: true") &&
  sendRoute.includes('const lastInbound = action === "mark_seen"') &&
  sendRoute.includes('direction: "INBOUND",\n            readAt: null,'),
  "Already read conversations must skip redundant Meta mark_seen after tenant authorization while unread receipts still reach Meta.");

assert.ok(!readRoute.includes("conversationMessage.updateMany"), "Reading conversation must not mark messages read");
assert.ok(readRoute.includes("const needsMediaRefresh = messagesPage.some(") &&
  readRoute.includes('["IMAGE", "VIDEO", "AUDIO", "STICKER"].includes(message.messageType)') &&
  readRoute.includes("Boolean(message.igMessageId) && !message.mediaUrl") &&
  readRoute.includes("needsMediaRefresh ? getValidInstagramAccessToken(account.id) : Promise.resolve(null)") &&
  readRoute.includes("const [accessToken, lastInbound, handoff] = await Promise.all([") &&
  readRoute.includes("getHandoffState(conversation.id)") &&
  readRoute.includes(": messagesPage;"),
  "Opening a text-only Inbox conversation must skip Meta token retrieval and parallelize independent reads.");

assert.ok(readRoute.includes("take: 51") && readRoute.includes("skip: conversationOffset"), "Thread list must be paginated");
assert.ok(readRoute.includes('searchParams.get("before")') && readRoute.includes('cursor: { id: cursor.id }'), "Older message cursor pagination missing");
assert.ok(readRoute.includes('searchParams.get("focusId")') && readRoute.includes("hasNewerMessages"), "Focused result context missing");
assert.ok(readRoute.includes('searchParams.get("messageSearch")') && readRoute.includes('text: { contains: messageSearch'), "Scoped message search missing");
assert.ok(readRoute.includes('searchParams.get("conversationSearch")') && readRoute.includes("participantUsername"), "Global conversation search missing");
assert.ok(component.includes("const messageFetchControllerRef = useRef<AbortController | null>(null)") &&
  component.includes("messageFetchControllerRef.current?.abort()") &&
  component.includes("messageFetchControllerRef.current = controller") &&
  component.includes("if (messageFetchControllerRef.current === controller)") &&
  component.includes("requestId === messageFetchIdRef.current && !controller.signal.aborted") &&
  component.includes("messageFetchControllerRef.current?.abort();\n    pendingMessageFetchRef.current = null;"),
  "Switching chat or leaving Inbox must cancel stale message reads without making them display errors");
assert.ok(component.includes("document.visibilityState") && component.includes("8000"), "Background polling must be bounded");
assert.ok(component.includes('setSearchResults(response.ok ? result.conversations || [] : [])') &&
  component.includes('setConversationMatches(response.ok ? result.matches || [] : [])') &&
  (component.match(/cache: "no-store", signal: controller.signal/g) || []).length >= 2 &&
  (component.match(/controller.abort\(\); window.clearTimeout\(/g) || []).length === 2,
  "Both inbox search fields must debounce, cancel stale network reads and keep private no-store access");
assert.ok(component.includes("pendingConversationListRef.current === accountId") &&
  component.includes("conversationListControllerRef.current?.abort()") &&
  component.includes("conversationListControllerRef.current === controller") &&
  component.includes("signal: controller.signal,") &&
  component.includes("if (!controller.signal.aborted && requestId === conversationFetchIdRef.current)"),
  "Repeated inbox polling must coalesce requests; account switches must abort stale responses without blanking current data");
assert.ok(component.includes('selectedConversation.messagingWindow?.canSend'), "Sending must honor Instagram response window");
assert.ok(component.includes('sendStatus: "SENDING"') && component.includes('sendStatus: "FAILED"'), "Outgoing state machine missing");
assert.ok(component.includes("failedRetryRef.current.set"), "Failed sends must be retryable");
assert.ok(component.includes("setRecordedVoice(new File(") && !component.includes('aria-label="ارسال Voice"'), "Voice must offer a preview before sending");
assert.ok(component.includes("conversationSearchOpen") && component.includes("focusSearchResult"), "Message search interaction missing");
const inChatSearchField = component.match(/<input\s+type="search"[\s\S]*?aria-label="جست‌وجو در پیام‌های گفتگو"[\s\S]*?\/>/)?.[0];
assert.ok(inChatSearchField, "In-chat search field must be present");
assert.ok(inChatSearchField.includes('text-base') && inChatSearchField.includes('fontSize: "16px"'), "In-chat search must remain at least 16px to prevent Safari/iOS input auto-zoom");
assert.ok(inChatSearchField.includes('WebkitTextSizeAdjust: "100%"'), "In-chat search must not auto-adjust text size on mobile Safari");
assert.ok(!inChatSearchField.includes("autoFocus"), "Opening search must not automatically raise the mobile keyboard");

const chatSearchAnchor = component.indexOf('id="inbox-conversation-search"');
const chatHeaderStart = component.indexOf('<header className="inbox-chat-header');
const chatHeaderEnd = component.indexOf("</header>", chatHeaderStart);
assert.ok(chatHeaderStart >= 0 && chatSearchAnchor > chatHeaderStart && chatSearchAnchor < chatHeaderEnd,
  "Search must be layered within the fixed-height chat header, not added to the message layout");
assert.ok(component.includes('role="search" className="inbox-chat-search-panel absolute top-full right-0 left-0 z-40'),
  "Expanding in-chat search must overlay messages without changing their height");
assert.ok(component.includes('touch-manipulation') && component.includes('aria-controls="inbox-conversation-search"'),
  "Search controls must prevent iOS double-tap zoom and expose their panel");
assert.ok(!component.includes('.scrollIntoView('),
  "Search results should never scroll the outer page or shift the mobile chat viewport");
assert.ok(component.includes('messageRect.top - containerRect.top'),
  "Search result scrolling must be confined to the messages container");

assert.ok(!component.includes("persistQuickReplies") && !component.includes("showQuickReplies") && !component.includes("MessageSquareText"), "Quick reply controls must not be shown");
assert.ok(!component.includes("toggleHumanMode") && !component.includes("handoffBusy"), "Human response toggle must not be shown");
assert.ok(!component.includes("NEEDS_REPLY") && !component.includes("نیازمند پاسخ"), "Needs-reply tab must be removed");
assert.ok(component.includes("خوانده‌نشده") && component.includes("whitespace-nowrap"), "Persian filter labels must never wrap");
assert.ok(component.includes('min-h-[56px]') && !component.includes('min-h-[72px]'), "Conversation list rows must be compact");
assert.ok(component.includes('position: fixed;') && component.includes('z-index: 2100;') && component.includes('max-width: 100vw;'), "Mobile chat must be a full-width fixed overlay");
assert.ok(component.includes('viewport?.offsetTop') && component.includes('viewport?.height') && component.includes('document.body.style.overflow'), "Mobile composer must follow the visual viewport and lock page scroll");
assert.ok(component.includes('min-w-0 w-full flex-1') && component.includes('overflow-hidden bg-background'), "Mobile chat must not overflow the viewport width");
assert.ok(component.includes("hasMoreMessages") && component.includes("loadMessages({ before: first.id })"), "Older messages must load on demand");
assert.ok(component.includes("showJumpToLatest") && component.includes("forceScrollToBottom"), "Scroll-to-latest interaction missing");
assert.ok(component.includes("data-mobile-chat-open") && component.includes("--inbox-visible-height") && component.includes("--inbox-viewport-top"), "Mobile immersive conversation missing");
console.log("INBOX_MODERN_REGRESSION_OK");
