import {
  getObservabilityContext,
  type ObservabilityContext,
} from "./context";

type LogLevel = "info" | "warn" | "error" | "debug";

type LogFields = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "accessToken",
  "access_token",
  "token",
  "refreshToken",
  "refresh_token",
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "clientSecret",
  "client_secret",
  "appSecret",
  "app_secret",
]);

function redact(value: unknown, depth = 0): Record<string, unknown> | unknown[] | unknown {
  if (depth > 4) return "[REDACTED_DEPTH]";

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEYS.has(key)
        ? "[REDACTED]"
        : redact(item, depth + 1);
    }

    return result;
  }

  return value;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}) {
  const context = getObservabilityContext();

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "smartdirect",
    event,
    ...context,
    ...(redact(fields ?? {}) as Record<string, unknown>),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    console.debug(line);
  } else {
    console.log(line);
  }
}

export const observabilityLogger = {
  info(event: string, fields?: LogFields) {
    emit("info", event, fields);
  },
  warn(event: string, fields?: LogFields) {
    emit("warn", event, fields);
  },
  error(event: string, fields?: LogFields) {
    emit("error", event, fields);
  },
  debug(event: string, fields?: LogFields) {
    emit("debug", event, fields);
  },
};

export function logWithContext(
  level: LogLevel,
  event: string,
  context: ObservabilityContext,
  fields: LogFields = {},
) {
  const merged = {
    ...context,
    ...redact(fields ?? {}),
  };

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "smartdirect",
    event,
    ...merged,
  };

  const line = JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}
