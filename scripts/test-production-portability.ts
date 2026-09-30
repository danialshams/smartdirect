import "dotenv/config";

(process.env as Record<string, string | undefined>).NODE_ENV = "production";

import { validateServerEnvironment } from "../src/lib/config/env";
import { prisma } from "../src/lib/prisma";
import { disconnectRedis, getRedisClient, redisHealthCheck } from "../src/lib/redis/client";

async function main() {
  const env = validateServerEnvironment();

  console.log("[17] environment validation: OK");
  console.log(JSON.stringify({
    nodeEnv: env.nodeEnv,
    redisDriver: env.redisDriver,
    databaseConfigured: true,
    redisConfigured: true,
    nextAuthConfigured: Boolean(env.nextAuthSecret && env.nextAuthUrl),
  }));

  const redisHealth = await redisHealthCheck();

  if (!redisHealth.ok) {
    throw new Error(`Redis portability health check failed: ${redisHealth.error ?? "unknown error"}`);
  }

  console.log("[17] Redis health: OK");

  let databaseConnected = false;
  let databaseLastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      databaseConnected = true;
      if (attempt > 1) {
        console.log(`[17] Database connectivity: OK (attempt ${attempt})`);
      } else {
        console.log("[17] Database connectivity: OK");
      }
      break;
    } catch (error) {
      databaseLastError = error;
      if (attempt < 3) {
        console.warn(`[17] Database connectivity attempt ${attempt} failed; retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  if (!databaseConnected) {
    throw databaseLastError instanceof Error
      ? databaseLastError
      : new Error("Database connectivity check failed.");
  }

  const redis = getRedisClient();
  const key = `smartdirect:portability:test:${Date.now()}`;

  await redis.set(key, "ok", { ex: 30 });
  const value = await redis.get<string>(key);
  await redis.del(key);

  if (value !== "ok") {
    throw new Error("Redis read/write portability check failed.");
  }

  console.log("[17] Redis read/write: OK");
  console.log("191-199 Production Portability foundation: OK");
}

main()
  .catch((error) => {
    console.error("191-199 Production Portability foundation: FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectRedis().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });
