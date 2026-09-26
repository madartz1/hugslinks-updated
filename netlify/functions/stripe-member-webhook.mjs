import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const MAX_MEMBERS = 333;

export default async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const qualifyingLink = process.env.HUGS_MEMBER_PAYMENT_LINK_ID;
  if (!webhookSecret || !qualifyingLink || !process.env.STRIPE_SECRET_KEY) {
    return new Response("Membership system not activated", { status: 503 });
  }

  let event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature"), webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") return new Response("ok");
  const session = event.data.object;
  if (session.payment_status !== "paid" || session.payment_link !== qualifyingLink) return new Response("ok");

  const store = getStore("hugs-original-333");
  const receiptKey = "stripe-session:" + session.id;
  if (await store.get(receiptKey, { type:"json" })) return new Response("ok");

  let number = 0;
  for (let n = 1; n <= MAX_MEMBERS; n++) {
    const key = "member:" + String(n).padStart(3,"0");
    if (!(await store.get(key, { type:"json" }))) { number = n; break; }
  }
  if (!number) {
    await store.setJSON(receiptKey, { status:"founding-333-full" });
    return new Response("ok");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const member = {
    number,
    displayNumber: String(number).padStart(3,"0") + "/333",
    name: session.customer_details?.name || "HUGS Original Member",
    email: session.customer_details?.email || session.customer_email || "",
    createdAt: new Date().toISOString(),
    stripeSessionId: session.id,
    token
  };

  await store.setJSON("member:" + String(number).padStart(3,"0"), member);
  await store.setJSON("token:" + token, member);
  await store.setJSON(receiptKey, { number, token });
  return new Response("ok");
};
