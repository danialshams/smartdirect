import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  outputFileTracingIncludes: {
    "/api/instagram/publishing/upload": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },
};

export default withWorkflow(nextConfig);
