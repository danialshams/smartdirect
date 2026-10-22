# Durable Webhook Inbox — operational runbook

## Guarantee and acknowledgment

Meta requests are HMAC-verified and each supported event is inserted into PostgreSQL
(`WebhookInboxEvent`) **before** returning HTTP 200. Duplicate deliveries retain
the original payload and status by their SHA-256 event key.

Redis and Workflow are acceleration layers, not the source of truth.
The dispatcher uses an expiring database compare-and-swap lease and scans
`PENDING`, stale `DISPATCHING` and stale `DISPATCHED` entries.
A queue job already in waiting/active/delayed state is not enqueued again.

Delivery semantics are **at least once**, not exactly once. A remote Meta send
can succeed just before a worker crashes. Message-send idempotency and Meta
message IDs must be used wherever possible to prevent duplicate user-visible
side effects. A full transactional outbox for each outbound Meta side effect
remains a separate improvement.

## How to run production

- Apply Prisma migrations **before** starting new worker/API code.
- Run `npm run queue:worker` in a supervised VPS container/process with stable
  Redis and PostgreSQL connections. Its inbox rescan runs every 30 seconds.
- The independent fallback endpoint `GET /api/cron/webhook-inbox` accepts
  `Authorization: Bearer <CRON_SECRET>`; schedule it from your VPS or hosted
  scheduler every 1–5 minutes if no dedicated worker exists.
- On Vercel Hobby, built-in Cron Jobs can run **only once daily**; they are not a
  substitute for minute-granularity recovery. Do not configure a */5 cron
  in `vercel.json` on Hobby.
- Alert on `metrics.pending`, `metrics.dispatched`,
  `metrics.oldestPendingAgeMs` and sustained growth in retryable failures.
- Re-test that HMAC secret used by the Meta app equals
  `INSTAGRAM_WEBHOOK_APP_SECRET` or `INSTAGRAM_CLIENT_SECRET`.
- Limit DB retention of completed payloads using an operational housekeeping
  job and a documented privacy retention window.

## Safe failure drill

Stop Redis temporarily, send a **signed** test webhook and confirm it exists in
PostgreSQL with status PENDING. Restart Redis, invoke the recovery job,
run a Worker, and confirm status DONE, a single automation response, and a
nonzero end-to-end latency sample. Repeat while killing the Worker after a Meta
send and before the completion record; compare duplicate outcomes. Run the
same drill with two Worker processes and with Redis failover.
