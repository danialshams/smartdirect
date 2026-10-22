# Existing PostgreSQL migration-history inconsistency

The historical September 2026 migrations cannot currently be replayed verbatim
into a pristine PostgreSQL database. Migration
`20260923150000_add_account_insight_metrics` already creates `follows`,
and the subsequently applied
`20260923183000_add_advanced_account_insights` attempts to create it again,
causing SQLSTATE 42701 / Prisma P3018 on fresh databases.

**Do not edit or reset migrations that were already applied in Production.**
Use a checksum-preserving baseline plan for brand-new environments.
Until that baseline is formally introduced, CI verifies the *current* Prisma
schema with `prisma db push` against isolated PostgreSQL and then tests that
the *new* durable webhook migration applies cleanly against that schema with
its new table omitted. This is an integration safety check, not proof that the
historical migration chain is replayable. Document this debt before onboarding
new independent installations.

Production retains its existing migration history and uses the new additive
`20261022173000_durable_webhook_inbox` migration via `prisma migrate deploy`.
Verify Production migration completion before allowing webhook traffic.
