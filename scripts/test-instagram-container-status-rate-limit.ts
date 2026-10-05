import { consumeInstagramRateLimit } from "@/lib/instagram/rate-limit";

const ACCOUNT_ID = `container-status-rate-limit-isolation-${Date.now()}`;

async function main() {
  process.env.INSTAGRAM_RATE_LIMIT_PUBLISH_MEDIA_LIMIT = "1";
  process.env.INSTAGRAM_RATE_LIMIT_PUBLISH_MEDIA_WINDOW_MS = "60_000";
  process.env.INSTAGRAM_RATE_LIMIT_PUBLISH_CONTAINER_STATUS_LIMIT = "1";
  process.env.INSTAGRAM_RATE_LIMIT_PUBLISH_CONTAINER_STATUS_WINDOW_MS = "60_000";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_LIMIT = "100";
  process.env.INSTAGRAM_RATE_LIMIT_ACCOUNT_WINDOW_MS = "1_000";

  const mediaContext = {
    instagramAccountId: ACCOUNT_ID,
    operation: "PUBLISH_MEDIA" as const,
  };
  const statusContext = {
    instagramAccountId: ACCOUNT_ID,
    operation: "PUBLISH_CONTAINER_STATUS" as const,
  };

  try {
    const mediaFirst = await consumeInstagramRateLimit(mediaContext);
    const mediaSecond = await consumeInstagramRateLimit(mediaContext);
    const statusFirst = await consumeInstagramRateLimit(statusContext);
    const statusSecond = await consumeInstagramRateLimit(statusContext);

    const success =
      mediaFirst.allowed
      && !mediaSecond.allowed
      && statusFirst.allowed
      && !statusSecond.allowed
      && mediaSecond.scope === "OPERATION"
      && statusSecond.scope === "OPERATION";

    console.log(JSON.stringify({
      success,
      tests: {
        publishMediaBucketIndependent: mediaFirst.allowed && !mediaSecond.allowed,
        containerStatusBucketIndependent: statusFirst.allowed && !statusSecond.allowed,
        statusNotBlockedByMediaOperationBucket: statusFirst.allowed,
        denialIncludesOperationScope: mediaSecond.scope === "OPERATION" && statusSecond.scope === "OPERATION",
      },
      observed: {
        mediaFirst,
        mediaSecond,
        statusFirst,
        statusSecond,
      },
    }, null, 2));

    if (!success) process.exitCode = 1;
  } finally {
    const { getRedisClient } = await import("@/lib/redis/client");
    const redis = getRedisClient();
    const account = ACCOUNT_ID.replace(/[^a-zA-Z0-9_-]/g, "_");
    await redis.del(
      `smartdirect:rate-limit:v2:account:${account}:tokens`,
      `smartdirect:rate-limit:v2:account:${account}:time`,
      `smartdirect:rate-limit:v2:account:${account}:operation:PUBLISH_MEDIA:tokens`,
      `smartdirect:rate-limit:v2:account:${account}:operation:PUBLISH_MEDIA:time`,
      `smartdirect:rate-limit:v2:account:${account}:operation:PUBLISH_CONTAINER_STATUS:tokens`,
      `smartdirect:rate-limit:v2:account:${account}:operation:PUBLISH_CONTAINER_STATUS:time`,
    );
  }
}

main().catch((error) => {
  console.error("Instagram container status rate-limit isolation test failed:", error);
  process.exitCode = 1;
});
