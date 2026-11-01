import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["ffmpeg-static"],
  // Home artwork is public and stable, unlike account avatars or private Meta
  // media. Allow normal browsers to reuse the same assets across navigation.
  // Keep browser freshness bounded so future artwork updates aren't immutable.
  async headers() {
    return [
    {
      source: "/:path*",
      headers: [
        {key:"X-Content-Type-Options",value:"nosniff"},
        {key:"Content-Security-Policy",value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests"},
        {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
        {key:"X-Frame-Options",value:"DENY"},
        {key:"Permissions-Policy",value:"camera=(), microphone=(self), geolocation=(), payment=()"},
        {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
      ],
    },
    {
      source: "/dashboard-art/:path*",
      headers: [{
        key: "Cache-Control",
        value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      }],
    }, {
      // Keep the user's exact approved PNG pixels. Reuse its bytes rather
      // than converting the logo to a potentially different WebP/SVG.
      source: "/daira-header-logo-original.png",
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
