import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
};

export default withWorkflow(nextConfig);
