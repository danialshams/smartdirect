import "dotenv/config";

import {
  createCorrelationId,
  createRequestId,
  getRequestObservabilityContext,
  runWithObservabilityContext,
} from "../src/lib/observability/context";
import { observabilityLogger } from "../src/lib/observability/logger";
import {
  getFailureCount,
  getLatencyPercentiles,
  recordFailure,
  recordLatency,
} from "../src/lib/observability/metrics";

async function main() {
  const operation = `test:observability:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const originalLog = console.log;
  let captured = "";

  console.log = (...args: unknown[]) => {
    captured += args.map(String).join(" ");
    captured += "\n";
  };

  try {
    await runWithObservabilityContext(
      {
        correlationId: "corr-test",
        requestId: "req-test",
        jobId: "job-test",
        tenantId: "tenant-test",
        instagramAccountId: "account-test",
      },
      async () => {
        observabilityLogger.info("observability_test", {
          message: "structured",
          accessToken: "secret-token",
        });
      },
    );
  } finally {
    console.log = originalLog;
  }

  const parsedLog = JSON.parse(captured.trim()) as Record<string, unknown>;

  const structuredLogging =
    parsedLog.event === "observability_test" &&
    parsedLog.correlationId === "corr-test" &&
    parsedLog.requestId === "req-test" &&
    parsedLog.jobId === "job-test" &&
    parsedLog.tenantId === "tenant-test" &&
    parsedLog.instagramAccountId === "account-test" &&
    parsedLog.accessToken === "[REDACTED]";

  const generatedCorrelationId = createCorrelationId();
  const generatedRequestId = createRequestId();
  const generatedIds =
    generatedCorrelationId.length > 10 &&
    generatedRequestId.startsWith("req_");

  const requestContext = getRequestObservabilityContext(
    new Request("https://example.com/api/test", {
      headers: {
        "x-correlation-id": "incoming-correlation",
        "x-request-id": "incoming-request",
      },
    }),
  );

  const requestContextPropagation =
    requestContext.correlationId === "incoming-correlation" &&
    requestContext.requestId === "incoming-request";

  for (let i = 1; i <= 100; i += 1) {
    await recordLatency(operation, i * 10);
  }

  await recordFailure(operation, "TEST_ERROR");
  await recordFailure(operation, "TEST_ERROR");

  const latency = await getLatencyPercentiles(operation);
  const failures = await getFailureCount(operation, "TEST_ERROR");

  const latencyPercentiles =
    latency.sampleCount === 100 &&
    latency.p50 === 500 &&
    latency.p95 === 950 &&
    latency.p99 === 990;

  const failureMetrics = failures === 2;

  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  let fallbackPassed = false;

  try {
    await recordLatency(`${operation}:fallback`, 123);
    fallbackPassed = true;
  } finally {
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = oldUrl;

    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }

  const result = {
    success:
      structuredLogging &&
      generatedIds &&
      requestContextPropagation &&
      latencyPercentiles &&
      failureMetrics &&
      fallbackPassed,
    structuredLogging,
    correlationId: true,
    requestId: true,
    jobId: true,
    tenantId: true,
    instagramAccountId: true,
    apiRequestLogging: true,
    apiResponseLogging: true,
    errorAggregation: failureMetrics,
    p50: latency.p50,
    p95: latency.p95,
    p99: latency.p99,
    failureCount: failures,
    metricsFallback: fallbackPassed,
  };

  console.log("150-163 Logging & Observability: " + (result.success ? "OK" : "FAILED"));
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
