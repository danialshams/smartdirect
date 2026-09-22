import "dotenv/config";

import { prisma } from "../src/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const suffix = "db-reliability-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const emails = Array.from({ length: 8 }, (_, index) => suffix + "-" + index + "@example.test");

  const connectivity = await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
  assert(Number(connectivity[0]?.ok) === 1, "Database connectivity check failed");

  const users = await Promise.all(
    emails.map((email, index) =>
      prisma.user.create({
        data: { email, name: "DB Reliability " + index, password: "test-only" },
        select: { id: true, email: true },
      }),
    ),
  );
  assert(users.length === 8, "Concurrent inserts did not complete");

  const rollbackEmail = suffix + "-rollback@example.test";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { email: rollbackEmail, name: "Rollback Test", password: "test-only" },
      });
      throw new Error("INTENTIONAL_TRANSACTION_ROLLBACK");
    });
  } catch (error) {
    assert(error instanceof Error && error.message === "INTENTIONAL_TRANSACTION_ROLLBACK", "Transaction rollback injection failed");
  }

  const rolledBack = await prisma.user.findUnique({
    where: { email: rollbackEmail },
    select: { id: true },
  });
  assert(!rolledBack, "Rolled-back transaction left persisted data");

  const account = await prisma.instagramAccount.create({
    data: {
      userId: users[0].id,
      igUserId: "db-test-ig-" + suffix,
      igUsername: "db_test_" + suffix.slice(-10),
      accessToken: "test-only",
    },
    select: { id: true, userId: true },
  });

  const ownerScoped = await prisma.instagramAccount.findFirst({
    where: { id: account.id, userId: users[0].id },
    select: { id: true },
  });
  const crossTenant = await prisma.instagramAccount.findFirst({
    where: { id: account.id, userId: users[1].id },
    select: { id: true },
  });

  assert(ownerScoped?.id === account.id, "Owner-scoped lookup failed");
  assert(crossTenant === null, "Cross-tenant scoped lookup returned another tenant's account");

  const duplicateError = await prisma.instagramAccount.create({
    data: {
      userId: users[1].id,
      igUserId: account.id,
      igUsername: "db_duplicate_" + suffix.slice(-10),
      accessToken: "test-only",
    },
  }).then(() => null, (error) => error);
  assert(duplicateError !== null, "Unique constraint did not reject duplicate igUserId");

  await prisma.instagramAccount.delete({ where: { id: account.id } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });

  console.log(JSON.stringify({
    success: true,
    tests: {
      connectivity: true,
      concurrentInserts: true,
      transactionRollback: true,
      tenantScopedLookup: true,
      crossTenantIsolation: true,
      uniqueConstraint: true,
      cleanup: true,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
