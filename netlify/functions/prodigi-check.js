/**
 * Read-only Prodigi sandbox connection check.
 * This endpoint never creates, updates, or fulfills an order.
 * Required Netlify environment variable: PRODIGI_API_KEY (sandbox key).
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

function response(statusCode, payload, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return { statusCode, headers, body: JSON.stringify(payload) };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";

  if (event.httpMethod === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return response(403, { ok: false, message: "Origin not allowed." }, origin);
    }
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
    return response(405, { ok: false, message: "Use POST for this check." }, origin);
  }
  if (!isAllowedOrigin(origin)) {
    return response(403, { ok: false, message: "Origin not allowed." }, origin);
  }

  const apiKey = process.env.PRODIGI_API_KEY;
  if (!apiKey) {
    return response(503, {
      ok: false,
      configured: false,
      message: "PRODIGI_API_KEY is not configured for this Netlify deploy.",
    }, origin);
  }

  try {
    // A read-only list request checks authentication without creating an order.
    const result = await fetch("https://api.sandbox.prodigi.com/v4.0/Orders?top=1", {
      method: "GET",
      headers: { "X-API-Key": apiKey, "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (result.status === 401 || result.status === 403) {
      return response(502, {
        ok: false,
        configured: true,
        authenticated: false,
        environment: "sandbox",
        message: "Prodigi rejected the sandbox credentials. Check the saved key.",
      }, origin);
    }

    if (!result.ok) {
      return response(502, {
        ok: false,
        configured: true,
        authenticated: false,
        environment: "sandbox",
        message: "Prodigi returned an unexpected response. Try again later.",
      }, origin);
    }

    return response(200, {
      ok: true,
      configured: true,
      authenticated: true,
      environment: "sandbox",
      message: "Prodigi sandbox connection verified. No orders were created.",
    }, origin);
  } catch (_) {
    return response(502, {
      ok: false,
      configured: true,
      authenticated: false,
      environment: "sandbox",
      message: "Could not reach Prodigi sandbox. Try again later.",
    }, origin);
  }
};
