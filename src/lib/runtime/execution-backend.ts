/** The current Vercel deployment keeps Workflow API as its default.
 * Self-hosted Node/VPS deployments use the existing PostgreSQL + Redis workers.
 * Never infer deployment mode from NODE_ENV: both environments run production.
 */
export type ExecutionBackend = "workflow" | "worker";

export function resolveExecutionBackend(env: Partial<Pick<NodeJS.ProcessEnv, "EXECUTION_BACKEND" | "VERCEL">> = process.env): ExecutionBackend {
  if (env.EXECUTION_BACKEND === "workflow" || env.EXECUTION_BACKEND === "worker") {
    return env.EXECUTION_BACKEND;
  }
  if (env.EXECUTION_BACKEND) {
    throw new Error("INVALID_EXECUTION_BACKEND: expected workflow or worker");
  }
  return env.VERCEL ? "workflow" : "worker";
}
