import { requireAdmin } from "@/lib/admin-auth";
import { adminSupportChannel, supportRealtimeEnabled, supportRedisUrl } from "@/lib/support/tickets";
import Redis from "ioredis";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (guard.response) return new Response("Unauthorized", { status: 403 });
  if (!supportRealtimeEnabled()) return new Response("SSE unavailable", { status: 503 });
  const encoder = new TextEncoder();
  let subscription: Redis | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const close = () => { if (closed) return; closed = true; if (heartbeat) clearInterval(heartbeat); subscription?.disconnect(); try { controllerRef?.close(); } catch {} };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller; controller.enqueue(encoder.encode(": ready\n\n"));
      heartbeat = setInterval(() => { if (!closed) try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { close(); } }, 20000);
      const redis = new Redis(supportRedisUrl(), { lazyConnect: true, connectTimeout: 1800, maxRetriesPerRequest: 1, enableOfflineQueue: false });
      subscription = redis;
      redis.on("error", close);
      redis.on("message", (channel, payload) => { if (closed || channel !== adminSupportChannel) return; try { controller.enqueue(encoder.encode("event: ticket\ndata: " + payload + "\n\n")); } catch { close(); } });
      void redis.connect().then(() => redis.subscribe(adminSupportChannel)).catch(close);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel: close
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
