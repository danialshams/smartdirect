import "dotenv/config";

import { disconnectRedis, redisHealthCheck } from "../src/lib/redis/client";

async function main() {
  const result = await redisHealthCheck();

  console.log(JSON.stringify(result, null, 2));

  await disconnectRedis();

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await disconnectRedis().catch(() => undefined);
  process.exitCode = 1;
});
