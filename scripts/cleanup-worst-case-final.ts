import "dotenv/config";

import { getRedisClient, setRedisCommandTimeoutMs } from "../src/lib/redis/client";

async function main() {
  const namespace = process.argv[2];

  if (!namespace) {
    console.error("Usage: npm run worst-case:cleanup -- <namespace>");
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) {
    console.error("Invalid queue namespace");
    process.exit(1);
  }

  setRedisCommandTimeoutMs(30_000);

  const redis = getRedisClient();
  const keys = [
    `smartdirect:queue:${namespace}:ready`,
    `smartdirect:queue:${namespace}:delayed`,
    `smartdirect:queue:${namespace}:active`,
    `smartdirect:queue:${namespace}:failed`,
  ];

  const script = `
    local ids = {}
    for _, key in ipairs(KEYS) do
      local members = redis.call("ZRANGE", key, 0, -1)
      for _, id in ipairs(members) do
        ids[#ids + 1] = id
      end
    end
    for _, id in ipairs(ids) do
      redis.call("DEL", ARGV[1] .. id)
      redis.call("DEL", ARGV[2] .. id)
    end
    for _, key in ipairs(KEYS) do
      redis.call("DEL", key)
    end
    return #ids
  `;

  try {
    const deleted = await redis.eval(
      script,
      keys,
      ["smartdirect:queue:job:", "smartdirect:queue:claim:"],
    );

    console.log(JSON.stringify({
      success: true,
      namespace,
      deletedJobs: Number(deleted ?? 0),
    }, null, 2));
  } catch (error) {
    console.error("Worst-case cleanup failed");
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
