# Daira — VPS migration runbook (not active yet)

This is a **future deployment path**. Until the user purchases a VPS,
production stays on Vercel. Do not change `vercel.json`, production
`STORAGE_PROVIDER`, current Meta webhook URL or Git integration.

## What stays identical

- Next.js API/routes, authentication, Instagram automation engine, Prisma,
  PostgreSQL, Redis queue/traffic limiter, and persistent webhook inbox.
- On Vercel, `resolveExecutionBackend()` defaults to `workflow`.
  Existing Vercel Workflow and scheduled jobs behave as before.
- On self-hosted Node.js, it defaults to `worker`. Webhook dispatches
  through durable PostgreSQL -> Redis queue, and scheduled publishing jobs
  are dispatched by the always-on worker every 15 seconds.
- Set `EXECUTION_BACKEND=worker` explicitly on VPS to avoid ambiguity.

## When the VPS exists

1. Set up Node 22, Docker Engine, Docker Compose, a TLS reverse proxy and
   a persistent database (managed Postgres is acceptable).
2. Copy `deploy/vps/.env.vps.example` to **repo root** `.env.vps` and
   fill in real values. Do not commit it, put it in logs, or share it.
3. Restore the existing PostgreSQL database with a verified backup,
   including migration records. Historical migration baseline has an
   outstanding duplicate `follows` column migration, documented in
   `docs/EXISTING-MIGRATION-HISTORY-DEBT.md`.
   Fix/baseline this before provisioning a **new empty** database.
4. Before restarting the app, run migrations exactly once against the
   correct database: `npm run db:migrate:status`, then
   `npm run db:migrate:deploy`. VPS build does **not** run migrations.
5. Run `docker compose -f docker-compose.vps.example.yml --env-file .env.vps up -d --build`.
   The web binds only to localhost port 3000; Redis is internal to Docker.
   Configure a reverse proxy with TLS before routing public traffic.
6. Run the web and worker containers independently. Worker restart policies
   are built into Compose; monitor restart count, Redis AOF volume,
   PostgreSQL connections and due scheduled-publishing jobs.
7. Configure an external/supervised scheduler for maintenance:
   - `/api/cron/instagram-insights`: daily
   - `/api/cron/cleanup-story-automations`: daily
   - `/api/cron/cleanup-publishing-storage`: daily
   - `/api/instagram/refresh-tokens`: daily
   - `/api/cron/webhook-inbox`: every 1–5 minutes **only as fallback**
   These endpoints use `Authorization: Bearer <CRON_SECRET>`.
   Do not run Vercel Cron and VPS maintenance jobs against the same
   database while both deployments are live.
8. Storage: switch to `STORAGE_PROVIDER=s3-compatible`. That provider
   already exists; the upload route supports non-Vercel `server-upload`.
   Provide HTTPS-publicly-reachable media URLs accessible to Meta and
   ensure the user-uploaded media is deleted according to storage TTL.
   Do not use `local` without durable volumes and public routing.
9. Cut over Meta webhook callback only after staging test events work.
   Rotate relevant environment URLs/credentials deliberately, never
   during an active live automation test.
10. Verify signed webhook, Inbox -> queue -> Worker, DM/comment/story
    automation, publishing, scheduled publishing/reschedule/cancel,
    media storage/cleanup, token refresh, rate limits, reconnect, and
    latency metrics. Load/chaos testing is an additional production gate.

## Important limitations to resolve before actual cutover

- A crash **between the scheduled-publishing CAS and Redis enqueue**
  can leave a `PROCESSING` row without a queue job. It must be
  reconciled manually or by a fully durable publishing-outbox design
  before high-availability launch. Do **not** blindly replay stale
  PROCESSING rows: Meta could already have accepted the publish.
- Instagram/Meta remote-send exactly-once delivery is not guaranteed
  merely by Redis or the webhook Inbox. Audit outbound idempotency before
  production high-volume usage.
- S3 upload/public URL/cleanup and Compose image smoke tests must be
  exercised on real infrastructure before switching production traffic.
- Preserve the Vercel-compatible workflow paths until VPS launch.
- Keep the production Vercel release migration helper unchanged during
  this preparation stage. No VPS configuration should affect it.

## Checks before buying VPS

- GitHub PR CI: the existing Vercel build + regression suite passes;
  portable backend selection and due-publishing recovery tests pass.
- `docker compose -f docker-compose.vps.example.yml config` succeeds.
- A local Docker integration smoke test proves both containers boot
  and a Worker can claim a queue item. Do not interpret the sample
  Compose file as evidence of production capacity.
