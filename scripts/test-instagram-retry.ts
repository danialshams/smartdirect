import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as any;

let instagramApiRequest: typeof import("../src/lib/instagram/client").instagramApiRequest;
let InstagramApiError: typeof import("../src/lib/instagram/client").InstagramApiError;
let InstagramApiTimeoutError: typeof import("../src/lib/instagram/client").InstagramApiTimeoutError;

async function loadClient() {
  ({
    instagramApiRequest,
    InstagramApiError,
    InstagramApiTimeoutError,
  } = await import("../src/lib/instagram/client"));
}

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

async function test429() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? jsonResponse({ error: { message: "Too many requests", code: 4 } }, 429, {
          "retry-after": "0",
        })
      : jsonResponse({ ok: true }, 200);
  };

  try {
    const result = await instagramApiRequest<{ ok: boolean }>("/test-429", {
      maxRetries: 2,
      retryBaseDelayMs: 0,
    });

    if (!result.ok || calls !== 2) {
      throw new Error("429 retry failed");
    }

    console.log("62 429 retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function test5xx() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    calls += 1;
    return calls < 3
      ? jsonResponse({ error: { message: "Temporary failure" } }, 503)
      : jsonResponse({ ok: true }, 200);
  };

  try {
    const result = await instagramApiRequest<{ ok: boolean }>("/test-5xx", {
      maxRetries: 2,
      retryBaseDelayMs: 0,
    });

    if (!result.ok || calls !== 3) {
      throw new Error("5xx retry failed");
    }

    console.log("51/54 5xx retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testTimeout() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    calls += 1;

    if (calls === 1) {
      await new Promise<void>((resolve) => {
        if (init?.signal?.aborted) {
          resolve();
          return;
        }

        init?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });

      throw new DOMException("The operation was aborted", "AbortError");
    }

    return jsonResponse({ ok: true }, 200);
  };

  try {
    const result = await instagramApiRequest<{ ok: boolean }>("/test-timeout", {
      timeoutMs: 20,
      maxRetries: 1,
      retryBaseDelayMs: 0,
    });

    if (!result.ok || calls !== 2) {
      throw new Error("timeout retry failed");
    }

    console.log("55/63 timeout retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testPermanent4xx() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse(
      { error: { message: "Invalid request", code: 100 } },
      400,
    );
  };

  try {
    let caught: unknown;

    try {
      await instagramApiRequest("/test-400", {
        maxRetries: 3,
        retryBaseDelayMs: 0,
      });
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof InstagramApiError) || caught.status !== 400 || calls !== 1) {
      throw new Error("permanent 4xx handling failed");
    }

    console.log("52/60 permanent 4xx no retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testUnsafePostNoRetry() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ error: { message: "Temporary failure" } }, 503);
  };

  try {
    let caught: unknown;

    try {
      await instagramApiRequest("/test-post", {
        method: "POST",
        maxRetries: 3,
        retryBaseDelayMs: 0,
      });
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof InstagramApiError) || caught.status !== 503 || calls !== 1) {
      throw new Error("unsafe POST retry policy failed");
    }

    console.log("60 unsafe POST no retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testMaxRetries() {
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({ error: { message: "Still failing" } }, 500);
  };

  try {
    let caught: unknown;

    try {
      await instagramApiRequest("/test-max-retries", {
        maxRetries: 2,
        retryBaseDelayMs: 0,
      });
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof InstagramApiError) || calls !== 3) {
      throw new Error("maximum retry count failed");
    }

    console.log("59 maximum retry: OK");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  await loadClient();
  await test429();
  await test5xx();
  await testTimeout();
  await testPermanent4xx();
  await testUnsafePostNoRetry();
  await testMaxRetries();

  console.log(JSON.stringify({
    success: true,
    tests: ["429", "5xx", "timeout", "permanent-4xx", "unsafe-post", "max-retries"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
