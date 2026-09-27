import Stripe from "stripe";
import crypto from "node:crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
  });
}

function accessNumber(sessionId) {
  const digest = crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 8).toUpperCase();
  return `HUG-RISE-${digest}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.STRIPE_SECRET_KEY || !process.env.HUGS_KEYCHAIN_PAYMENT_LINK_ID) {
    return json({ ok: false, error: "HUGS keychain access is not activated yet." }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request" }, 400); }

  const sessionId = String(body.session_id || "").trim();
  if (!/^cs_(test_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return json({ ok: false, error: "Missing or invalid checkout session." }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;

    if (paymentLinkId !== process.env.HUGS_KEYCHAIN_PAYMENT_LINK_ID) {
      return json({ ok: false, error: "This checkout is not a HUGS Square Keychain purchase." }, 403);
    }
    if (session.status !== "complete" || session.payment_status !== "paid") {
      return json({ ok: false, pending: true, error: "Your payment is still processing." }, 409);
    }

    const email = session.customer_details?.email || session.customer_email || "";
    const name = session.customer_details?.name || "HUGS Member";

    return json({
      ok: true,
      access_number: accessNumber(session.id),
      name,
      email,
      purchased_at: new Date((session.created || Math.floor(Date.now()/1000)) * 1000).toISOString(),
      amount_total: session.amount_total,
      currency: session.currency,
      card_access: "first-hug"
    });
  } catch (error) {
    console.error("My First HUG session verification failed:", error?.message || error);
    return json({ ok: false, error: "We could not verify this checkout session." }, 404);
  }
};
