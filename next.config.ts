import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["ffmpeg-static"],
  // Home artwork is public and stable, unlike account avatars or private Meta
  // media. Allow normal browsers to reuse the same assets across navigation.
  // Keep browser freshness bounded so future artwork updates aren't immutable.
  async headers() {
    return [{
      source: "/dashboard-art/:path*",
      headers: [{
        key: "Cache-Control",
        value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      }],
    }];
  },
  outputFileTracingIncludes: {
    "/api/instagram/publishing/upload": [
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/instagram/publishing/upload/client": [
      "./node_modules/ffmpeg-static/**/*",
    ],
    "/api/instagram/inbox": [
      "./node_modules/ffmpeg-static/**/*",
    ],
  },
};

export default withWorkflow(nextConfig);
