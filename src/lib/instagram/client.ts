import {
  consumeInstagramRateLimit,
  type InstagramRateLimitContext,
} from "@/lib/instagram/rate-limit";
import { observabilityLogger } from "@/lib/observability/logger";
import { recordFailure, recordLatency } from "@/lib/observability/metrics";

const INSTAGRAM_API_VERSION = "v26.0";
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

export type InstagramApiErrorDetails = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export class InstagramRateLimitError extends Error {
  retryAfterMs: number;
  scope?: string;

  constructor(retryAfterMs: number, scope?: string) {
    super(`Instagram rate limit exceeded${scope ? ` (${scope})` : ""}`);
    this.name = "InstagramRateLimitError";
    this.retryAfterMs = retryAfterMs;
    this.scope = scope;
  }
}

export class InstagramApiTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Instagram API request timed out after ${timeoutMs}ms`);
    this.name = "InstagramApiTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class InstagramApiError extends Error {
  status: number;
  details?: InstagramApiErrorDetails;
  response?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      details?: InstagramApiErrorDetails;
      response?: unknown;
    },
  ) {
    super(message);
    this.name = "InstagramApiError";
    this.status = options.status;
    this.details = options.details;
    this.response = options.response;
  }
}

export type InstagramApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  accessToken?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  rateLimit?: InstagramRateLimitContext;
  rateLimitWaitMs?: number;
  logRequestBody?: boolean;
};

function getTimeoutMs(timeoutMs?: number) {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  const envValue = Number(process.env.INSTAGRAM_API_TIMEOUT_MS);

  if (Number.isFinite(envValue) && envValue > 0) {
    return envValue;
  }

  return DEFAULT_TIMEOUT_MS;
}

function createTimeoutSignal(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();

  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  let timedOut = false;

  const timeoutHandler = () => {
    timedOut = true;
    controller.abort();
  };

  const timeoutId = setTimeout(timeoutHandler, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout() {
      return timedOut;
    },
    cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

function getObservabilityOperation(method: string, path: string) {
  const normalizedPath = path
    .replace(/\\b[a-fA-F0-9]{16,}\\b/g, ":id")
    .replace(/\\b[0-9]+\\b/g, ":id");
  return `instagram_api:${method}:${normalizedPath}`;
}

function buildUrl(
  path: string,
  params?: InstagramApiRequestOptions["params"],
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${INSTAGRAM_GRAPH_URL}${normalizedPath}`);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMaxRetries(maxRetries?: number) {
  if (typeof maxRetries === "number" && Number.isInteger(maxRetries) && maxRetries >= 0) {
    return maxRetries;
  }

  const value = Number(process.env.INSTAGRAM_API_MAX_RETRIES);

  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAX_RETRIES;
}

function getRetryBaseDelayMs(retryBaseDelayMs?: number) {
  if (
    typeof retryBaseDelayMs === "number" &&
    Number.isFinite(retryBaseDelayMs) &&
    retryBaseDelayMs >= 0
  ) {
    return retryBaseDelayMs;
  }

  const value = Number(process.env.INSTAGRAM_API_RETRY_BASE_DELAY_MS);

  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_RETRY_BASE_DELAY_MS;
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function isRetryableMethod(method: string) {
  return method === "GET";
}

function isCallerAbort(signal?: AbortSignal) {
  return Boolean(signal?.aborted);
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError || error instanceof Error;
}

function getRetryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");

  if (!value) return null;

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) return null;

  return Math.max(0, timestamp - Date.now());
}

function getJitterMs(delayMs: number) {
  return Math.floor(Math.random() * Math.max(1, Math.min(250, delayMs)));
}

