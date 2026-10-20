# SmartDirect — Smart Reminders

## Behavior

- Configure one reminder per existing **DM** or **Story Reply** automation in `/dashboard/reminders`.
- After a successful automated DM reply is stored, a durable delivery record is created in PostgreSQL.
- A delayed `SMART_REMINDER` job is placed in the existing Redis queue. **No Redis server, key schema, driver, or environment variable change is required.**
- If the customer sends a new DM, Story Reply, or entry-point interaction, pending deliveries are cancelled.
- Right before sending, the worker locks the conversation and checks the rule, account, automation, handoff, last inbound message, last outbound message, and the 24-hour **STANDARD** messaging window with a five-minute safety margin.
- Comment Private Replies do not open the normal DM window; a reminder only becomes eligible after a valid user-initiated conversation.
- Failed sends back off and stop after four attempts; Redis message idempotency and PostgreSQL statuses prevent routine duplicates.
- If Redis misses a delayed job or enqueue fails, the worker scans the durable PostgreSQL records every minute.

## Initial deployment

**Apply the database migration before enabling the new UI:**

```bash
npx prisma migrate deploy
npx prisma generate
```

The new migration is `prisma/migrations/20261020_smart_reminders/migration.sql`.
Existing build scripts generate Prisma Client but **do not apply** database migrations.

**Start or restart the independent queue worker on the VPS** (with the usual existing database and Redis env configuration):

```bash
npm run queue:worker
```

Keep this process running using the existing VPS service manager. The Redis worker is the accurate scheduler; it promotes due delayed jobs on its polling cycle.

## Vercel Hobby testing

Vercel Hobby's built-in Cron feature only supports once-daily invocations, so a five-minute or hourly reminder **cannot be correctly implemented** using a frequent entry in `vercel.json`.

An optional authenticated recovery endpoint is available:

```
GET /api/cron/smart-reminders
Authorization: Bearer <CRON_SECRET>
```

An **external scheduler** can invoke it every minute on serverless test deployments. Keep `CRON_SECRET` in environment secrets; do not embed it in the frontend. Without the queue worker or external scheduler, reminders can be configured but will **not be sent at the planned time** on a serverless-only deployment.

## Validation

```bash
npm run reminders:test
npm run build
```

End-to-end verification:
1. Set a reminder for a DM automation with five minutes' delay.
2. Send a user-initiated DM; confirm the automation replies, then stay silent.
3. Verify exactly one reminder is sent within the standard 24-hour window.
4. Repeat and send a new DM before the reminder due time; verify nothing is sent.
5. Test deactivating or deleting the rule, and a conversation with a more recent outbound message.
6. Verify a delivery past 24 hours, including when Human Agent is enabled, is not sent.

For troubleshooting inspect `SmartReminderDelivery.status` and `lastError` and the `[SMART_REMINDER]` server logs. Statuses include `PENDING`, `PROCESSING`, `SENT`, `CANCELLED`, `SKIPPED`, and `FAILED`.
