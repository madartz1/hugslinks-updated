# HL Studio metered AI credits: implementation contract

Status: PROPOSED ONLY. This branch ships a public-readable, noindex plan disclosure preview at /studio/plans.html. It does not activate checkout or claim a working account ledger.

## Proposed plans
Starter 19 USD / 100 monthly credits; Growth 39 USD / 300; Pro 79 USD / 800. Growth and Pro Stripe prices must be verified before enabling purchases. Eligible tools: text 1, standard image 10, premium image 25, card assembly 2, standard image revision 10. Video/music excluded until separately priced. Credits expire on renewal; no rollover. Usage failures are not billed.

## Before Stripe Checkout
- Authenticated member must choose plan; server resolves the Stripe price ID from a fixed allowlist. NEVER accept price ID, credit count, amount, or account ID from client.
- Show and confirm plan name, recurring dollar amount, included credits, credit schedule, per-action rates and exclusion list before creating a Stripe Checkout Session.
- Stripe checkout session uses server-mapped price IDs and customer/account mapping. Store user ID in metadata or customer mapping, not as source of truth from client.
- Webhook verifies Stripe signature; deduplicates events by event ID; subscription status + renewal event controls entitlements. Confirm billing lifecycle via invoice.paid (not merely the success redirect).
- Entitlements for a renewal should be idempotently granted exactly once per subscription billing period, based on Stripe subscription + period identifier.
- Cancellation, failed payment, upgrades and downgrades require clearly specified entitlement policy and portal UX.

## Database schema and enforcement
Requires authenticated server-side database with atomic transactions. Example PostgreSQL:
- subscriptions(user_id, stripe_customer_id, stripe_subscription_id UNIQUE, plan, status, period_start, period_end)
- credit_periods(id, user_id, subscription_id, period_start, period_end, allowance, UNIQUE(subscription_id, period_start))
- credit_events(id, period_id, user_id, request_key, type, delta, action, output_id, created_at, UNIQUE(user_id, request_key, type))
- generation_jobs(id, user_id, period_id, request_key UNIQUE scoped to user, action, reserved_credits, status, output_ref, created_at, updated_at)

For each request: validate session on server; read price table from server; ensure paid active subscription/current billing period; validate action; check per-day throttle; reserve sufficient credits in a transaction with row locking or conditional atomic UPDATE; reject insufficient balance before calling model provider; use idempotency key to return prior job; finalize successful generation by settling reservation exactly once and recording output metadata; on failure release reservation (including timeout cleanup). Avoid exposing API keys in browser. Handle concurrent requests by serializable transaction, locking or atomic conditional decrement. Never mark generation successful from a client callback alone.

## Member dashboard
Authenticated GET /api/member/credits returns plan, allowance, available, reserved, used, renewal date and paginated generation history tied to session user ID. Never accept arbitrary user IDs in client query. Each entry shows date, tool, credits charged, status, and output link if safe. Privacy: do not expose other users' prompts or outputs.

## Tests needed to launch
- Checkout plan disclosure displayed before redirect.
- Unsupported plan/price parameters rejected by checkout server.
- Unauthenticated/expired/unpaid account rejected.
- 100 credits -> 10 standard images, 11th rejected.
- Concurrent 10-credit requests cannot overspend 5-credit balance.
- Replayed webhook and retried generation request never double-charge.
- Failed provider generation releases reservation.
- Billing renewal grants exactly one allowance.
- Generation history isolated per authenticated user.
- Rate limiter and spending ceiling reject expensive abuse.
- Upgrade/downgrade, cancel, refund and disputed payment tested.

## Repository finding (2026-10-13)
Default branch /studio/index.html currently shows Under Construction, and checked paths netlify/functions/hl-studio-checkout.mjs and hl-studio-stripe-webhook.mjs returned 404. Existing account/AI call plumbing must be identified before adding secure backend enforcement; inventing a balance in localStorage would not be secure.

## Implementation safety gate (2026-10-13)
The initial `_hl-studio-ledger.mjs` is **not approved as a production transaction layer**: the reservation SQL needs a concurrency/idempotency review and integration tests under parallel requests; do not connect it to an AI provider yet. The sign-in token validator is provided, but a verified account login/token-issuance flow is not yet implemented. The SQL migration has not been applied to a live database. The dashboard at `/studio/account.html` intentionally shows an unauthenticated message until identity and billing are connected. No live purchases or AI metering have been enabled.

Customer-facing branding uses HUGSLinks Studio; payment processor references are for internal documentation and legal/payment disclosures only, not the product name.
