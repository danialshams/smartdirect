import { execFileSync } from "node:child_process";

// Only the production Vercel build performs automatic schema migrations.
// CI and preview builds use placeholder or separate databases and must not mutate production data.
if (process.env.VERCEL_ENV === "production") {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("The production database URL is required for Prisma migrations.");
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
    timeout: 180_000,
  });
}
