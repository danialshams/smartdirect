export type InstagramMessagingWindowMode =
  | "STANDARD"
  | "HUMAN_AGENT"
  | "CLOSED";

export type InstagramMessagingWindow = {
  mode: InstagramMessagingWindowMode;
  canSend: boolean;
  humanAgentEnabled: boolean;
  lastInboundAt: string | null;
  standardExpiresAt: string | null;
  humanAgentExpiresAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
};

const STANDARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function humanAgentEnabledFromEnv() {
  return process.env.INSTAGRAM_HUMAN_AGENT_ENABLED === "true";
}

export function getInstagramMessagingWindow(
  lastInboundAt: Date | null,
  now = new Date(),
): InstagramMessagingWindow {
  const humanAgentEnabled = humanAgentEnabledFromEnv();

  if (!lastInboundAt) {
    return {
      mode: "CLOSED",
      canSend: false,
      humanAgentEnabled,
      lastInboundAt: null,
      standardExpiresAt: null,
      humanAgentExpiresAt: null,
      expiresAt: null,
      remainingMs: 0,
    };
  }

  const standardExpiresAt = new Date(lastInboundAt.getTime() + STANDARD_WINDOW_MS);
  const humanAgentExpiresAt = new Date(
    lastInboundAt.getTime() + HUMAN_AGENT_WINDOW_MS,
  );

  if (now.getTime() < standardExpiresAt.getTime()) {
    return {
      mode: "STANDARD",
      canSend: true,
      humanAgentEnabled,
      lastInboundAt: lastInboundAt.toISOString(),
      standardExpiresAt: standardExpiresAt.toISOString(),
      humanAgentExpiresAt: humanAgentExpiresAt.toISOString(),
      expiresAt: standardExpiresAt.toISOString(),
      remainingMs: Math.max(0, standardExpiresAt.getTime() - now.getTime()),
    };
  }

  if (humanAgentEnabled && now.getTime() < humanAgentExpiresAt.getTime()) {
    return {
      mode: "HUMAN_AGENT",
      canSend: true,
      humanAgentEnabled,
      lastInboundAt: lastInboundAt.toISOString(),
      standardExpiresAt: standardExpiresAt.toISOString(),
      humanAgentExpiresAt: humanAgentExpiresAt.toISOString(),
      expiresAt: humanAgentExpiresAt.toISOString(),
      remainingMs: Math.max(0, humanAgentExpiresAt.getTime() - now.getTime()),
    };
  }

  return {
    mode: "CLOSED",
    canSend: false,
    humanAgentEnabled,
    lastInboundAt: lastInboundAt.toISOString(),
    standardExpiresAt: standardExpiresAt.toISOString(),
    humanAgentExpiresAt: humanAgentExpiresAt.toISOString(),
    expiresAt: null,
    remainingMs: 0,
  };
}
