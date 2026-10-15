# Managed production sandbox

This flow runs only at deploy-preview-14--hugslinks-web-build.netlify.app. It is not a production booking or payment flow.

## Configuration

Uses the existing Netlify function secrets: HL_STUDIO_DATABASE_URL, HL_STUDIO_AUTH_SECRET, HL_STUDIO_PILOT_ADMIN_EMAIL, HL_STUDIO_RESEND_API_KEY, HL_STUDIO_EMAIL_FROM, HL_STUDIO_STRIPE_SECRET_KEY, HL_STUDIO_STRIPE_WEBHOOK_SECRET. Never commit values. Checkout rejects live keys and live Stripe sessions/events.

The existing sandbox webhook destination must point to `https://deploy-preview-14--hugslinks-web-build.netlify.app/.netlify/functions/hl-studio-stripe-webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`, in addition to the existing subscription events. Keep the existing destination/signing secret. Do not create a second endpoint without configuring its corresponding secret.

## Test workflow

1. Submit an explicitly labeled test application at `/studio/hire/` using an inbox you control. The built-in sample uses an invalid email address and cannot receive quotes.
2. As pilot admin, save the amount and complete scope. Include deliverables, formats, schedule, revisions, usage rights and exclusions. Saving refreshes the application list.
3. Select **Email sandbox quote**. Verify recipient and saved scope in the confirmation. No email is sent just by saving a draft. Sent quotes are locked; this initial sandbox does not support quote revisions or resends. Use a separate test application to restart. Email failures restore the draft.
4. Open the private email link in one browser. Its token expires after seven days. Confirm quote details and approve the sandbox quote.
5. Continue to sandbox payment. Use Stripe test payment details only. Never use real card details. Cancel and reopen to verify the same open session is reused.
6. Return to the quote page and refresh payment status. Only a verified webhook marks payment paid. A returned URL is not evidence of payment.
7. Refresh the admin dashboard and confirm quote **paid** and sandbox payment **paid**. Application production status stays separate; payment does not claim the video has been delivered.

## Automated checks

From the repo root, run `npm install --no-save --package-lock=false @electric-sql/pglite`, then `node --test tests/pilot-commerce.test.mjs`. Tests execute the SQL against an in-memory PostgreSQL engine and stub only email/Stripe transport. They check expiry, consent, test-mode guards, saved pricing, retry idempotency, email failure, demo email blocking, delayed events, and duplicate/mismatched webhook handling. No external emails or payments are generated.

## Limits before production

Production host access remains disabled. Confirm real contract terms, refund/cancellation policy, taxes, email delivery, customer identity/quote access policy, quote revisions and recovery, and live webhook configuration before a separate production launch. This implementation sends one quote-review email; it does not send delivery or payment confirmation emails.
