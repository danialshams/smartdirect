import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { validateSavedResponseOrigin } from "../src/lib/automation/saved-response-origin";

async function main() {
const seed = randomUUID().replace(/-/g, "");
const owners: string[] = [];
try {
  const user = await prisma.user.create({ data: {
    name: "Response Scope CI", email: "response-scope-" + seed + "@example.invalid", password: "ci-only",
  } });
  owners.push(user.id);
  const otherUser = await prisma.user.create({ data: {
    name: "Other Scope CI", email: "other-scope-" + seed + "@example.invalid", password: "ci-only",
  } });
  owners.push(otherUser.id);
  const account = await prisma.instagramAccount.create({ data: {
    userId: user.id, igUserId: "response-scope-" + seed, igUsername: "testscope", accessToken: "ci-only",
  } });
  const otherAccount = await prisma.instagramAccount.create({ data: {
    userId: user.id, igUserId: "different-scope-" + seed, igUsername: "other", accessToken: "ci-only",
  } });
  const saved = await prisma.savedAutomationResponse.create({ data: {
    userId: user.id, instagramAccountId: account.id, title: "کفش",
    messageType: "TEXT", text: "سلام، موجودی کفش",
  } });
  const automation = await prisma.automation.create({ data: {
    instagramAccountId: account.id, triggerType: "DM", title: "پاسخ کفش",
  } });
  const message = await prisma.automationMessage.create({ data: {
    automationId: automation.id, order: 0, text: saved.text, messageType: "TEXT", savedResponseId: saved.id,
  } });
  assert.equal(await validateSavedResponseOrigin(saved.id, account.id, user.id, "TEXT"), saved.id);
  assert.equal(await validateSavedResponseOrigin(null, account.id, user.id), null);
  assert.equal(await validateSavedResponseOrigin(undefined, account.id, user.id), undefined);
  await assert.rejects(() => validateSavedResponseOrigin(saved.id, otherAccount.id, user.id, "TEXT"));
  await assert.rejects(() => validateSavedResponseOrigin(saved.id, account.id, otherUser.id, "TEXT"));
  await assert.rejects(() => validateSavedResponseOrigin(saved.id, account.id, user.id, "FORM"));
  const uses = await prisma.automationMessage.findMany({
    where: { savedResponseId: saved.id, automation: { instagramAccountId: account.id } },
  });
  assert.deepEqual(uses.map((value) => value.id), [message.id]);
  await prisma.savedAutomationResponse.delete({ where: { id: saved.id } });
  const remains = await prisma.automationMessage.findUniqueOrThrow({ where: { id: message.id } });
  assert.equal(remains.savedResponseId, null, "Deleting a saved template must preserve its active reply.");
  assert.equal(remains.text, saved.text);
  console.log("SAVED_RESPONSE_ORIGIN_TENANT_ISOLATION_AND_SET_NULL_OK");
} finally {
  for (const id of owners) await prisma.user.delete({ where: { id } }).catch(() => undefined);
  await prisma.$disconnect();
}

}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
