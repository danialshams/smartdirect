import type { LoadTestLatency, LoadTestSample } from "./types";

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1),
  );

  return sorted[index];
}

export function calculateLatency(samples: LoadTestSample[]): LoadTestLatency {
  const values = samples.map((sample) => sample.durationMs);

  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Number((total / values.length).toFixed(2)),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
  };
}
