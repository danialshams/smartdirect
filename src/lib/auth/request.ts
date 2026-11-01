import type { NextRequest } from "next/server";
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}
export function clientIp(request: NextRequest) {
  return (request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 80);
}
export const privateHeaders = { "Cache-Control": "no-store, max-age=0" };
