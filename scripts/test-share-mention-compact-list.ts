/**
 * Integration fixture: verify the compact Share/Mention list keeps every
 * searchable message text and does not expose unrelated account/trigger data.
 * CI database only; ephemeral user records are cascade-deleted afterwards.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const suffix = randomUUID().replaceAll("-", "");
  const owners: string[] = [];
  try {
    const user = await prisma.user.create({
      data: { name: "Share projection test", email: "share-projection-" + suffix + "@example.invalid", password: "ci-only" },
    });
    owners.push(user.id);
    const outsider = await prisma.user.create({
      data: { name: "Foreign share projection", email: "share-foreign-" + suffix + "@example.invalid", password: "ci-only" },
    });
    owners.push(outsider.id);
    const account = await prisma.instagramAccount.create({
      data: { userId: user.id, igUserId: "share-projection-" + suffix, igUsername: "projection", accessToken: "ci-only", isConnected: true },
    });
    const foreign = await prisma.instagramAccount.create({
      data: { userId: outsider.id, igUserId: "share-foreign-" + suffix, igUsername: "foreign", accessToken: "ci-only", isConnected: true },
    });
    const share = await prisma.automation.create({
      data: {
        instagramAccountId: account.id, triggerType: "DM_MEDIA_SHARE", isActive: true,
        mediaIds: "meta-test-1,meta-test-2", messages: { create: [
          { messageType: "TEXT", text: "اولین متن", order: 0 },
          { messageType: "TEXT", text: "متن دوم قابل جستجو", order: 1 },
        ] },
      },
    });
    const mention = await prisma.automation.create({
      data: { instagramAccountId: account.id, triggerType: "STORY_MENTION", messages: { create: [
        { messageType: "TEXT", text: "منشن", order: 0 },
      ] } },
    });
    await prisma.automation.create({
      data: { instagramAccountId: account.id, triggerType: "DM", keyword: "unrelated", messages: { create: [
        { messageType: "TEXT", text: "unrelated", order: 0 },
      ] } },
    });
    await prisma.automation.create({
      data: { instagramAccountId: foreign.id, triggerType: "DM_MEDIA_SHARE", messages: { create: [
        { messageType: "TEXT", text: "foreign-message", order: 0 },
      ] } },
    });
    const projected = await prisma.automation.findMany({
      where: { instagramAccountId: account.id, triggerType: { in: ["DM_MEDIA_SHARE", "STORY_MENTION"] } },
      select: {
        id: true, instagramAccountId: true, triggerType: true,
        mediaId: true, mediaIds: true, isActive: true, updatedAt: true,
        messages: { orderBy: { order: "asc" }, select: { messageType: true, text: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(projected.length, 2);
    assert(projected.every(item => item.instagramAccountId === account.id));
    const shareView = projected.find(item => item.id === share.id);
    const mentionView = projected.find(item => item.id === mention.id);
    assert.deepEqual(shareView?.messages.map(m => m.text), ["اولین متن", "متن دوم قابل جستجو"]);
    assert.equal(mentionView?.messages[0]?.text, "منشن");
    assert(!JSON.stringify(projected).includes("foreign-message"));
    assert(!JSON.stringify(projected).includes("unrelated"));
    // The current full-graph route includes unrelated triggers and nested
    // message fields; compact payload must remain considerably smaller.
    const full = await prisma.automation.findMany({
      where: { instagramAccountId: account.id },
      include: { messages: { include: { quickReplies: true, showcase: true, form: true } } },
      orderBy: { createdAt: "desc" },
    });
    const compactBytes = Buffer.byteLength(JSON.stringify(projected));
    const fullBytes = Buffer.byteLength(JSON.stringify(full));
    assert(compactBytes < fullBytes, "Compact list must transfer fewer bytes than the old full-graph list");

    const api = readFileSync("app/api/automations/route.ts", "utf8");
    const client = readFileSync("components/dashboard/ShareMentionManager.tsx", "utf8");
    assert(api.includes('searchParams.get("view") === "share-mention"'));
    assert(api.includes('where: { instagramAccountId, triggerType: { in: ["DM_MEDIA_SHARE", "STORY_MENTION"] } }'));
    assert(api.includes('select: { messageType: true, text: true }'));
    assert(client.includes('fetch("/api/automations?view=share-mention&instagramAccountId="'));
    console.log("SHARE_MENTION_COMPACT_LIST_OK " + JSON.stringify({ compactBytes, fullBytes, reductionPct: Math.round((1 - compactBytes / fullBytes) * 100) }));
  } finally {
    for (const id of owners.reverse()) {
      await prisma.user.delete({ where: { id } }).catch(error => console.error("CI cleanup failed", error));
    }
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
