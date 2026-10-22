export type MetaUsageSample = {
  source: "business" | "app";
  maxUsagePercent: number;
};

const USAGE_FIELDS = new Set(["call_count", "total_time", "total_cputime"]);

/** Aggregate only numeric utilization percentages; never log raw response
 * headers (which may contain business/account identifiers). */
export function readMetaUsageHeaders(headers: Pick<Headers, "get">): MetaUsageSample | null {
  for (const [key, source] of [
    ["x-business-use-case-usage", "business"],
    ["x-app-usage", "app"],
  ] as const) {
    const raw = headers.get(key);
    if (!raw) continue;
    try {
      const obj: unknown = JSON.parse(raw);
      let maxUsagePercent = -1;
      const visit = (item: unknown, depth: number) => {
        if (depth > 6 || !item || typeof item !== "object") return;
        if (Array.isArray(item)) {
          for (const v of item) visit(v, depth + 1);
        } else {
          for (const [name, v] of Object.entries(item)) {
            if (USAGE_FIELDS.has(name) && typeof v === "number" && Number.isFinite(v)) {
              maxUsagePercent = Math.max(maxUsagePercent, v);
            } else if (v && typeof v === "object") visit(v, depth + 1);
          }
        }
      };
      visit(obj, 0);
      if (maxUsagePercent >= 0) {
        return { source, maxUsagePercent };
      }
    } catch {
      // Header shape is not contractual across all Instagram products.
    }
  }
  return null;
}
