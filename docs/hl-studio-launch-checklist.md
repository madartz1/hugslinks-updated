# HL Studio launch configuration (review-only)
The files in this draft PR are not a deployed or tested service. **DO NOT set HL_STUDIO_BILLING_ENABLED=true before completing the steps below.**

## Required Netlify environment variables
- `STRIPE_SECRET_KEY`: existing server-side Stripe secret
- `HL_STUDIO_WEBHOOK_SECRET`: dedicated verified Stripe endpoint signing secret for `/.netlify/functions/hl-studio-stripe-webhook`
- `HL_STUDIO_PRICE_STARTER`, `HL_STUDIO_PRICE_GROWTH`, `HL_STUDIO_PRICE_PRO`: corresponding recurring monthly Stripe Price IDs (confirm actual dollar amounts)
- `HL_STUDIO_DATABASE_URL`: dedicated Postgres connection string
- `HL_STUDIO_SESSION_SECRET`: at least 32-character unpredictable session HMAC key
- `HL_STUDIO_BILLING_ENABLED=false`: stay false until all release gates pass

## Install database
Run `db/hl-studio-credits.sql` using a migration runner or the trusted database console. Do not put connection strings or keys in GitHub.

## Checkout and billing flow
- Only a signed-in user can call `/.netlify/functions/hl-studio-checkout` with JSON `{"plan":"starter"}`, `growth`, or `pro`.
- Checkout refuses requests until rollout switch is enabled. Brand billing and receipts as HUGSLinks where your payment dashboard allows.
- Success redirect does not assign credits. The signed `invoice.paid` webhook grants credits once per subscription period.
- Member dashboard `/studio/account.html` calls the session-protected `hl-studio-credits` function.
- The original HUGS 333 membership records and hooks remain separate.

## Unfinished mandatory integrations and audits
1. Implement identity provider login, logout, secure HMAC cookie issuance/rotation with HttpOnly, Secure, SameSite=Lax, CSRF protections, and confirmed-email account association. `_hl-studio-auth.mjs` currently *only validates* sessions, it does not establish them.
2. Review webhook handling for subscription updates, billing invoices (including 2026 Stripe API shapes), upgrade/downgrade proration, canceled states, and event reordering. Test with Stripe CLI / test-mode invoices. Missing invoice metadata or period must never grant credits.
3. Rework `_hl-studio-ledger.mjs` reservation concurrency/idempotency before calling any paid provider. The current ledger is scaffolding, not approved under simultaneous first attempts or repeated request keys.
4. Connect all paid generation endpoints to server-enforced reservation / success finalization / refund. There is no working OpenAI generation route on the current main branch.
5. Write automated tests against test database: 10 standard images max for starter; simultaneous reservations; replay invoice webhook; refund failed generation; no double spend; account privacy; subscription canceled; expired period; upgrade.
6. Connect a customer-visible pre-checkout summary/acknowledgment, and only then activate purchasing.
7. Confirm merchant statement descriptor and cancellation/support policies on the HUGSLinks customer UI. Required payment-provider/legal text may be visible.
8. Confirm actual monthly tier prices with Stripe and compute sustainable margins with observed image-generation costs.

## Security / operations
Do not expose server keys, Stripe webhooks, or database credentials in browser code. Make signed-in user ID authoritative. Rate-limit generations and webhooks; validate plan IDs and credit rates server-side. Review SQL migrations and handling of multiple active subscriptions prior to running production.

## Latest backend update
The database migration now defines transactional `hl_studio_reserve` and `hl_studio_finish` functions. The server-side ledger calls those functions. This addresses duplicate reservation and atomic settlement at the SQL design level, but the migration has not been run and concurrency tests have not yet been executed. No paid generation endpoint calls these functions yet. Authentication issuance, user registration, and verified email sign-in are still outstanding. Keep rollout disabled.

## Authentication work committed (2026-10-13)
- New `/studio/sign-in.html` asks for an email and six-digit code.
- `hl-studio-request-code` sends codes through Resend, provided the mail sender and database are configured. Per-email throttle is 60 seconds.
- `hl-studio-verify-code` consumes a valid code once, expires codes in 10 minutes, and blocks guesses after five attempts. Signed sessions use an HttpOnly, Secure, SameSite=Lax cookie.
- `hl-studio-logout` clears the cookie.
- New setting `HL_STUDIO_AUTH_ENABLED=false` MUST remain false until verification and abusive-request throttling are tested. Login code issuance additionally requires `RESEND_API_KEY`, `HL_STUDIO_FROM_EMAIL`, `HL_STUDIO_SESSION_SECRET`, and `HL_STUDIO_DATABASE_URL`.
- Remaining before public activation: infrastructure/database migration, sender-domain verification, per-IP/device rate limiting, automated attack/CSRF tests, production login verification, Stripe subscription tests, generation path integration.
- Publishing remains locked; these changes are only in the draft pull request. Do not merge or deploy until explicitly requested by the owner.
