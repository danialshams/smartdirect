import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supportChannel, supportRealtimeEnabled, supportRedisUrl } from "@/lib/support/tickets";
import Redis from "ioredis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  if (!supportRealtimeEnabled()) return new Response("SSE unavailable; use polling", { status: 503, headers: { "Cache-Control": "no-store" } });
  const channel = supportChannel(session.user.id);
  const encoder = new TextEncoder();
  let subscription: Redis | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (subscription) { subscription.disconnect(); subscription = null; }
    try { controllerRef?.close(); } catch { /* already closed */ }
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      controller.enqueue(encoder.encode(": ready\n\n"));
      heartbeat = setInterval(() => {
        if (!closed) try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { close(); }
      }, 20_000);
      const redis = new Redis(supportRedisUrl(), { lazyConnect: true, connectTimeout: 1800, maxRetriesPerRequest: 1, enableOfflineQueue: false });
      subscription = redis;
      redis.on("error", () => close());
      redis.on("message", (name, payload) => {
        if (closed || name !== channel) return;
        try { controller.enqueue(encoder.encode("event: support\ndata: " + payload + "\n\n")); } catch { close(); }
      });
      void redis.connect().then(() => redis.subscribe(channel)).catch(close);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel: close,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}