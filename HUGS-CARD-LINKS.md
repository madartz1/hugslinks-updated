# Private HUGS Card links — preview #14

Customer flow: verify sender email with a six-digit code → recipient email and note → Prepare private card link → Send HUGS Card. Copy/share link and recipient preview are available after preparation. Preparing does not send an email. The customer explicitly presses Send; provider acceptance is shown separately from inbox delivery.

Production is disabled by a host allowlist in `hugs-card-links.mjs`. Do not enable or merge to production until the owner authorizes launch. Preview cap: three cards per verified sender per day. No pricing or paid entitlement is changed here.

## Existing environment configuration

- `HL_STUDIO_DATABASE_URL` (Neon tables with a `hugs_card_` / `hugs_private_cards` prefix; no Studio subscription tables changed).
- `HL_STUDIO_AUTH_SECRET` (signs sender sessions and hashes verification codes).
- `HL_STUDIO_RESEND_API_KEY`, `HL_STUDIO_EMAIL_FROM` (existing verified sender). General `RESEND_API_KEY` and `HUGS_FROM_EMAIL` / `FROM_EMAIL` are fallbacks.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- Optional independent `HUGS_CARDS_STORAGE_SECRET`; otherwise `HL_STUDIO_AUTH_SECRET` encrypts media. Preserve the storage secret for the full lifetime of saved cards. Rotating it makes old media unreadable.

No secrets belong in browser code, git, screenshots, or logs. R2 access must include reading, writing, HEAD, and deleting the `private-hugs/preview-14/` prefix.

## Upload and privacy

The browser describes allowed fields and media, hashes each 2 MiB part, then uploads binary parts to the server. This avoids Netlify's buffered request limit without requiring a new bucket CORS policy. Images: JPEG/PNG/WebP/GIF ≤8 MiB each; video MP4/WebM ≤25 MiB; soundtrack MP3/WAV/M4A ≤8 MiB. The private artist brief is excluded. Upload content hashes and declared lengths are enforced. Finalization requires every part before viewing or emailing. Finalized cards are immutable; preparing edits makes another link.

R2 objects are encrypted with AES-256-GCM and a key derived from the storage secret and the card/slot/part identity, even if the existing bucket has a public domain. The random viewer token is stored only as a hash in the database. It lives in the URL fragment, not a URL sent to a server or referrer. The viewer sends it in Authorization headers. Viewing and media responses use no-store; recipients and sender details are not returned by the viewer endpoint. Anyone who possesses the complete link can view it until removal/expiry; it is not a recipient-login system.

Only sanitized JSON is stored; uploaded HTML or executable SVG is not accepted. A shared renderer builds the recipient view inside a sandboxed iframe with a restrictive CSP. Photo/video/audio become embedded data URLs after authenticated downloads and hash checks. Parent-origin blob URLs are intentionally avoided because an opaque sandbox cannot read them. The envelope animation and music still require user activation. Reassemble media on page load; no public permanent R2 URLs are exposed.

## Sending, expiry, and removal

Email is addressed to the recipient saved with the card. Email rendering escapes supplied text. A database send claim and a stable provider idempotency key protect retries. Provider acceptance does not confirm delivery, opens, or playback; no webhook/open-tracking claim is made. A crashed send can be retried after two minutes. Provider idempotency is bounded by its retention window.

Sender verification has five attempts per code, ten-minute expiry, and email/IP rate limits. Verified sessions last one day. Saved card links and removal controls remain in this device's local history; reverify the same sender email to remove a card. Other devices do not yet offer a sender dashboard. Removing revokes viewing first, deletes all media parts, then clears the stored card/email/note. Partial deletion can be retried. Expired cards remain in local history so the sender can remove them.

Links stop opening after 30 days on the server. `hugs-card-cleanup.mjs` purges expired media and incomplete uploads older than one day, in bounded daily batches, plus expired verification records. Netlify schedules only run on published deploys: **while production stays locked, preview links expire on time but automatic physical cleanup is not running**. Senders can remove preview cards immediately through the page. Before production launch, verify the daily cleanup job and retention notice, quotas/paid entitlements, sender reputation/delivery, and mobile playback.

## Validation

`node --test tests/card-delivery.test.mjs tests/cards-interior.test.mjs tests/hugs-card-links.test.mjs`

Covers sender code replay/tampering, unverified access, 25 MiB video split into 13 uploads, incomplete/altered parts, unauthorized reads/removal, expiry, quotas, encrypted storage, escaped email content, explicit send/retries, edit invalidation, and existing card pages/music/offline export. An additional PGlite check (`tests/hugs-card-store.test.mjs`) validates the actual SQL schema, one-use codes, concurrent send claims, quota updates, and cleanup. Tests mock email/storage; they do not send messages or prove real inbox delivery. Final live verification requires the owner to verify a sender email and send to a chosen test recipient on preview #14.
