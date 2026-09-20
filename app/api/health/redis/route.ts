import { NextResponse } from "next/server";

import { redisHealthCheck } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await redisHealthCheck();

  return NextResponse.json(
    {
      service: "redis",
      ...health,
      timestamp: new Date().toISOString(),
    },
    {
      status: health.ok ? 200 : 503,
    },
  );
}
