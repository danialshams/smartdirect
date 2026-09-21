import "dotenv/config";

import { validateServerEnvironment } from "../src/lib/config/env";

try {
  const env = validateServerEnvironment();

  console.log(JSON.stringify({
    ok: true,
    nodeEnv: env.nodeEnv,
    redisDriver: env.redisDriver,
    databaseConfigured: true,
    redisConfigured: true,
    nextAuthConfigured: Boolean(env.nextAuthSecret && env.nextAuthUrl),
  }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
}
