export type RedisDriver = "upstash";

export type ServerEnvironment = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  redisDriver: RedisDriver;
  redisRestUrl: string;
  redisRestToken: string;
  nextAuthSecret?: string;
  nextAuthUrl?: string;
};

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`MISSING_ENV:${name}`);
  }

  return value;
}

function nodeEnv(): ServerEnvironment["nodeEnv"] {
  const value = process.env.NODE_ENV?.trim() || "development";

  if (value !== "development" && value !== "test" && value !== "production") {
    throw new Error(`INVALID_ENV:NODE_ENV:${value}`);
  }

  return value;
}

export function validateServerEnvironment(): ServerEnvironment {
  const env = nodeEnv();
  const redisDriver = (process.env.REDIS_DRIVER?.trim() || "upstash") as RedisDriver;

  if (redisDriver !== "upstash") {
    throw new Error(`UNSUPPORTED_REDIS_DRIVER:${redisDriver}`);
  }

  const databaseUrl = required("DATABASE_URL");
  const redisRestUrl = required("UPSTASH_REDIS_REST_URL");
  const redisRestToken = required("UPSTASH_REDIS_REST_TOKEN");

  try {
    new URL(databaseUrl);
  } catch {
    throw new Error("INVALID_ENV:DATABASE_URL");
  }

  try {
    const redisUrl = new URL(redisRestUrl);
    if (redisUrl.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error("INVALID_ENV:UPSTASH_REDIS_REST_URL");
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();

  if (env === "production") {
    if (!nextAuthSecret) {
      throw new Error("MISSING_ENV:NEXTAUTH_SECRET");
    }

    if (nextAuthSecret.length < 32) {
      throw new Error("INVALID_ENV:NEXTAUTH_SECRET_TOO_SHORT");
    }

    if (!nextAuthUrl) {
      throw new Error("MISSING_ENV:NEXTAUTH_URL");
    }

    try {
      new URL(nextAuthUrl);
    } catch {
      throw new Error("INVALID_ENV:NEXTAUTH_URL");
    }
  }

  return {
    nodeEnv: env,
    databaseUrl,
    redisDriver,
    redisRestUrl,
    redisRestToken,
    nextAuthSecret,
    nextAuthUrl,
  };
}

export function getProductionEnvironmentFingerprintInput() {
  const env = validateServerEnvironment();

  return {
    nodeEnv: env.nodeEnv,
    redisDriver: env.redisDriver,
    databaseConfigured: Boolean(env.databaseUrl),
    redisConfigured: Boolean(env.redisRestUrl && env.redisRestToken),
    nextAuthConfigured: Boolean(env.nextAuthSecret && env.nextAuthUrl),
  };
}
