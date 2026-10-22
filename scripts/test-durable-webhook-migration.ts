import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

// Test the additive SQL migration against an isolated schema at the version
// represented by schema.prisma, with the new table removed first.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query('DROP TABLE IF EXISTS "WebhookInboxEvent" CASCADE');
    const migration = readFileSync("prisma/migrations/20261022173000_durable_webhook_inbox/migration.sql", "utf8");
    await pool.query(migration);
    const columns = await pool.query<{ column_name: string }>(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ["WebhookInboxEvent"],
    );
    const names = columns.rows.map(row => row.column_name);
    for (const field of ["eventKey", "payload", "nextAttemptAt", "leaseUntil", "completedAt"]) {
      assert(names.includes(field), "Missing migration field: " + field);
    }
    const index = await pool.query(
      'SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2',
      ["WebhookInboxEvent", "WebhookInboxEvent_eventKey_key"],
    );
    assert.equal(index.rowCount, 1, "Unique event-key index must exist");
    console.log("Durable Inbox incremental migration SQL: OK");
  } finally {
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
