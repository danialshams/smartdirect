/**
 * Benchmark real Prisma CRUD operations in the CI-only local PostgreSQL.
 *
 * This intentionally does NOT call production APIs, Meta, S3, or send messages.
 * Measures the database portion of dashboard operations, not browser-to-API
 * latency or the external Instagram publishing workflow.
 *
 * Invariants:
 * - NODE_ENV=test and loopback DATABASE_URL only; fail closed otherwise.
 * - Unique throwaway tenant, nested message/media writes, full cascade cleanup.
 * - Values go to a gitignored JSON file and GitHub Actions summary.
 * - No timing-based pass/fail thresholds on shared CI runners.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";

const database = process.env.DATABASE_URL;
if (process.env.NODE_ENV !== "test" || !database) {
  throw new Error("Refusing CRUD benchmark outside NODE_ENV=test with DATABASE_URL");
}
const databaseUrl = new URL(database);
if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
  throw new Error("CRUD benchmark is restricted to isolated loopback PostgreSQL");
}
const samples = Math.max(5, Math.min(50, Number(process.env.CRUD_BENCH_SAMPLES || 20)));
if (!Number.isInteger(samples)) throw new Error("Invalid CRUD_BENCH_SAMPLES");
type Stats = { samples: number; p50Ms: number; p95Ms: number; maxMs: number; minMs: number };
const durations = new Map<string, number[]>();
const milliseconds = (value: number) => Math.round(value * 100) / 100;
async function timed<T>(name: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await run();
  const value = durations.get(name) || [];
  value.push(performance.now() - start);
  durations.set(name, value);
  return result;
}
function stats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50Ms: milliseconds(sorted[Math.ceil(sorted.length * 0.50) - 1]),
    p95Ms: milliseconds(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    maxMs: milliseconds(sorted[sorted.length - 1]),
    minMs: milliseconds(sorted[0]),
  };
}

async function main() {
  const seed = randomUUID().replaceAll("-", "");
  let ownerId: string | undefined;
  try {
    const owner = await prisma.user.create({
      data: { name: "Performance CI throwaway tenant", email: "perf-" + seed + "@example.invalid", password: "ci-only" },
    });
    ownerId = owner.id;
    const account = await prisma.instagramAccount.create({
      data: { userId: owner.id, igUserId: "perf-" + seed, igUsername: "perf", accessToken: "ci-only", isConnected: true },
    });
    const ruleIds: string[] = [];
    for (let i = 0; i < samples; i++) {
      const created = await timed("automation.create.with-message", () => prisma.automation.create({
        data: {
          instagramAccountId: account.id, triggerType: "DM", keyword: "ci-" + seed + "-" + i,
          isActive: true,
          messages: { create: [{ messageType: "TEXT", text: "CI test", order: 0 }] },
        },
        select: { id: true },
      }));
      ruleIds.push(created.id);
    }
    for (let i = 0; i < samples; i++) {
      const rows = await timed("automation.list.metadata", () => prisma.automation.findMany({
        where: { instagramAccountId: account.id },
        select: {
          id: true, instagramAccountId: true, triggerType: true,
          mediaId: true, mediaIds: true, keyword: true, keywordMatchMode: true,
          commentReplyText: true, isActive: true, createdAt: true, updatedAt: true,
          messages: { orderBy: { order: "asc" }, take: 1, select: { messageType: true } },
        },
        orderBy: { createdAt: "desc" },
      }));
      assert.equal(rows.length, samples);
    }
    for (const id of ruleIds) {
      const changed = await timed("automation.toggle", () => prisma.automation.update({
        where: { id }, data: { isActive: false }, select: { id: true, isActive: true },
      }));
      assert.equal(changed.isActive, false);
    }
    for (const id of ruleIds) {
      const changed = await timed("automation.edit", () => prisma.automation.update({
        where: { id }, data: { isActive: true, replyText: "CI edited" }, select: { isActive: true, replyText: true },
      }));
      assert.equal(changed.isActive, true);
    }

    const reminderIds: string[] = [];
    for (const id of ruleIds) {
      const reminder = await timed("reminder.create", () => prisma.smartReminderRule.create({
        data: { userId: owner.id, instagramAccountId: account.id, automationId: id, delayMinutes: 5, text: "Test reminder" },
        select: { id: true },
      }));
      reminderIds.push(reminder.id);
    }
    for (let i = 0; i < samples; i++) {
      const [rules, candidates] = await timed("reminder.list.with-candidates", () => Promise.all([
        prisma.smartReminderRule.findMany({
          where: { instagramAccountId: account.id, userId: owner.id },
          orderBy: { createdAt: "desc" },
          include: {
            automation: { select: { keyword: true, keywordMatchMode: true, triggerType: true, isActive: true } },
            _count: { select: { deliveries: { where: { status: "SENT" } } } },
          },
        }),
        prisma.automation.findMany({
          where: {
            instagramAccountId: account.id, isActive: true,
            triggerType: { in: ["DM", "STORY_REPLY_KEYWORD", "COMMENT_KEYWORD"] },
            messages: { some: {} },
          },
          select: { id: true, triggerType: true, keyword: true, keywordMatchMode: true, mediaId: true },
          orderBy: { createdAt: "desc" },
        }),
      ]));
      assert.equal(rules.length, samples);
      assert.equal(candidates.length, samples);
    }
    for (const id of reminderIds) {
      const reminder = await timed("reminder.edit", () => prisma.smartReminderRule.update({
        where: { id }, data: { text: "Updated", delayMinutes: 10 }, select: { delayMinutes: true },
      }));
      assert.equal(reminder.delayMinutes, 10);
    }
    for (const id of reminderIds) {
      await timed("reminder.delete", () => prisma.smartReminderRule.delete({ where: { id }, select: { id: true } }));
    }
    for (const id of ruleIds) {
      await timed("automation.delete.with-message", () => prisma.automation.delete({ where: { id }, select: { id: true } }));
    }
    assert.equal(await prisma.smartReminderRule.count({ where: { userId: owner.id } }), 0);
    assert.equal(await prisma.automation.count({ where: { instagramAccountId: account.id } }), 0);

    const ticketIds: string[] = [];
    for (let i = 0; i < samples; i++) {
      const ticket = await timed("support.create.with-first-message", () => prisma.ticket.create({
        data: {
          userId: owner.id, subject: "Performance test " + i, category: "GENERAL",
          messages: { create: { senderUserId: owner.id, body: "Initial CI ticket body" } },
        },
        select: { id: true },
      }));
      ticketIds.push(ticket.id);
    }
    for (let i = 0; i < samples; i++) {
      const rows = await timed("support.list.latest-message", async () => {
        const items = await prisma.ticket.findMany({
          where: { userId: owner.id }, orderBy: { updatedAt: "desc" }, take: 100,
          select: {
            id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderUserId: true, createdAt: true } },
          },
        });
        await prisma.ticketMessage.groupBy({
          by: ["ticketId"],
          where: { ticketId: { in: items.map(item => item.id) }, senderUserId: { not: owner.id }, readAt: null },
          _count: { _all: true },
        });
        return items;
      });
      assert.equal(rows.length, samples);
    }
    for (const id of ticketIds) {
      await timed("support.reply", () => prisma.ticketMessage.create({
        data: { ticketId: id, senderUserId: owner.id, body: "CI followup" }, select: { id: true },
      }));
    }
    for (const id of ticketIds) {
      const detail = await timed("support.detail.with-messages", () => prisma.ticket.findFirst({
        where: { id, userId: owner.id },
        select: {
          id: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true,
          messages: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, body: true, senderUserId: true, createdAt: true,
              attachments: { select: { id: true, fileName: true, mimeType: true } },
              sender: { select: { role: true, name: true } },
            },
          },
        },
      }));
      assert.equal(detail?.messages.length, 2);
    }
    for (const id of ticketIds) {
      const result = await timed("support.close", () => prisma.ticket.updateMany({
        where: { id, userId: owner.id }, data: { status: "CLOSED", closedAt: new Date() },
      }));
      assert.equal(result.count, 1);
    }
    for (const id of ticketIds) {
      const result = await timed("support.reopen", () => prisma.ticket.updateMany({
        where: { id, userId: owner.id }, data: { status: "OPEN", closedAt: null },
      }));
      assert.equal(result.count, 1);
    }

    const jobIds: string[] = [];
    for (let i = 0; i < samples; i++) {
      const job = await timed("publishing.create.draft-with-media", () => prisma.instagramPublishJob.create({
        data: {
          userId: owner.id, instagramAccountId: account.id, type: "POST", status: "DRAFT",
          caption: "CI publish draft",
          media: { create: [{
            type: "IMAGE", storageKey: "ci-" + seed + "-" + i,
            expiresAt: new Date(Date.now() + 86_400_000), sortOrder: 0,
          }] },
        },
        select: { id: true },
      }));
      jobIds.push(job.id);
    }
    for (let i = 0; i < samples; i++) {
      const jobs = await timed("publishing.list.with-media", () => prisma.instagramPublishJob.findMany({
        where: { userId: owner.id }, orderBy: { createdAt: "desc" }, take: 100,
        include: {
          media: { orderBy: { sortOrder: "asc" } },
          instagramAccount: { select: { id: true, igUsername: true, igUserId: true } },
        },
      }));
      assert.equal(jobs.length, samples);
    }
    for (const id of jobIds) {
      await timed("publishing.edit.draft", () => prisma.instagramPublishJob.update({
        where: { id }, data: { caption: "Updated CI draft" }, select: { id: true },
      }));
    }
    for (const id of jobIds) {
      await timed("publishing.delete.draft", () => prisma.instagramPublishJob.delete({
        where: { id }, select: { id: true },
      }));
    }
    assert.equal(await prisma.instagramPublishJob.count({ where: { userId: owner.id } }), 0);

    // Match the principal Prisma portions of Inbox conversation operations.
    // No Instagram API calls, direct messages or real customer records.
    const chatIds: string[] = [];
    for (let i = 0; i < samples; i++) {
      const conversation = await timed("inbox.create.conversation-with-messages", () => prisma.conversation.create({
        data: {
          userId: owner.id, instagramAccountId: account.id,
          igUserId: account.igUserId,
          participantId: "ci-inbox-" + seed + "-" + i,
          participantUsername: "test_conversation_" + i,
          lastMessageAt: new Date(),
          messages: { create: [
            { direction: "INBOUND", messageType: "TEXT", text: "Test inbox search " + i },
            { direction: "OUTBOUND", messageType: "TEXT", text: "CI response " + i },
          ] },
        },
        select: { id: true },
      }));
      chatIds.push(conversation.id);
    }

    for (let i = 0; i < samples; i++) {
      const conversations = await timed("inbox.list.latest-with-unread", async () => {
        const rows = await prisma.conversation.findMany({
          where: { userId: owner.id, instagramAccountId: account.id },
          orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
          take: 51,
          include: {
            messages: {
              orderBy: { createdAt: "desc" }, take: 1,
              select: { id: true, direction: true, messageType: true, text: true, mediaUrl: true, mediaId: true, igMessageId: true, readAt: true, seenAt: true, createdAt: true },
            },
            _count: { select: { messages: true } },
          },
        });
        const ids = rows.map(row => row.id);
        await Promise.all([
          prisma.conversationMessage.groupBy({
            by: ["conversationId"],
            where: { conversationId: { in: ids }, direction: "INBOUND", readAt: null },
            _count: { _all: true },
          }),
          prisma.conversationMessage.findMany({
            where: { conversationId: { in: ids }, direction: "INBOUND" },
            orderBy: { createdAt: "desc" }, distinct: ["conversationId"],
            select: { conversationId: true, createdAt: true },
          }),
        ]);
        return rows;
      });
      assert.equal(conversations.length, samples);
    }

    for (const id of chatIds) {
      const messages = await timed("inbox.open.latest-messages", () => prisma.conversationMessage.findMany({
        where: { conversationId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        select: {
          id: true, direction: true, messageType: true, text: true,
          mediaUrl: true, mediaId: true, igMessageId: true,
          readAt: true, seenAt: true, createdAt: true,
        },
      }));
      assert.equal(messages.length, 2);
    }
    for (let i = 0; i < samples; i++) {
      const matches = await timed("inbox.search.messages", () => prisma.conversationMessage.findMany({
        where: { conversationId: chatIds[i], text: { contains: "Test inbox search", mode: "insensitive" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30, select: { id: true, text: true },
      }));
      assert.equal(matches.length, 1);
    }
    for (const id of chatIds) {
      const result = await timed("inbox.mark-inbound-read", () => prisma.conversationMessage.updateMany({
        where: { conversationId: id, direction: "INBOUND", readAt: null },
        data: { readAt: new Date() },
      }));
      assert.equal(result.count, 1);
    }
    for (const id of chatIds) {
      await timed("inbox.delete.fixture-conversation", () => prisma.conversation.delete({
        where: { id }, select: { id: true },
      }));
    }
    assert.equal(await prisma.conversation.count({ where: { instagramAccountId: account.id } }), 0);

    const operations = Object.fromEntries([...durations.entries()].map(([name, values]) => [name, stats(values)]));
    const report = {
      kind: "isolated-database-crud-not-end-to-end",
      createdAt: new Date().toISOString(),
      environment: "GitHub Actions local PostgreSQL; NODE_ENV=test",
      samplesPerOperation: samples,
      limitations: [
        "No web UI, React rendering, HTTP authentication, cold-start, Meta rate limits, file transfer, S3 or media conversion latency.",
        "Database-level operations use matching Prisma read/write patterns; they do not call production API handlers.",
        "CI shared-runner percentiles are diagnostics, not customer-facing performance SLOs.",
      ],
      operations,
    };
    await mkdir("performance-results", { recursive: true });
    const reportPath = "performance-results/dashboard-isolated-crud.json";
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    const rows = Object.entries(operations).map(([name, result]) => ({
      action: name, p50Ms: result.p50Ms, p95Ms: result.p95Ms, maxMs: result.maxMs,
    }));
    console.log("DASHBOARD_ISOLATED_CRUD_BENCHMARK_OK");
    console.table(rows);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const lines = [
        "### Isolated dashboard Prisma CRUD latency (not browser/API end-to-end)",
        "", "| Operation | Samples | p50 ms | p95 ms | max ms |", "|---|---:|---:|---:|---:|",
        ...Object.entries(operations).map(([name, value]) =>
          "|" + name + "|" + value.samples + "|" + value.p50Ms + "|" + value.p95Ms + "|" + value.maxMs + "|"),
        "", "Only CI loopback PostgreSQL; no live accounts, Meta, S3, HTTP or user messages.", "",
      ];
      await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
    }
  } finally {
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(error =>
      console.error("CI tenant cleanup failed:", error));
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
