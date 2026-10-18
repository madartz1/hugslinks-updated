/**
 * Public, read-only product metadata for approved HUGSLinks wall-art SKUs.
 * Only exposes catalogue details; never returns the API key or wholesale quotes.
 * Required Netlify environment variable: PRODIGI_API_KEY (sandbox key).
 */
const ALLOWED_ORIGINS = new Set([
  "https://hugslinks.com",
  "https://www.hugslinks.com",
]);

// Keep this allowlist server-controlled. Add only SKUs verified for the store.
const PRODUCT_SKUS = new Set([
  "GLOBAL-CAN-10x10",
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
    if (!isAllowedOrigin(origin)) return reply(403, { ok: false }, origin);
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return reply(405, { ok: false, message: "Use GET for catalogue details." }, origin);
  }
  // This endpoint is read-only; same-origin GET requests may omit Origin.
  // If a browser sends Origin, enforce the allowlist.
  if (origin && !isAllowedOrigin(origin)) {
    return reply(403, { ok: false, message: "Origin not allowed." }, origin);
  }

  const sku = String(event.queryStringParameters?.sku || "").trim().toUpperCase();
  if (!PRODUCT_SKUS.has(sku)) {
    return reply(400, {
      ok: false,
      message: "Choose a supported wall-art product SKU.",
      supportedSkus: Array.from(PRODUCT_SKUS),
    }, origin);
  }

  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) {
    return reply(503, { ok: false, message: "Prodigi sandbox key is not configured." }, origin);
  }

  try {
    const upstream = await fetch(
      "https://api.sandbox.prodigi.com/v4.0/products/" + encodeURIComponent(sku),
      {
        method: "GET",
        headers: { "X-API-Key": apiKey, "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (upstream.status === 401 || upstream.status === 403) {
      return reply(502, { ok: false, message: "Prodigi rejected the sandbox credentials." }, origin);
    }
    if (upstream.status === 404) {
      return reply(404, { ok: false, message: "This SKU is not available in the Prodigi catalogue." }, origin);
    }
    if (!upstream.ok) {
      return reply(502, { ok: false, message: "Prodigi catalogue is temporarily unavailable." }, origin);
    }

    const data = await upstream.json();
    const product = data?.product;
    if (!product) return reply(502, { ok: false, message: "Prodigi returned an unexpected catalogue response." }, origin);

    // Deliberately return only customer-safe catalogue information.
    return reply(200, {
      ok: true,
      product: {
        sku: product.sku,
        description: product.description,
        productDimensions: product.productDimensions,
        attributes: product.attributes,
        variants: Array.isArray(product.variants)
          ? product.variants.map((variant) => ({
              attributes: variant.attributes,
              shipsTo: variant.shipsTo,
            }))
          : [],
      },
    }, origin);
  } catch (_) {
    return reply(502, { ok: false, message: "Could not reach Prodigi sandbox catalogue." }, origin);
  }
};
