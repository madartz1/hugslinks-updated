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

### Photo-guided video scenes

The video prompt accepts one JPG/PNG/WebP attachment (8 MB source limit). The browser normalizes it to JPEG, strips metadata, and resizes the longest edge to 1280 px before submission (2 MB prepared limit). Selection alone does not upload. Generate sends the image as a data URI plus the motion prompt to fal's `fal-ai/minimax/video-01/image-to-video`; text-only scenes keep the existing SVD route. Image-guided output follows the source proportions. Existing preview host, designated test account, membership gate and one-video allowance apply to both routes. No new generation allowance is granted. Provider-supplied queue URLs persist for recovery. There is no separate text-to-image generator.

Validation: `node --test tests/scene-input.test.mjs`. Live image-to-video rendering still requires the designated subscriber account and an available allowance.

### Guided commercial builder

A subscriber-only 15-second builder now supplies five templates (restaurant, product, service, artist, offer), a goal/audience brief, and four scene slots of 3/6/3/3 seconds. Each accepts an image, an MP4, a recovered completed AI video, or a designed text card. Scene text, business name, contact details, logo, and two brand colors are editable. Existing AI copy can populate the storyboard; generating new media is still an explicit action in the AI tools.

Assembly uses a 540×960 canvas at 24 fps and MediaRecorder, with an uploaded or completed AI music track and optional recorded narration. Uploaded video audio is muted. Video slots start at zero, trim to the slot, and hold the last frame when short. Photos are contained without cropping. Preview/export stop if the tab becomes hidden; the user must keep it in the foreground. MP4 is selected only if supported, with explicitly labeled WebM fallback. This is browser-side early access, not a server-rendered MP4 pipeline. Generated remote media import requires provider CORS; otherwise download and reattach. Local script saving persists text and colors only, not binary media. There is no automatic speech transcription, AI voice service, cloud project media persistence, or campaign publishing.

Validation: `node --test tests/commercial-model.test.mjs tests/scene-input.test.mjs`, syntax checks, HTML nesting/unique IDs. An authenticated live preview/export smoke test on desktop and iPhone remains necessary before launch.

Commercial styling: Spotlight, Editorial and Bold visual presets; five system-font stacks, three headline sizes, alignment and headline color controls. Client logos appear in all four scenes and are larger on the CTA card. A scene selector provides direct design review. The same canvas renderer supplies both preview and export; saved local scripts include style settings. Fonts fall back to the closest available device font.

Export quality now defaults to Full HD (1080×1920, 24 fps, target 8 Mbps), with 720×1280/4.5 Mbps and 540×960/3 Mbps fallbacks. The renderer scales its logical 540×960 canvas coordinates to the selected output resolution; higher-resolution text and logos are rendered directly, while input footage is not enhanced. The idle canvas remains 540×960 to reduce memory use. Actual recorder MIME type determines download extension. Browser format capability is shown before assembly. This still needs device-level export validation; it does not replace a server-side MP4 renderer.

### Scene editing

Four stable scene identities retain their text/media and CTA design when reordered using Earlier/Later. The selected card has a live design thumbnail. Each scene accepts 1–10 seconds in half-second increments (default total 15 seconds, maximum 40). Total duration and all labels/export filenames are derived from the current order and durations. Uploaded/AI MP4s offer clip start/end bounds; the selected interval starts at its trim-in point, stops at trim-out or scene end, and holds the last frame if shorter. All video sources are sought to their start before capture. Local script v2 saves order and durations and reads v1 drafts; files and trim selections remain session-only and must be reattached/reset after returning.

Restaurant sample cover: `/assets/studio-restaurant-dining-cover.webp` is an AI-generated Caribbean dining-table photograph, preloaded as the restaurant template’s opening-scene background. It is labeled as sample artwork, supports client logo/text overlays, and can be replaced or removed. Other business templates do not use it. Header overlays use the dark upper space to preserve the food. Source artwork generated with the built-in image-generation tool; working source `generated_images/exec-d515e86c-3e7f-4df6-bdec-f37215a63b41.png`, web asset optimized to WebP. Prompt: photorealistic premium vertical restaurant dining-table experience, contemporary Puerto Rican/Caribbean interior, walnut table for two, roasted chicken, rice with pigeon peas, sweet plantains, salad, linen and water glasses, candle, warm amber pendants, deep navy shadows, darker uncluttered upper area for a client logo, no people, text, logos or watermark.

Business-name hierarchy: opening and CTA cards prioritize the client name in bold type, with automatic fitting to two lines. Opening promotional copy is supporting text. Business names stay bold on other scenes, and media receives a stronger upper gradient for contrast. This applies to every business template, not only the La Rivera sample.
