import { execFileSync } from "node:child_process";

// Optional manual production migration helper. Do not call from npm run build.
// CI, preview and production builds must never mutate the production database.
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
