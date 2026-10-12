# HL Studio Stripe launch checklist

## Status
This branch implements server-side checkout creation and a signature-verified subscription webhook. It is **not** a live or end-to-end verified subscription system until the steps below are completed. Merchant authentication and entitlement-gated routes are not implemented; do not advertise account access as enabled.

## Required environment variables (Netlify)
- STRIPE_SECRET_KEY: Stripe secret key (test key for staging)
- HL_STUDIO_STRIPE_WEBHOOK_SECRET: signing secret for the endpoint `/.netlify/functions/hl-studio-stripe-webhook`
- HL_STUDIO_PRICE_STARTER, HL_STUDIO_PRICE_GROWTH, HL_STUDIO_PRICE_PRO: actual recurring Stripe Price IDs
- NETLIFY_DATABASE_URL: Neon Postgres connection string
- URL: canonical HTTPS Netlify site URL

Never commit secret values to GitHub. Configure Stripe webhook delivery for checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, and invoice.payment_failed.

## Acceptance tests before merge / launch
1. Configure Stripe test-mode prices and webhook signing secret.
2. Complete test checkout; confirm no entitlement is created by success redirect alone.
3. Deliver signed webhook and verify database row for correct subscription ID, customer, plan, status, and entitlement.
4. Send unsigned/invalid signature event: expect HTTP 400 and no DB change.
5. Replay webhook: expect idempotent database upsert.
6. Cancel subscription and deliver event: expect entitlement false when Stripe status is canceled.
7. Test failed payment / past_due status: entitlement false.
8. Test unrelated Stripe product: ignored.
9. Test missing configuration: endpoint fails closed.
10. Build authenticated merchant identity and associate it with Stripe customer; enforce server-side entitlement checks on every protected merchant API before enabling paid features.
11. Review Netlify deployment preview, then merge after tests pass. Configure studio.hugslinks.com DNS and TLS separately.

## Current limits
Local commercial drafts are browser-only. No authenticated merchant accounts, video uploads, actual video rendering, published campaign database, or enforced protected routes exist yet.
