import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { enqueueJob, getJob, deleteJob } from "../src/lib/queue/core";
import { disconnectRedis } from "../src/lib/redis/client";

async function main() {
  const namespace = "multi-process-" + Date.now();
  const total = 240;
  const jobs = await Promise.all(Array.from({ length: total }, (_, i) =>
    enqueueJob("TEST", { message: "synthetic-" + i }, {
      queueNamespace: namespace,
      instagramAccountId: "test-account-" + (i % 3),
      orderingKey: "test-account-" + (i % 3) + ":participant-" + (i % 30),
      maxAttempts: 1,
    })));
  const workers: ChildProcess[] = [];
  const errors: string[] = [];
  const started = Date.now();
  try {
    for (let i = 0; i < 4; i++) {
      const child = spawn(process.execPath, ["--import", "tsx", "scripts/test-multi-worker-child.ts", namespace], {
        cwd: process.cwd(), env: { ...process.env }, stdio: ["ignore", "ignore", "pipe"],
      });
      child.stderr?.on("data", chunk => { errors.push(String(chunk).slice(0, 1200)); });
      workers.push(child);
    }

    let completed = 0;
    while (Date.now() - started < 60_000) {
      const states = await Promise.all(jobs.map(job => getJob(job.id)));
      completed = states.filter(job => job?.status === "completed").length;
      const failures = states.filter(job => job?.status === "failed");
      if (failures.length) throw new Error("FAILED_WORKER_JOBS:" + failures.map(j => j?.id).join(","));
      if (completed === total) {
        assert(states.every(j => j?.attempts === 1), "duplicate claims must not occur");
        const elapsed = Date.now() - started;
        console.log(JSON.stringify({
          success: true, test: "real-multi-process-workers",
          workerProcesses: workers.length, processed: completed,
          elapsedMs: elapsed, throughputJobsPerSecond: Number((1000 * completed / elapsed).toFixed(1)),
        }));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error("MULTI_PROCESS_TIMEOUT:" + completed + "/" + total + " " + errors.slice(-4).join(" "));
  } finally {
    for (const child of workers) child.kill("SIGTERM");
    await new Promise(resolve => setTimeout(resolve, 400));
    for (const child of workers) if (child.exitCode === null) child.kill("SIGKILL");
    await Promise.allSettled(jobs.map(job => deleteJob(job.id)));
    await disconnectRedis().catch(() => undefined);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
