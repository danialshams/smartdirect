# SmartDirect admin rollout — guarded production release

This change is kept on branch `feature/admin-mobile-operations-20261026` until the real production Neon schema and authenticated mobile admin usage are verified.

## Production database findings (read-only inspection on 2026-10-26)

- Production Neon contains the existing `User`, `Subscription` and `_prisma_migrations` tables.
- The new `User.isBlocked`, phone and SMS consent columns, the `SmsCampaign` table and the extra subscription index were absent.
- Four repository migrations were not recorded as applied:
  - `20261025000000_detach_shared_reply_links`
  - `20261025155000_single_active_story_reply`
  - `20261026180000_admin_user_access`
  - `20261026183000_sms_campaign_drafts`
- Counts were **zero** for saved-response references, pending active story reply rules and excess simultaneous story reply rules when inspected. Recheck these immediately before release.
- Database credentials must **never** be added to GitHub, logs, artifacts or PR comments.

## Release procedure

1. Verify the exact Vercel production project and Git SHA. Disable automatic Vercel preview deployments as configured.
2. Take a recoverable point-in-time Neon backup / branch and verify the rollback mechanism **before** applying migrations.
3. Using a trusted restricted environment connected to the **unpooled** production PostgreSQL URL, run `npx prisma migrate status`. Confirm only the four above are pending and that no failed migration is present. Never `prisma migrate reset` or `prisma db push` against production.
4. Review the SQL files in their exact repository order. The first two migrations update historic data (previously zero matching records); the admin changes are additive.
5. Run `npx prisma migrate deploy` using the reviewed branch and trusted environment, then `npx prisma migrate status` to confirm all migrations recorded. Do not edit `_prisma_migrations` manually.
6. Verify existence and types of `User.isBlocked`, `phone`, `phoneVerifiedAt`, `smsConsentAt`, and `SmsCampaign`. Verify old user count and sign-in through a non-admin test account.
7. Confirm all Next.js GitHub Actions checks are successful on the final PR head, **then** merge the PR to `master`. Vercel production auto-deploys only from `master`.
8. On the production dashboard, smoke-test one ADMIN login on mobile, subscription suspension/reactivation, no cross-user account access, exact ticket deep linking, mobile navigation, and Redis/SSE or polling fallback. Restore a suspended test account.
9. If there is an issue, roll back the Vercel deployment first; do not drop existing columns or delete the SMS drafts. Use the verified Neon recovery point only when necessary.

## Runtime caveats

- The monthly under-10k plan needs a connected Instagram professional account whose follower count can be read via Meta; the app rejects eligibility it cannot verify.
- Existing accounts that have **never** been assigned a subscription remain allowed while subscriptions/billing are being rolled out; blocking a user directly still denies access.
- Automatic subscription billing is not enabled. `autoRenew` is only a stored administrative preference.
- The SMS provider is intentionally disconnected. Only drafts can be saved, for users whose verified phone and SMS consent exist.
- Admin notification SSE requires Redis Pub/Sub availability; otherwise the app polls every 3 seconds while visible.
- MUI is removed from the **admin route components**; legacy MUI dependencies are retained where still used by the regular dashboard.
