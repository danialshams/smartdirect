import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard=await requireAdmin();
  if(guard.response)return guard.response;
  const startedAt = Date.now();

  try {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    if (!url || !token) {
      return NextResponse.json(
        {
          service: "upstash-rest",
          ok: false,
          configured: false,
          error: "Service unavailable",
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    const redis = new Redis({ url, token });
    const key = "smartdirect:health:test";
    const value = `ok-${Date.now()}`;

    await redis.set(key, value, { ex: 60 });
    const result = await redis.get<string>(key);

    return NextResponse.json({
      service: "upstash-rest",
      ok: result === value,
      configured: true,
      latencyMs: Date.now() - startedAt,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        service: "upstash-rest",
        ok: false,
        configured: true,
        latencyMs: Date.now() - startedAt,
        error: "Service unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
