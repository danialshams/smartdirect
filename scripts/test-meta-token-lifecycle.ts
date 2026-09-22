import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { createInstagramOAuthState, verifyInstagramOAuthState } = await import("../src/lib/instagram/oauth-state");

  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "group20-test-secret";

  const suffix = `meta-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `g20-a-${suffix}@example.com`;
  const emailB = `g20-b-${suffix}@example.com`;

  const results = {
    oauthStateSignature: false,
    oauthStateTamperProtection: false,
    oauthStateExpiryValidation: false,
    accountTokenIsolation: false,
    connectedStateIsolation: false,
    cleanup: false,
  };

  let userA: { id: string } | null = null;
  let userB: { id: string } | null = null;

  try {
    userA = await prisma.user.create({
      data: { email: emailA, name: "Group20 A", password: "test-only" },
      select: { id: true },
    });

    userB = await prisma.user.create({
      data: { email: emailB, name: "Group20 B", password: "test-only" },
      select: { id: true },
    });

    const state = createInstagramOAuthState(userA.id);
    const verified = verifyInstagramOAuthState(state);

    if (verified.userId !== userA.id) throw new Error("OAuth state user binding failed");
    results.oauthStateSignature = true;

    const [encoded, signature] = state.split(".");
    const tampered = `${encoded}x.${signature}`;

    try {
      verifyInstagramOAuthState(tampered);
    } catch {
      results.oauthStateTamperProtection = true;
    }

    const expiredState = `${encoded}.${signature}`;
    if (expiredState) {
      const originalNow = Date.now;
      Date.now = () => originalNow() + 11 * 60 * 1000;
      try {
        verifyInstagramOAuthState(state);
      } catch {
        results.oauthStateExpiryValidation = true;
      } finally {
        Date.now = originalNow;
      }
    }

    const tokenA = `token-a-${randomUUID()}`;
    const tokenB = `token-b-${randomUUID()}`;

    const accountA = await prisma.instagramAccount.create({
      data: {
        userId: userA.id,
        igUserId: `g20-ig-a-${suffix}`,
        igUsername: `g20_a_${suffix.slice(-8)}`,
        accessToken: tokenA,
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isConnected: true,
      },
      select: { id: true, userId: true, accessToken: true, isConnected: true },
    });

    const accountB = await prisma.instagramAccount.create({
      data: {
        userId: userB.id,
        igUserId: `g20-ig-b-${suffix}`,
        igUsername: `g20_b_${suffix.slice(-8)}`,
        accessToken: tokenB,
        tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isConnected: true,
      },
      select: { id: true, userId: true, accessToken: true, isConnected: true },
    });

    const loadedA = await prisma.instagramAccount.findUnique({ where: { id: accountA.id } });
    const loadedB = await prisma.instagramAccount.findUnique({ where: { id: accountB.id } });

    if (
      loadedA?.userId === userA.id &&
      loadedB?.userId === userB.id &&
      loadedA.accessToken === tokenA &&
      loadedB.accessToken === tokenB &&
      loadedA.accessToken !== loadedB.accessToken
    ) {
      results.accountTokenIsolation = true;
    }

    await prisma.instagramAccount.update({
      where: { id: accountA.id },
      data: { isConnected: false },
    });

    const [afterA, afterB] = await Promise.all([
      prisma.instagramAccount.findUnique({ where: { id: accountA.id } }),
      prisma.instagramAccount.findUnique({ where: { id: accountB.id } }),
    ]);

    if (afterA?.isConnected === false && afterB?.isConnected === true) {
      results.connectedStateIsolation = true;
    }

    results.cleanup = true;
  } finally {
    if (userA) await prisma.instagramAccount.deleteMany({ where: { userId: userA.id } });
    if (userB) await prisma.instagramAccount.deleteMany({ where: { userId: userB.id } });
    if (userA) await prisma.user.delete({ where: { id: userA.id } });
    if (userB) await prisma.user.delete({ where: { id: userB.id } });
  }

  const success = Object.values(results).every(Boolean);

  console.log(JSON.stringify({ success, tests: results }, null, 2));

  if (!success) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
