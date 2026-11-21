const Stripe = require("stripe");
const { neon } = require("@neondatabase/serverless");
const crypto = require("node:crypto");
const PRICE = "price_1Ue3RPAgUYqcdQzudCc2QCEM";
const PRODUCT = "prod_VfODEHUysLF4Ib";
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
exports.handler = async (event) => {
  try {
    if (!process.env.STRIPE_TEST_SECRET_KEY || !process.env.NETLIFY_DATABASE_URL) return json(503,{error:"Staging is not configured. Set STRIPE_TEST_SECRET_KEY and NETLIFY_DATABASE_URL."});
    const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY);
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    if (event.httpMethod === "GET") {
      const id = (event.queryStringParameters || {}).id;
      if (!/^[a-f0-9-]{36}$/.test(id || "")) return json(400,{error:"Invalid card link"});
      const rows = await sql`SELECT recipient, sender, message FROM anniversary_test_cards WHERE id = ${id} LIMIT 1`;
      return rows.length ? json(200,{card:rows[0]}) : json(404,{error:"Card not found"});
    }
    if (event.httpMethod !== "POST") return json(405,{error:"Method not allowed"});
    const body = JSON.parse(event.body || "{}");
    const sessionId = String(body.session_id || "");
    if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) return json(400,{error:"Invalid test checkout session"});
    const recipient = String(body.recipient || "").trim().slice(0,80);
    const sender = String(body.sender || "").trim().slice(0,80);
    const message = String(body.message || "").trim().slice(0,600);
    if (!recipient || !sender || !message) return json(400,{error:"Complete all three fields"});
    const session = await stripe.checkout.sessions.retrieve(sessionId, {expand:["line_items"]});
    if (session.livemode || session.payment_status !== "paid" || session.status !== "complete" || session.amount_total !== 699 || session.currency !== "usd") return json(403,{error:"A completed $6.99 test payment is required"});
    const items = session.line_items?.data || [];
    if (items.length !== 1 || items[0].quantity !== 1 || items[0].price?.id !== PRICE || items[0].price?.product !== PRODUCT) return json(403,{error:"Payment is not for this anniversary card"});
    await sql`CREATE TABLE IF NOT EXISTS anniversary_test_cards (id uuid PRIMARY KEY, session_id text UNIQUE NOT NULL, recipient text NOT NULL, sender text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    const id = crypto.randomUUID();
    const rows = await sql`INSERT INTO anniversary_test_cards(id,session_id,recipient,sender,message) VALUES(${id},${sessionId},${recipient},${sender},${message}) ON CONFLICT(session_id) DO NOTHING RETURNING id`;
    if (!rows.length) return json(409,{error:"This test payment has already been redeemed"});
    return json(200,{card_url:"/anniversary-card.html?id="+rows[0].id});
  } catch (err) {
    console.error("anniversary-test-fulfillment",err?.message);
    return json(500,{error:"Unable to verify or create card. Please retry later."});
  }
};