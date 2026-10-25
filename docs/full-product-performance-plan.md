# Full-product performance coverage plan

This is a coverage inventory and safe measurement plan, not a claim that every
feature has already been benchmarked. It preserves the Daira Liquid Glass
effects and does not change Meta automation, persistence or API behavior.

## What has actually been measured

- Authenticated document navigation for seven main pages (5 samples each).
- Client navigation from Home to six of those pages (5 samples each).
- LCP, early main visibility and short-observation-window layout shifts.
- No complete data-ready measurement yet; no authenticated write/edit/delete,
  upload, send or publish completion timing yet.

The production tests used a desktop Chromium configured to a 390x844 viewport,
not a CPU/network-throttled physical mobile device. A five-run p95 is just the
largest observation, not a production SLO or reliable percentile.

## Route and endpoint inventory

After a production build run:

```powershell
node scripts/report-dashboard-performance-coverage.mjs
```

This produces `performance-results/dashboard-performance-coverage.json` and
lists dashboard page routes, parameterized routes needing fixture IDs and API
handlers with declared GET/POST/PUT/PATCH/DELETE methods. It does not call
any API or measure latency.

## Back/forward navigation and images (read-only)

Run only with an authorized disposable test-user session:

```powershell
git pull origin master
$env:SMARTDIRECT_BASE_URL="https://smartdirect.vercel.app"
$env:SMARTDIRECT_STORAGE_STATE=".local-auth.json"
$env:SMARTDIRECT_REVISIT_RUNS="2"
node scripts/benchmark-dashboard-revisits.mjs
```

It navigates to every visible Home tool card using actual Next links and
returns using browser history, recording page transition and Home revisit
times, plus response-event counts for dashboard artwork observed shortly after
returning Home. The test no longer waits for the page's `load` event after SPA
navigation. Per-route timeouts are written to the result JSON rather than
ending the test early. Response counts are **not** measured transfer bytes,
and do not establish whether an image was served from browser cache.
The JSON report is gitignored. Do not upload Playwright storage state.

Existing Next/Image optimizations and browser HTTP caches should be reused
where available. Never force a reload of static imagery for navigation.
However, do not cache private API responses publicly or keep mutable
Instagram data indefinitely.

## Full action-performance coverage (requires a disposable environment)

Actions must be exercised using a seeded **staging/test** database and test
Instagram account, and with an intentional test harness that knows expected
side effects. Never run the following POST/PUT/PATCH/DELETE tests against real
customer data or a live production Instagram account.

| Area | Required actions |
|---|---|
| Comment/Story/DM/Share/Live automation | List, create, validate, save, edit, activate, deactivate, delete, restore state |
| Smart reminders, menus, icebreakers | List, create/update, validate and delete |
| Publishing | Choose/convert/upload, schedule, edit, cancel, remove files, publish to test account |
| Inbox | List conversations, open/search, paginate, send test text/media/voice and show status |
| Insights | First view, account/date change, cached revisit, refresh and chart render |
| Support | List, open, create test ticket, reply, mark read, return |
| Account selection | Switch accounts and verify caches/data never leak across accounts |

Record **four separate clocks**: input-to-feedback (spinner/optimistic update),
input-to-request-start, request-start-to-server-completion, and action-to-UI
confirmation. Also record network bytes, redundant requests, render long
tasks, retry/error rates, database timing and resulting record correctness.

For every action record p50/p95 (at least 20 samples per repeatable,
non-destructive staging action), cache-cold vs cache-warm, fast vs throttled
network, and mobile mid-tier CPU. Re-run correctness and tenant isolation tests
after optimizations. No UI motion/effect changes to improve benchmark scores.

## Data freshness contract

- Immutable/static artwork: let HTTP and Next/browser caches reuse bytes and
  decoded assets; do not download again unnecessarily.
- Aggregated Home counters: scoped to current user/account, show the most
  recent memory snapshot on return, revalidate in background, keep no-store on
  the protected server endpoint.
- Automation lists: existing account-scoped session storage and background
  revalidation are present. Mutations must update/invalidate the same data.
- Publish jobs: existing client cache preserves recent list. A mutation must
  immediately update/invalidate affected state; server remains authoritative.
- Inbox: show preserved UI selection where safe, never replace a live
  conversation or unread status with indefinitely stale messages.
- Support: read access can be cached cautiously, but replies, permissions,
  read flags and cross-account changes require prompt refresh.

Showing a skeleton repeatedly for already cached content is unnecessary.
Skipping all network refreshes is not acceptable for live or security-scoped
data. Do not conflate navigation URL timing with data-ready or action completion.


## Isolated write-operation benchmark in CI

The required GitHub Actions build now executes
`scripts/benchmark-dashboard-crud-latency.ts` against a disposable tenant on
the local PostgreSQL service **after** `prisma db push`. The script refuses to
run unless `NODE_ENV=test` and the database host is loopback. It creates no
external Instagram/Meta actions, sends no DM, performs no live S3 upload and
deletes its throwaway tenant with cascading children after collecting results.

The measured portions include:

- Automation: create with nested message, metadata list, activation toggle,
  edit, delete with nested message cleanup
- Smart reminders: create, list with candidates, edit, delete
- Support: create with first message, list with latest reply and unread-count
  query, reply, detail, close and reopen
- Publishing: create draft with linked media metadata, list with media, edit
  draft, remove draft

Each operation is sampled 20 times, with p50/p95/min/max reported in
`performance-results/dashboard-isolated-crud.json` and GitHub Actions job
summary. No speed targets are enforced on shared CI hardware. The output is
archived as an artifact named `dashboard-isolated-crud` for 14 days.

**Scope:** these are Prisma/database-operation timings on GitHub Actions,
not full authenticated HTTP route timings or browser input-to-confirmation
latency. Publishing real media conversion/transfer and Meta completion,
Instagram inbox sending, story automation activation, and user-perceived
navigation/CLS still require separate measurements. A claim that "all product
features are at maximum speed" would be unsupported by this benchmark alone.

The per-action measurements provide a consistent baseline for subsequent
server query changes and help decide where further optimization is justified
rather than guessing from UI loading indicators.
