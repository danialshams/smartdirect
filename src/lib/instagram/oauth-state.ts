import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type InstagramOAuthState = {
  userId: string;
  timestamp: number;
  nonce: string;
};

function getStateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.INSTAGRAM_CLIENT_SECRET;

  if (!secret) {
    throw new Error("OAuth state signing secret is not configured");
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createInstagramOAuthState(userId: string): string {
  if (!userId) throw new Error("Instagram OAuth state userId is required");

  const payload: InstagramOAuthState = {
    userId,
    timestamp: Date.now(),
    nonce: createHmac("sha256", `${getStateSecret()}:${Date.now()}:${Math.random()}`)
      .update(userId)
      .digest("hex")
      .slice(0, 32),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyInstagramOAuthState(state: string): InstagramOAuthState {
  if (!state || !state.includes(".")) {
    throw new Error("Invalid Instagram OAuth state");
  }

  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) {
    throw new Error("Invalid Instagram OAuth state");
  }

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid Instagram OAuth state signature");
  }

  let payload: InstagramOAuthState;

  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Instagram OAuth state payload");
  }

  if (
    !payload ||
    typeof payload.userId !== "string" ||
    !payload.userId ||
    typeof payload.timestamp !== "number" ||
    !Number.isFinite(payload.timestamp) ||
    typeof payload.nonce !== "string" ||
    !payload.nonce
  ) {
    throw new Error("Invalid Instagram OAuth state payload");
  }

  const age = Date.now() - payload.timestamp;

  if (age < 0 || age > STATE_MAX_AGE_MS) {
    throw new Error("Instagram OAuth state expired");
  }

  return payload;
}
