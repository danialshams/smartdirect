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

import { getLoadTestConfig } from "./load-test/config";
import { calculateLatency } from "./load-test/metrics";

let instagramApiRequest: typeof import("../src/lib/instagram/client").instagramApiRequest;

async function loadClient() {
  ({ instagramApiRequest } = await import("../src/lib/instagram/client"));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function main() {
  await loadClient();

  const config = getLoadTestConfig("instagram-gateway-load", {
    total: 1_000,
    concurrency: 16,
    durationMs: 120_000,
  });

  const originalFetch = globalThis.fetch;
  const samples: Array<{
    index: number;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    ok: boolean;
  }> = [];

  let fetchCalls = 0;
  let active = 0;
  let maxActive = 0;
  let failed = 0;
  const errors: string[] = [];
  let nextIndex = 0;

  globalThis.fetch = async (input, init) => {
    fetchCalls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);

    try {
      if (init?.method && init.method !== "GET") {
        throw new Error(`Unexpected gateway load-test method: ${init.method}`);
      }

      const url = String(input);

      if (!url.includes("/v26.0/")) {
        throw new Error(`Unexpected Instagram API URL: ${url}`);
      }

      return jsonResponse({
        id: "load-test",
        ok: true,
      });
    } finally {
      active -= 1;
    }
  };

  const startedAt = Date.now();

  try {
    const worker = async () => {
      while (true) {
        const index = nextIndex++;

        if (index >= config.total) {
          return;
        }

        const requestStartedAt = Date.now();

        try {
          const result = await instagramApiRequest<{ ok: boolean }>(
            `/load-test/${index}`,
            {
              accessToken: "load-test-token",
              maxRetries: 0,
              timeoutMs: 5_000,
            },
          );

          const completedAt = Date.now();

          if (!result.ok) {
            throw new Error("Gateway returned an invalid success payload.");
          }

          samples.push({
            index,
            startedAt: requestStartedAt,
            completedAt,
            durationMs: completedAt - requestStartedAt,
            ok: true,
          });
        } catch (error) {
          failed += 1;
          errors.push(
            `Request ${index}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(config.concurrency, config.total) },
        () => worker(),
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const durationMs = Date.now() - startedAt;
  const successful = samples.length;
  const latency = calculateLatency(
    samples.map((sample) => ({
      index: sample.index,
      startedAt: sample.startedAt,
      completedAt: sample.completedAt,
      durationMs: sample.durationMs,
      ok: sample.ok,
    })),
  );

  const success =
    successful === config.total &&
    failed === 0 &&
    fetchCalls === config.total &&
    active === 0 &&
    errors.length === 0 &&
    durationMs <= config.durationMs;

  const result = {
    success,
    name: "instagram-gateway-load",
    durationMs,
    total: config.total,
    successful,
    failed,
    fetchCalls,
    configuredConcurrency: config.concurrency,
    maxActive,
    throughput:
      durationMs > 0
        ? Number((successful / (durationMs / 1000)).toFixed(2))
        : 0,
    latency,
    errors: errors.slice(0, 20),
    networkIsolation: true,
  };

  console.log(JSON.stringify(result, null, 2));

  if (!success) {
    throw new Error(
      `179 Instagram Gateway Load Test failed: ${successful} of ${config.total} requests completed.`,
    );
  }

  console.log("179 Instagram Gateway Load Test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
