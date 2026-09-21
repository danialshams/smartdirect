# SmartDirect Production Portability

## Supported deployment shapes

SmartDirect is kept as a standard Next.js Node.js application with a separate long-running queue worker.

### Vercel

- Deploy the Next.js application normally.
- Keep Redis and PostgreSQL external.
- Keep the Meta webhook URL on the Vercel domain.
- Cron routes remain configured through `vercel.json`.
- Do not run the long-lived queue worker inside a request handler.

### cPanel / Node.js hosting

- Use a Node.js application for the Next.js server.
- Run `npm run build` once for the release.
- Run `npm start` for the web process.
- Run the queue worker as a separate persistent process when the host supports one.
- If the host does not support persistent workers, use a VPS or managed worker service rather than moving queue work into HTTP requests.

### VPS

- Run the Next.js server with `npm start`.
- Run `npm run queue:worker` as a separate supervised process.
- Put nginx or another reverse proxy in front of the Node.js server.
- Keep PostgreSQL and Redis external or managed unless the VPS is explicitly provisioned for them.
- Use process supervision (systemd, PM2, Docker, or an equivalent) for both web and worker processes.

## Environment portability

Production secrets are supplied through the environment, not hard-coded in source.

Required server variables:

- `DATABASE_URL`
- `REDIS_DRIVER`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

The Redis layer is currently provider-configured for Upstash REST. This is intentionally independent of Vercel: the same Redis configuration can be used from Vercel, cPanel Node.js, or a VPS.

A future migration from Upstash to another Redis provider must be treated as a Redis-driver migration and tested separately; changing environment variables alone does not migrate Redis-resident queue, lock, idempotency, rate-limit, or cache state.

## Database portability

Prisma receives PostgreSQL only through `DATABASE_URL`. No production database host is embedded in application code.

Database migration procedure:

1. Back up the source database.
2. Provision the target PostgreSQL database.
3. Set the target `DATABASE_URL`.
4. Run Prisma migrations.
5. Restore application data using a controlled backup/restore process.
6. Run the database connectivity and application smoke tests.
7. Switch traffic only after validation.

## Release procedure

1. Build the exact Git commit intended for release.
2. Validate production environment variables.
3. Apply database migrations.
4. Start the web process.
5. Start the worker process.
6. Verify Redis, database, webhook, OAuth, queue, and worker health.
7. Switch the reverse proxy/domain to the new release.
8. Keep the previous release available until smoke tests pass.

## Rollback

Rollback means reverting the application release, not blindly reversing database migrations.

- Keep the previous application artifact/image.
- Revert application traffic to the previous release.
- Do not run destructive down-migrations automatically.
- If a schema change is backward-incompatible, use an explicit forward-fix migration.
- Re-run Redis, database, webhook, queue, and worker health checks after rollback.

## Production-like separation

The web process and worker process are separate runtime concerns:

- Web: `npm start`
- Worker: `npm run queue:worker`

This prevents a serverless/request lifecycle from being treated as a durable queue worker.

## Build output

The Next.js configuration uses standalone output so the application can also be packaged as a small self-contained Node.js runtime for VPS/container deployment.

The normal Node.js deployment remains supported:

```bash
npm ci
npm run build
npm start
```

For Vercel, the platform deployment remains unchanged.
