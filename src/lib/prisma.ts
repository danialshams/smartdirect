import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databasePoolMax = Number(process.env.DB_POOL_MAX ?? 5);
const databaseConnectionTimeoutMs = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000);
const databaseIdleTimeoutMs = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10000);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(databasePoolMax) && databasePoolMax > 0 ? Math.floor(databasePoolMax) : 5,
  connectionTimeoutMillis:
    Number.isFinite(databaseConnectionTimeoutMs) && databaseConnectionTimeoutMs > 0
      ? Math.floor(databaseConnectionTimeoutMs)
      : 5000,
  idleTimeoutMillis:
    Number.isFinite(databaseIdleTimeoutMs) && databaseIdleTimeoutMs > 0
      ? Math.floor(databaseIdleTimeoutMs)
      : 10000,
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
