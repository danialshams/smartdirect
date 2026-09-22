import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { validateInstagramAccessToken } from "../src/lib/instagram/token-manager";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = `meta-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `g20-validation-${suffix}@example.com`;
  const originalFetch = globalThis.fetch;
  let userId: string | null = null;
  let accountId: string | null = null;

  const results = {
    validToken: false,
    revokedTokenDisconnect: false,
    temporaryErrorPreservesConnection: false,
    cleanup: false,
  };

  try {
    const user = await prisma.user.create({
      data: { email, name: "Group20 Validation", password: "test-only" },
      select: { id: true },
    });
    userId = user.id;

    const account = await prisma.instagramAccount.create({
      data: {
        userId,
        igUserId: `g20-validation-ig-${suffix}`,
        igUsername: `g20_validation_${suffix.slice(-8)}`,
        accessToken: `validation-token-${randomUUID()}`,
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isConnected: true,
      },
      select: { id: true },
    });
    accountId = account.id;

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: "profile-id", user_id: "professional-id", username: "validation_user" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const valid = await validateInstagramAccessToken(accountId);
    assert(valid.valid && !valid.disconnected, "Valid token validation failed");
    results.validToken = true;

    globalThis.fetch = async () =>
      new Response(JSON.stringify({
        error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190 },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });

    const revoked = await validateInstagramAccessToken(accountId);
    assert(!revoked.valid && revoked.disconnected, "Revoked token was not classified as disconnected");

    const afterRevoked = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { isConnected: true },
    });
    assert(afterRevoked?.isConnected === false, "Revoked token did not disconnect the account");
    results.revokedTokenDisconnect = true;

    await prisma.instagramAccount.update({
      where: { id: accountId },
      data: { isConnected: true },
    });

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Temporary upstream failure" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });

    let temporaryFailed = false;
    try {
      await validateInstagramAccessToken(accountId);
    } catch {
      temporaryFailed = true;
    }
    assert(temporaryFailed, "Temporary Meta error should be propagated");

    const afterTemporary = await prisma.instagramAccount.findUnique({
      where: { id: accountId },
      select: { isConnected: true },
    });
    assert(afterTemporary?.isConnected === true, "Temporary Meta error incorrectly disconnected the account");
    results.temporaryErrorPreservesConnection = true;

    results.cleanup = true;
  } finally {
    globalThis.fetch = originalFetch;
    if (accountId) await prisma.instagramAccount.delete({ where: { id: accountId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
  }

  const success = Object.values(results).every(Boolean);
  console.log(JSON.stringify({ success, tests: results }, null, 2));
  if (!success) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
