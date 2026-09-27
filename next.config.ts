import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/instagram/publishing/upload": [
      "./node_modules/ffmpeg-static/**/*",
    ],
  },
};

export default withWorkflow(nextConfig);
