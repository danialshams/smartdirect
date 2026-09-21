export type LoadTestStatus = "completed" | "failed";

export interface LoadTestConfig {
  name: string;
  total: number;
  concurrency: number;
  durationMs?: number;
  warmupMs?: number;
  failFast?: boolean;
}

export interface LoadTestSample {
  index: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  ok: boolean;
  error?: string;
}

export interface LoadTestLatency {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface LoadTestResult {
  name: string;
  status: LoadTestStatus;
  durationMs: number;
  total: number;
  successful: number;
  failed: number;
  throughput: number;
  latency: LoadTestLatency;
  errors: string[];
}
