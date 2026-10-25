# SmartDirect dashboard performance baseline

This benchmark is read-only. It does not trigger publishing, message sending,
automation creation, or mutations. It opens authenticated dashboard pages.

## Local setup (Windows PowerShell)

1. Check out the PR branch and install project dependencies with `npm ci`.
2. Install the browser runner locally without saving it as a project dependency:

   ```powershell
   npm install --no-save playwright
   npx playwright install chromium
   ```

3. Create a **test-user** browser session locally (never send the session file
   to another person or attach it to a public issue):

   ```powershell
   npx playwright codegen --save-storage=.local-auth.json https://YOUR-PRODUCTION-DOMAIN/login
   ```

   Log in manually to your test account, then close the codegen browser.
   Review that `.local-auth.json` exists. It contains session tokens.

4. Run the benchmark:

   ```powershell
   $env:SMARTDIRECT_BASE_URL="https://YOUR-PRODUCTION-DOMAIN"
   $env:SMARTDIRECT_STORAGE_STATE=".local-auth.json"
   $env:SMARTDIRECT_BENCH_RUNS="5"
   node scripts/benchmark-dashboard-navigation.mjs
   ```

The script writes a JSON report under `performance-results/`.
Both the local session file and results folder are in `.gitignore`.

## Measurements

- `firstMainVisible`: navigation to an existing visible `main` element;
  this is **not** necessarily the time the dashboard data becomes usable.
- `lcp`: browser Largest Contentful Paint after a short observation interval;
  a null value means there was no usable entry.
- `apiMax`: longest same-page fetch/XHR resource timing observed.
- `clientUrl`: time to URL change after clicking a genuine route link.
- `clientTextChange`: time for the main element's text to change.
  Text change is only a proxy for useful content, **not** data completeness.
- `p50` and `p95`: computed per route over the requested number of runs.

The script skips SPA routes with no visible matching link on the dashboard.
`skipped` is not a zero latency measurement. In tests of other navigation
origins, add relevant links or use a browser trace.

Run the baseline and comparison on the **same device/profile and location**,
the same account, with consistent cache/network conditions. Compare before
and after builds by commit SHA. GitHub Actions additionally reports
manifest-listed initial JavaScript bytes, which is not a substitute for a
browser benchmark or full bundle analysis.

## Safety

Only use authorized test accounts. Avoid posting cookies, local storage,
user IDs, message contents, or trace archives from real accounts.
Do not merge untested runtime changes into master.
