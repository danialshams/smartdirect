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
    const list = source("components/dashboard/SupportTicketsClient.tsx");
    assert.equal((list.match(/href="\/dashboard\/tickets\/new"/g) || []).length, 1, "Exactly one new ticket CTA");
    assert(list.includes('value: "unread"') && list.includes("unreadCount"), "Unread conversation filter missing");
    const global = source("components/dashboard/SupportNotifications.tsx");
    assert(global.includes("SupportUnreadBadge") && global.includes("setTimeout") && global.includes("EventSource"), "Global notifications missing");
    const shell = source("components/dashboard/DahboardShell.tsx");
    assert(shell.includes("<SupportUnreadBadge />") && shell.includes("<SupportNotifications>"), "Global shell must include notifications");
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
