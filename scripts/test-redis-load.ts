import "dotenv/config";

import { randomUUID } from "node:crypto";

import { getRedisClient } from "@/lib/redis/client";

import { getLoadTestConfig } from "./load-test/config";
import { printLoadTestReport } from "./load-test/report";
import { runLoadTest } from "./load-test/runner";

async function main() {
  const redis = getRedisClient();
  const runId = randomUUID();
  const keys: string[] = [];
  let result: Awaited<ReturnType<typeof runLoadTest>> | undefined;

  try {
    result = await runLoadTest(
      {
        ...loadTestConfigFromEnv({
          name: "redis-load",
          total: 1000,
          concurrency: 16,
          durationMs: 30_000,
        }),
      },
      async (index) => {
        const key = `smartdirect:load-test:redis:${runId}:${index}`;
        const value = `value-${index}`;

        keys.push(key);

        await redis.set(key, value, { ex: 60 });

        const stored = await redis.get<string>(key);

        if (stored !== value) {
          throw new Error(
            `Redis value mismatch for index ${index}: expected ${value}, received ${String(stored)}`,
          );
        }
      },
    );

    printLoadTestReport(result);

    if (result.status !== "completed" || result.successful !== result.total) {
      throw new Error("176 Redis Load Test: FAILED");
    }

    console.log("176 Redis Load Test: OK");
  } finally {
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => redis.del(key)));
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
