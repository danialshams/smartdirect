import "dotenv/config";

import { getLoadTestConfig } from "./load-test/config";
import { printLoadTestReport } from "./load-test/report";
import { runLoadTest } from "./load-test/runner";

async function main() {
  const config = getLoadTestConfig("load-test-architecture", {
    total: 100,
    concurrency: 8,
    durationMs: 30_000,
  });

  const result = await runLoadTest(config, async () => {
    await Promise.resolve();
  });

  printLoadTestReport(result);

  if (
    result.total !== config.total ||
    result.successful !== config.total ||
    result.failed !== 0
  ) {
    throw new Error("Load test architecture smoke test produced invalid metrics.");
  }

  console.log("175 Load Test Architecture: OK");
}

main().catch((error) => {
  console.error("175 Load Test Architecture: FAILED");
  console.error(error);
  process.exitCode = 1;
});
