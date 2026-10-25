# Daira / SmartDirect — Meta account-safety and launch checklist

_Last reviewed: 2026-10-26. This checklist supplements Meta's current documentation. It does not imply Meta certification or guarantee that Instagram will never restrict an account._

## Protection now implemented

- Official Instagram OAuth and only the permissions required by currently enabled product features. Never collect Instagram account passwords or simulate device/browser sessions.
- Account-scoped distributed token-bucket rate limits, per-account adaptive concurrency/circuit breaker, and Meta 429/5xx backoff. `content_publishing_limit` remains authoritative; never treat generic usage headers as a guaranteed publishing quota.
- Durable webhook idempotency, account-and-recipient conversation locks, and automated message idempotency.
- An explicit customer DM containing one of the documented STOP phrases deactivates that conversation's automations without affecting any other account/customer. An explicit START reenables it. Merely sending another message does not silently opt them back in.
- Central outbound automation adapter blocks STOP recipients and rejects ordinary automated DMs without an inbound message from the recipient in the prior 24 hours. `HUMAN_AGENT` is not used to extend automated replies.
- Product-level per-recipient burst cap of 20 automated outbound messages per 10 minutes, across workers and automation types via Redis. **This is an internal anti-abuse bound, not Meta's official limit.** Monitor legitimate user impact before retuning it.
- Existing automated Smart Reminders are also constrained to standard 24-hour window with a five-minute margin, skip after the conversation changes, and honor conversation activity/handoff state.
- A post comment alone never authorizes a new normal DM. For a comment that triggers a follow-gate, send at most one initial text-only Private Reply referencing the comment and ask the commenter to initiate a direct message with the configured follow-check keyword. Only the subsequent DM permits normal dialogue and gate release. Live comment flow is independently one-Private-Reply-only.
- Explicit gate postbacks are stored as inbound interactions before follow-up replies.
- OAuth token response bodies and sensitive Graph query values are redacted from error/debug logs. Never log decrypted access tokens, app secrets, authorization codes, or full callback URLs.

## Product behavior and tradeoffs

- When a recipient opts out, all automated DM/Private Reply sends stop, including from newly created rules, remounts and delayed jobs. Support staff see a refusal to send even manually until that recipient sends START.
- STOP/START are exact, normalized user messages. Treat these as service commands; do not match arbitrary sentences containing the words.
- `Conversation.isActive` is used as the durable opt-out switch (there is no schema migration). Existing code paths must never set it back to true on every inbound message or outgoing echo. New code should check it and honor explicit START.
- Human operators should be able to explain why a message was suppressed, without claiming it was sent.
- Meta's 24-hour standard messaging window is independent of the special one-time Private Reply permission for comments. Neither opens an unlimited DM conversation.
- Do not use randomness, proxies, account rotation or artificial human-like typing to evade anti-spam detection.
- Do not auto-send promotional content using a HUMAN_AGENT message tag.
- Do not promise a user will never be restricted or disabled by Meta; reports, content policy violations, consumer complaints, copyright, and Meta discretionary enforcement remain out of the app's direct control.

## Operational checks before onboarding public customer accounts

1. Confirm the actual Instagram Professional login permissions and scope list in Meta Developer Dashboard; the repository cannot reveal App Review / Advanced Access status.
2. Obtain required Business Verification and complete App Review / Advanced Access for every scope needed for non-role customer accounts. Standard Access is intended for roles/testers. Check Data Use Checkup and any current data handling requirements.
3. Exercise Meta's exact private-reply eligibility, seven-day expiry, one-private-reply-per-comment rule, story reply, Live ending, and follow-gate postback with disposable consenting test users. Confirm Meta responses and real recipient IDs for the Instagram Login variant used.
4. Confirm all enabled automated message templates comply with content, commerce, data privacy and platform rules. Provide consent language and appropriate bot disclosure for locales where required; do not automatically append unapproved marketing copy or links.
5. Test STOP, START, multiple Instagram accounts, repeated comments, duplicate webhook deliveries, a busy conversation, old messages, human handoff, Redis failures and transient Graph failures.
6. Set up support operations for account warnings and user reports; alert operators on sustained Meta errors (190, 429, suspicious-activity, permission denial), high business-use-case usage and repeated user opt-outs.
7. Run formal security review of stored OAuth tokens and encryption-at-rest before onboarding customers. Token access is protected by database credentials and code-level authorization, but the existing `accessToken` database column is currently written in plaintext. Migrating existing production values requires a dedicated rollout with encryption key provision and backward-compatibility; **this checklist does not claim encryption at rest has been implemented**.
8. Publish up-to-date privacy, deletion, and terms/acceptable-use statements explaining automated replies, recipient opt-out, consent, human intervention, media retention and customer responsibilities.
9. Do not use Meta or Instagram partnership badges/logos as proof of approval unless your specific brand usage is permitted by Meta.
10. Verify externally that Vercel production was built from a master commit whose full GitHub Actions CI passed. Use the authenticated browser/mobile test to confirm no legitimate workflow was blocked by guards.

## Ongoing monitoring

- Keep an account-scoped record of Meta error codes and rate-limit feedback without logging secrets or full user message content.
- Review the ratio of successful sends, STOP commands, policy-suppressed sends and support escalations, and distinguish app-level failure from Instagram account-level restrictions.
- Prioritize customer protection above maximization of API throughput; don't retry authorization or policy violations as if they were temporary network failures.
- Customer account enforcement cannot be prevented by a logo, a Meta verification badge, App Review alone or artificial delays.

## Meta documentation

- Meta Developer Policies: https://developers.facebook.com/devpolicy/
- App Review / access levels: https://developers.facebook.com/docs/graph-api/overview/access-levels/
- Instagram Platform docs: https://developers.facebook.com/docs/instagram-platform/
- Instagram Messaging: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