async function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Instagram API request aborted");
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);

    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error("Instagram API request aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function instagramApiRequest<T = unknown>(
  path: string,
  options: InstagramApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const maxRetries = getMaxRetries(options.maxRetries);
  const retryBaseDelayMs = getRetryBaseDelayMs(options.retryBaseDelayMs);

  const params = { ...(options.params ?? {}) };

  if (options.accessToken) {
    params.access_token = options.accessToken;
  }

  const url = buildUrl(path, params);
  const operation = getObservabilityOperation(method, path);

  observabilityLogger.info("instagram_api_request_started", {
    method,
    path,
    operation,
    hasAccessToken: Boolean(options.accessToken),
    hasRateLimit: Boolean(options.rateLimit),
    ...(options.logRequestBody ? { requestBody: options.body } : {}),
  });

  if (options.rateLimit) {
    const rateLimit = await consumeInstagramRateLimit(options.rateLimit);

    if (!rateLimit.allowed) {
      if (
        options.rateLimitWaitMs &&
        options.rateLimitWaitMs > 0 &&
        rateLimit.retryAfterMs <= options.rateLimitWaitMs
      ) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, rateLimit.retryAfterMs);
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error("Instagram rate-limit wait aborted"));
          };
          options.signal?.addEventListener("abort", onAbort, { once: true });
        });

        const retriedRateLimit = await consumeInstagramRateLimit(
          options.rateLimit,
        );

        if (!retriedRateLimit.allowed) {
          throw new InstagramRateLimitError(
            retriedRateLimit.retryAfterMs,
            retriedRateLimit.scope,
          );
        }
      } else {
        throw new InstagramRateLimitError(
          rateLimit.retryAfterMs,
          rateLimit.scope,
        );
      }
    }
  }

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const timeout = createTimeoutSignal(
      getTimeoutMs(options.timeoutMs),
      options.signal,
    );

    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method,
        signal: timeout.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.body instanceof URLSearchParams
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : options.body instanceof FormData
              ? {}
              : options.body !== undefined
                ? { "Content-Type": "application/json" }
                : {}),
        },
        ...(options.body !== undefined
          ? {
              body:
                options.body instanceof URLSearchParams
                  ? options.body.toString()
                  : options.body instanceof FormData
                    ? options.body
                    : JSON.stringify(options.body),
            }
          : {}),
      });

      const data = await parseResponse(response);

      const details =
        data && typeof data === "object" && "error" in data
          ? ((data as { error?: InstagramApiErrorDetails }).error ?? undefined)
          : undefined;

      const responseHeaders = {
        requestId: response.headers.get("x-fb-request-id"),
        traceId: response.headers.get("x-fb-trace-id"),
        revision: response.headers.get("x-fb-rev"),
        apiVersion: response.headers.get("instagram-api-version"),
        contentType: response.headers.get("content-type"),
      };

      if (!response.ok || details) {
        const message =
          details?.message ||
          `Instagram API request failed with status ${response.status}`;

        const canRetry =
          attempt <= maxRetries &&
          isRetryableMethod(method) &&
          isRetryableStatus(response.status);

        const latencyMs = Date.now() - startedAt;

        observabilityLogger.warn("instagram_api_response", {
          method,
          path,
          operation,
          status: response.status,
          latencyMs,
          attempt,
          maxRetries: maxRetries + 1,
          retrying: canRetry,
          errorCode: details?.code,
          errorSubcode: details?.error_subcode,
          fbtraceId: details?.fbtrace_id,
          metaResponse: data,
          responseHeaders,
        });
        void recordLatency(operation, latencyMs);
        void recordFailure(
          operation,
          `http_${response.status}${details?.code ? `_code_${details.code}` : ""}`,
        );

        if (canRetry) {
          const exponentialDelay =
            retryBaseDelayMs * 2 ** (attempt - 1);
          const retryAfter = response.status === 429
            ? getRetryAfterMs(response)
            : null;
          const delayMs =
            retryAfter ?? exponentialDelay + getJitterMs(exponentialDelay);

          await waitForRetry(delayMs, options.signal);
          continue;
        }

        throw new InstagramApiError(message, {
          status: response.status,
          details,
          response: data,
        });
      }

      const latencyMs = Date.now() - startedAt;

      observabilityLogger.info("instagram_api_response", {
        method,
        path,
        operation,
        status: response.status,
        latencyMs,
        attempt,
      });
      void recordLatency(operation, latencyMs);

      return data as T;
    } catch (error) {
      if (error instanceof InstagramApiError || error instanceof InstagramApiTimeoutError) {
        throw error;
      }

      const timedOut = timeout.didTimeout();
      const callerAborted = isCallerAbort(options.signal);
      const canRetry =
        attempt <= maxRetries &&
        isRetryableMethod(method) &&
        !callerAborted &&
        (timedOut || isNetworkError(error));

      const latencyMs = Date.now() - startedAt;
      const errorType = timedOut ? "timeout" : "network_error";

      observabilityLogger.error("instagram_api_error", {
        method,
        path,
        operation,
        status: timedOut ? "timeout" : "network-error",
        latencyMs,
        attempt,
        maxRetries: maxRetries + 1,
        retrying: canRetry,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      void recordLatency(operation, latencyMs);
      void recordFailure(operation, errorType);

      if (canRetry) {
        const exponentialDelay =
          retryBaseDelayMs * 2 ** (attempt - 1);

        await waitForRetry(
          exponentialDelay + getJitterMs(exponentialDelay),
          options.signal,
        );

        continue;
      }

      if (timedOut) {
        throw new InstagramApiTimeoutError(getTimeoutMs(options.timeoutMs));
      }

      throw error instanceof Error ? error : new Error("Instagram API request failed");
    } finally {
      timeout.cleanup();
    }
  }

  throw new Error("Instagram API request failed after retries");
}
