# HUGS Cards workspace review — 2026-10-19

Inspected Deploy Preview #14 /app/#account and the current card workspace source. Production publishing stays locked.

## Resolved in this update

- Account previously displayed only a proposed subscription offer. It now contains visible email-code sign-in and a signed-in account view. Existing verified card-sender sessions are reused.
- Saved previously meant local catalog favorites. My Cards now lists prepared online cards for the authenticated email, across devices. Favorites and unfinished drafts are explicitly marked device-only.
- Owners can open saved cards through authenticated owner-view/media endpoints without knowing or rotating the recipient link. Existing recipient links still work without sign-in.
- New recipient tokens are encrypted in the database for owner-only recovery. Older cards recover their share link after the sender signs in once from the original sending device. This does not invalidate recipient links.
- Owners can copy recovered links, email a card not yet sent, and remove their cards. The library displays expiry, incomplete uploads, and provider acceptance; it does not claim inbox delivery.
- Simplified app navigation to Create / Browse / My Cards / Account. Replaced repeated storefront app/create banners with a compact card toolbar; removed a misleading back-to-themes link on the collection landing page.
- Added a separate Purchased cards & Founding 333 link to the existing purchase-access page. It is not silently mixed with newly created cards.

## Still incomplete before a paid production launch

1. HUGS Cards paid membership is still a proposed plan. Subscription checkout, paid entitlement enforcement, and account billing management are not connected to this card account. Studio subscriptions remain separate.
2. Unfinished creator drafts and catalog favorites do not sync across devices. The online library stores cards only after their private link is prepared; it is not a multi-draft cloud editor.
3. Existing purchased cards/Founding 333 records use purchase email and order-number access on /my-hug.html, rather than the new creator library.
4. Giveaway entry, final eligibility/rules, prize funding, and drawing operations are not connected. The giveaway information is secondary to the card workflow.
5. Production card hosting/domain activation is still disabled by the current deploy-preview host policy. Daily physical cleanup runs only on published deploys; preview links still expire on time and sender removal works immediately.
6. The creator accepts uploaded pictures, videos, and music and has an AI text-message assistant. It does not yet generate a full AI image/video/music card itself. Studio generation/assembly is a separate flow.

## Deployment blocker resolved

The first build completed bundling but failed during function upload because legacy Lambda-compatible entry points exceeded the 4 KB environment-variable limit. The remaining legacy entries now use the existing modern Request/Response bridge, preserving raw webhook bodies, binary responses, cookies, and preflight status codes. Housing endpoints retain their URL names after conversion to `.mjs`; the shared voter utility returns 404 when requested as an endpoint. No secrets were deleted or exposed. Production remains locked.

## Validation

Automated checks cover verified-owner list isolation, blocked cross-owner media reads, encrypted link recovery, legacy link restoration, expiry, existing recipient playback preparation, sign-in/library/sign-out behavior, SQL migrations/queries and original large-upload/email safeguards. No live verification email or card email was sent by the agent. Real sign-in requires the owner to receive and enter their code.
