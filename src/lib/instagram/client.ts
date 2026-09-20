import "server-only";

const INSTAGRAM_API_VERSION = "v26.0";
const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;
const DEFAULT_TIMEOUT_MS = 30_000;

export type InstagramApiErrorDetails = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

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

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromCaller = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    },
  };
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

export async function instagramApiRequest<T = unknown>(
  path: string,
  options: InstagramApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const params = { ...(options.params ?? {}) };

  if (options.accessToken) {
    params.access_token = options.accessToken;
  }

  const url = buildUrl(path, params);
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
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });

    const data = await parseResponse(response);

    if (!response.ok || (data && typeof data === "object" && "error" in data)) {
      const details =
        data && typeof data === "object" && "error" in data
          ? ((data as { error?: InstagramApiErrorDetails }).error ?? undefined)
          : undefined;

      const message =
        details?.message ||
        `Instagram API request failed with status ${response.status}`;

      console.error("[Instagram API]", {
        method,
        path,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        errorCode: details?.code,
        errorSubcode: details?.error_subcode,
      });

      throw new InstagramApiError(message, {
        status: response.status,
        details,
        response: data,
      });
    }

    console.log("[Instagram API]", {
      method,
      path,
      status: response.status,
      latencyMs: Date.now() - startedAt,
    });

    return data as T;
  } catch (error) {
    if (error instanceof InstagramApiError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Instagram API request failed";

    console.error("[Instagram API]", {
      method,
      path,
      status: "network-error",
      latencyMs: Date.now() - startedAt,
      error: message,
    });

    throw error instanceof Error ? error : new Error(message);
  } finally {
    timeout.cleanup();
  }
}

export const INSTAGRAM_API_VERSION = INSTAGRAM_API_VERSION;
export const INSTAGRAM_GRAPH_URL = INSTAGRAM_GRAPH_URL;
