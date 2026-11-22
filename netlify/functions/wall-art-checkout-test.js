/**
 * TEST-ONLY Stripe Checkout smoke test for HUGSLinks wall-art integration.
 * Uses only STRIPE_TEST_SECRET_KEY and a fixed $1.00 test-mode line item.
 * Does not create Prodigi orders or fulfill anything.
 */
const ALLOWED_ORIGINS = new Set([
  "https://hugslinks.com",
  "https://www.hugslinks.com",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  for (const configuredUrl of [process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!configuredUrl) continue;
    try {
      if (new URL(configuredUrl).origin === origin) return true;
    } catch (_) {}
  }
  return false;
}

function reply(statusCode, payload, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return { statusCode, headers, body: JSON.stringify(payload) };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  if (event.httpMethod === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return reply(403, { ok: false, message: "Origin not allowed." }, origin);
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { ok: false, message: "Use POST to start the test checkout." }, origin);
  }
  if (!isAllowedOrigin(origin)) {
    return reply(403, { ok: false, message: "Origin not allowed." }, origin);
  }

  const secret = process.env.STRIPE_TEST_SECRET_KEY;
  if (!secret) {
    return reply(503, { ok: false, message: "STRIPE_TEST_SECRET_KEY is not configured for this deploy." }, origin);
  }
  // Fail closed if someone accidentally places a live key in this test-only variable.
  if (!secret.startsWith("sk_test_")) {
    return reply(503, { ok: false, message: "Test checkout is disabled because the configured key is not a Stripe test secret." }, origin);
  }

  try {
    const Stripe = require("stripe");
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 100,
          product_data: {
            name: "HUGSLinks Wall Art — Checkout Test",
            description: "A $1.00 test-mode checkout only. No artwork will be printed or shipped.",
          },
        },
        quantity: 1,
      }],
      success_url: "https://hugslinks.com/wall-art.html?checkout_test=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://hugslinks.com/wall-art.html?checkout_test=cancelled",
      metadata: {
        purpose: "wall_art_checkout_smoke_test",
        fulfillment: "disabled",
      },
    });

    if (!session.url) {
      return reply(502, { ok: false, message: "Stripe did not return a checkout URL." }, origin);
    }
    return reply(200, {
      ok: true,
      testMode: true,
      fulfillmentEnabled: false,
      checkoutUrl: session.url,
      message: "Test checkout created. This does not place a print order.",
    }, origin);
  } catch (_) {
    // Never return SDK errors, credentials, or raw upstream responses to the browser.
    return reply(502, { ok: false, message: "Stripe test checkout could not be created. Check Netlify function logs and test-key configuration." }, origin);
  }
};
