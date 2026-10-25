import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

function source(path: string) { return readFileSync(path, "utf8"); }
async function main() {
  const key = "support-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const owner = await prisma.user.create({ data: { email: key + "@example.test", name: "Support owner", password: "test-only" } });
  const agent = await prisma.user.create({ data: { email: "agent-" + key + "@example.test", name: "Support agent", password: "test-only" } });
  try {
    const ticket = await prisma.ticket.create({
      data: { userId: owner.id, subject: "Test support conversation", category: "CONNECTION",
        messages: { create: { senderUserId: owner.id, body: "Connection fails" } } },
    });
    assert.equal(ticket.category, "CONNECTION");
    const reply = await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, senderUserId: agent.id, body: "Please retry", attachments: {
        create: { fileName: "screenshot.png", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
      } },
      select: { id: true, readAt: true, attachments: { select: { id: true, bytes: true } } },
    });
    assert.equal(reply.readAt, null);
    assert.equal(reply.attachments.length, 1);
    assert.equal(reply.attachments[0].bytes.length, 8);
    const unread = { ticket: { userId: owner.id }, readAt: null, senderUserId: { not: owner.id } };
    assert.equal(await prisma.ticketMessage.count({ where: unread }), 1);
    assert.equal(await prisma.ticketMessage.count({ where: { ticket: { userId: agent.id }, readAt: null } }), 0);
    const marked = await prisma.ticketMessage.updateMany({ where: { ticketId: ticket.id, ...unread }, data: { readAt: new Date() } });
    assert.equal(marked.count, 1);
    assert.equal(await prisma.ticketMessage.count({ where: unread }), 0);
    assert.equal((await prisma.ticketMessage.findUnique({ where: { id: reply.id } }))?.senderUserId, agent.id);
    // The initial ticket read PATCH is unnecessary if every support message
    // already has readAt. Verify that the database projection exposes it and
    // the UI checks unread replies, rather than any historical agent reply.
    const unreadDetail = await prisma.ticket.findFirst({
      where: { id: ticket.id, userId: owner.id },
      select: { messages: { where: { senderUserId: agent.id }, select: { readAt: true } } },
    });
    assert(unreadDetail?.messages.some(message => message.readAt === null) === false,
      "Previously read agent messages must not be marked read again.");
    const detailApi = source("app/api/dashboard/tickets/[id]/route.ts");
    const detailClient = source("components/dashboard/SupportTicketDetailClient.tsx");
    assert(detailApi.includes("senderUserId: true, readAt: true, createdAt: true") &&
      detailClient.includes("message.senderUserId !== data.userId && message.readAt === null"),
      "Support detail must check readAt before issuing a read-receipt PATCH.");
    const list = source("components/dashboard/SupportTicketsClient.tsx");
    assert(list.includes("inFlightSignal.current === currentSignal") &&
      list.includes("pendingRefresh.current = true") &&
      list.includes("void refreshTickets(currentSignal)") &&
      list.includes("controller.abort()"),
      "Support ticket list refreshes must coalesce concurrent SSE/focus reads without dropping updates.");
    assert.equal((list.match(/href="\/dashboard\/tickets\/new"/g) || []).length, 1, "Exactly one new ticket CTA");
    assert(list.includes('value: "unread"') && list.includes("unreadCount"), "Unread conversation filter missing");
    const newForm = source("components/dashboard/SupportTicketNewClient.tsx");
    const styles = source("app/dashboard/tickets/support.css");
    assert(list.includes('className="daira-support__header-icon"') && newForm.includes('className="daira-support__header-icon"'), "Both support page titles need the matching section icon");
    const glass = source("app/daira-glass.css");
    assert(glass.includes(".daira-support__header") && glass.includes("var(--daira-glass-raised)"), "Support titles must use the shared raised glass material");
    assert(styles.includes("background:var(--daira-glass-raised)") && styles.includes("background:var(--daira-brand-200)"), "Support heading and icon must draw from canonical palette tokens");
    assert(styles.includes("flex-direction:row;direction:rtl") && list.includes('<span>درخواست جدید</span><Plus'), "Support create button must show its label first and plus icon after it in RTL");
    assert(newForm.includes("انتخاب تصویر <ImagePlus") && newForm.includes('"ثبت درخواست"}<Send'), "Upload and submit actions should also show labels before icons");
    const global = source("components/dashboard/SupportNotifications.tsx");
    assert(global.includes("SupportUnreadBadge") && global.includes("setTimeout") && global.includes("EventSource"), "Global notifications missing");
    const shell = source("components/dashboard/DahboardShell.tsx");
    assert(shell.includes("<SupportUnreadBadge />") && shell.includes("<SupportNotifications userEmail={user.email}>"), "Global shell must scope support notifications to signed-in user");
    assert(global.includes("SupportOwnerContext.Provider value={userEmail}") && global.includes("useSupportOwnerKey"),
      "Support user key must come from the authenticated dashboard shell.");
    assert(list.includes('ownerKey ? "support-tickets:" + ownerKey : null') &&
      list.includes("getDashboardListSnapshot<SupportCachedList>(listKey)") &&
      list.includes("setDashboardListSnapshot<SupportCachedList>(listKey, [{ userId: currentUserId, tickets: rows }])") &&
      list.includes("void load(controller.signal, !cached)"),
      "Support tickets must restore only the signed-in user's snapshot and revalidate on revisit.");
    const migration = source("prisma/migrations/20261023220000_support_center_notifications/migration.sql");
    assert(migration.includes('"readAt"') && migration.includes('"TicketAttachment"'), "Read receipts and attachment migration missing");
    console.log("DAIRA_SUPPORT_CENTER_OK");
  } finally {
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.user.delete({ where: { id: agent.id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
