# HUGS Help App restaurant marketplace

## Included
- Restaurant application with authorization consent, photo upload and hashed private access key.
- Merchant menu editor with prices, descriptions, categories, images, optional sizes/choices, sold-out flags and order pause.
- HUGS admin approval before listing a restaurant; existing `HUGS_ADMIN_TOKEN` protects admin operations.
- Public restaurant browse and menu pages; private contact details are excluded.
- Server-priced test checkout with pickup/delivery, delivery ZIP validation and required choices.
- Idempotent test orders; customer tracking; restaurant acceptance/preparation; atomic helper claims; pickup/delivery confirmation.
- Helper account provisioning/deactivation; private recipient details only after helper assignment.
- Per-record strong reads and conditional writes in a dedicated Netlify Blobs store. Media uses separate image records.

## Entry points
`/food-marketplace` or `/restaurant-marketplace.html`; role tabs open merchant, helper and admin dashboards.
The HUGS Help App links to the module. Existing donation, helper, mission, and tracking endpoints are unchanged.

## Deploy and test
Dependencies are already in package.json. Deploy the repository with Netlify Functions and Blobs enabled.
Set `HUGS_ADMIN_TOKEN` if it is not already configured. Do not put it in client files.

1. Register a sample restaurant and save its ID and private access key.
2. Add menu items and images through the merchant dashboard.
3. Open HUGS admin with the existing admin key; approve the restaurant.
4. Browse its menu; place a test delivery within the configured ZIP codes.
5. Restaurant dashboard: accepted → preparing → ready.
6. Admin: issue an approved helper ID and private key.
7. Helper board: claim test delivery → picked up → delivered (with a confirmation note).
8. Customer: refresh status and see the delivery timeline.

Menu/key/order data is server-persisted. Dashboard access keys and the customer's tracking key are retained only in sessionStorage in the browser tab; keep keys separately. Credentials are bearer credentials, so anyone with one can access the corresponding role. No self-service key recovery, notifications, automated routing, GPS tracking, or payment processing is included yet.

## Payment and launch gate
All orders are explicitly test-only. Any order-create request without `test_only: true` receives HTTP 503. No payment card information is requested and no payment or payout is executed. The UI labels the sample $5.99 delivery and $1.99 service fees; these are configurable product decisions to settle before live launch, not approved rates. Taxes are excluded from test estimates.

Live checkout requires a reviewed marketplace payment integration and restaurant/helper payout onboarding. Before enabling real dispatch, finalize fee ownership, refunds/cancellations, customer support, tax handling, coverage, helper compensation and verification. Stripe Connect configuration decisions remain unconfirmed; no live account changes were made.

## Verification
`node --test tests/restaurant-marketplace.test.mjs`
Covers merchant/admin authorization, pending listing privacy, server pricing, choices and delivery zones, live-order blocking, retry deduplication, concurrency, cross-merchant isolation, private addresses and completion requirements.
