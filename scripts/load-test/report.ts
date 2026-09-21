import type { LoadTestResult } from "./types";

export function printLoadTestReport(result: LoadTestResult) {
  console.log(
    JSON.stringify(
      {
        success: result.status === "completed",
        name: result.name,
        durationMs: result.durationMs,
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        throughput: result.throughput,
        latency: result.latency,
        errors: result.errors,
      },
      null,
      2,
    ),
  );

  if (result.status === "failed") {
    throw new Error(
      `${result.name} failed: ${result.failed} of ${result.total} operations failed.`,
    );
  }
}
