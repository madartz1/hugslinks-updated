import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

const PRINTIFY_SHOP_ID = "29095637";
const PRINTIFY_KEYCHAIN_PRODUCT_ID = "6ab83eeaa0d25cd82a0c9f20";
const PRINTIFY_KEYCHAIN_VARIANT_ID = 148390;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function accessNumber(sessionId) {
  const digest = crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 8).toUpperCase();
  return `HUG-RISE-${digest}`;
}

function shippingAddress(session) {
  const details = session.collected_information?.shipping_details || session.shipping_details || session.customer_details;
  const address = details?.address;
  if (!address?.line1 || !address?.city || !address?.postal_code || !address?.country) return null;
  const parts = String(details?.name || session.customer_details?.name || "HUGS Customer").trim().split(/\s+/);
  return {
    first_name: parts.shift() || "HUGS",
    last_name: parts.join(" ") || "Customer",
    email: normalizeEmail(session.customer_details?.email || session.customer_email),
    phone: session.customer_details?.phone || "",
    country: address.country,
    region: address.state || "",
    address1: address.line1,
    address2: address.line2 || "",
    city: address.city,
    zip: address.postal_code
  };
}

async function createPrintifyOrderOnHold({ session, accessNumber }) {
  if (!process.env.PRINTIFY_API_TOKEN) throw new Error("Missing PRINTIFY_API_TOKEN");
  const address = shippingAddress(session);
  if (!address) throw new Error("Stripe Checkout did not collect a complete shipping address");

  const response = await fetch(`https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json;charset=utf-8",
      "User-Agent": "HUGSLinks/1.0"
    },
    body: JSON.stringify({
      external_id: session.id,
      label: accessNumber,
      line_items: [{
        product_id: PRINTIFY_KEYCHAIN_PRODUCT_ID,
        variant_id: PRINTIFY_KEYCHAIN_VARIANT_ID,
        quantity: 1,
        external_id: `${session.id}-keychain`
      }],
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: address
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Printify order failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function sendAccessEmail({ email, name, number, sessionId }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.HUGS_MEMBER_FROM_EMAIL;
  if (!key || !from) throw new Error("HUGS email service is not configured");

  const base = (process.env.URL || "https://hugslinks.com").replace(/\/$/, "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `hugs-keychain-${sessionId}`
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Your HUGS Keychain Access Number — ${number}`,
      html: `<!doctype html><html><body style="margin:0;padding:30px 15px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#10233f">
      <div style="max-width:620px;margin:auto;background:#fff;border-radius:20px;padding:30px">
        <div style="text-align:center;font-size:13px;letter-spacing:3px;font-weight:700;color:#497da8">HELP UNDER GOOD SERVICE</div>
        <h1 style="text-align:center;color:#10233f">Your HUGS Keychain Order</h1>
        <p>Thank you, ${escapeHtml(name || "HUGS supporter")}.</p>
        <p>Your payment has been confirmed. Keep this HUGS Access Number:</p>
        <div style="margin:24px 0;padding:22px;text-align:center;border-radius:16px;background:#10233f;color:#fff;font-size:28px;font-weight:800;letter-spacing:2px">${escapeHtml(number)}</div>
        <p>Use this number with the email address used at checkout to activate your RISE NYC HUG/member card.</p>
        <p style="text-align:center"><a href="${base}/nyc-ride-hugs-card.html" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#74b9f4;color:#10233f;text-decoration:none;font-weight:800">Open RISE NYC HUG</a></p>
        <p style="color:#68798b;font-size:13px">Your Printify fulfillment/order identifiers are kept separate from this customer access number.</p>
      </div></body></html>`
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend failed: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = process.env.HUGS_KEYCHAIN_STRIPE_WEBHOOK_SECRET;
  const keychainPaymentLink = process.env.HUGS_KEYCHAIN_PAYMENT_LINK_ID;

  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret || !keychainPaymentLink) {
    return json({ error: "Keychain purchase system not activated" }, 503);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature" }, 400);

  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Keychain Stripe signature verification failed:", error.message);
    return json({ error: "Invalid Stripe signature" }, 400);
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return json({ received: true, ignored: true, event_type: event.type });
  }

  const session = event.data.object;
  if (session.payment_status === "unpaid") return json({ received: true, ignored: true, reason: "unpaid" });

  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
  if (paymentLinkId !== keychainPaymentLink) {
    return json({ received: true, ignored: true, reason: "not_keychain_purchase" });
  }

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) return json({ error: "Customer email is required" }, 400);

  const name = session.customer_details?.name || "HUGS supporter";
  const store = getStore({ name: "hugs-keychain-access", consistency: "strong" });
  const sessionKey = `stripe-session:${session.id}`;

  const existing = await store.get(sessionKey, { type: "json", consistency: "strong" });
  if (existing?.access_number) {
    return json({ received: true, duplicate: true, access_number: existing.access_number });
  }

  const number = accessNumber(session.id);
  const record = {
    access_number: number,
    email,
    name,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent || null,
    amount_total: session.amount_total,
    currency: session.currency,
    payment_status: session.payment_status,
    fulfillment_status: "awaiting-printify",
    printify_shop_id: PRINTIFY_SHOP_ID,
    printify_product_id: PRINTIFY_KEYCHAIN_PRODUCT_ID,
    printify_variant_id: PRINTIFY_KEYCHAIN_VARIANT_ID,
    access_status: "active",
    created_at: new Date().toISOString()
  };

  const claim = await store.setJSON(sessionKey, record, { onlyIfNew: true });
  if (!claim.modified) {
    const claimed = await store.get(sessionKey, { type: "json", consistency: "strong" });
    return json({ received: true, duplicate: true, access_number: claimed?.access_number || null });
  }

  await store.setJSON(`access:${number}`, record);
  await store.setJSON(`email:${encodeURIComponent(email)}:${number}`, record);

  /*
   * Safety gate: only create the Printify order when explicitly enabled.
   * IMPORTANT: Printify shop Order approval must be MANUAL before setting
   * HUGS_PRINTIFY_CREATE_ORDERS=true. Printify documents that auto-approval
   * can otherwise send newly created orders to production automatically.
   */
  if (process.env.HUGS_PRINTIFY_CREATE_ORDERS === "true") {
    try {
      const printifyOrder = await createPrintifyOrderOnHold({ session, accessNumber: number });
      record.printify_order_id = printifyOrder.id || null;
      record.printify_app_order_id = printifyOrder.app_order_id || null;
      record.fulfillment_status = "printify-on-hold";
      record.printify_created_at = new Date().toISOString();
    } catch (error) {
      console.error("Printify keychain order creation failed:", error);
      record.fulfillment_status = "printify-create-failed";
      record.printify_error_at = new Date().toISOString();
    }
  } else {
    record.fulfillment_status = "printify-safety-hold";
  }

  try {
    await sendAccessEmail({ email, name, number, sessionId: session.id });
    record.email_status = "sent";
    record.email_sent_at = new Date().toISOString();
  } catch (error) {
    console.error("Keychain access email failed:", error);
    record.email_status = "failed";
  }

  await store.setJSON(sessionKey, record);
  await store.setJSON(`access:${number}`, record);

  return json({ received: true, access_number: number, email_status: record.email_status });
};
