import Stripe from "stripe";
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { Resend } from "resend";

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

  const email = member.email;
  if (email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const base = (process.env.URL || "https://hugslinks.com").replace(/\/$/, "");
      const vaultUrl = base + "/member-vault.html?token=" + encodeURIComponent(token);
      await resend.emails.send({
        from: process.env.HUGS_MEMBER_FROM_EMAIL || "HUGSLinks <members@hugslinks.com>",
        to: email,
        subject: "ACCESS GRANTED — HUGS Original " + member.displayNumber,
        html: "<div style=\"font-family:Arial,sans-serif;color:#071f3b\"><h1>Welcome to the HUGS Original 333.</h1><p>Your founding member number is <strong>" + member.displayNumber + "</strong>.</p><p>Your HUG purchase unlocked your personal digital member card and Members Vault access.</p><p><a href=\"" + vaultUrl + "\" style=\"display:inline-block;padding:14px 22px;border-radius:999px;background:#071f3b;color:white;text-decoration:none;font-weight:700\">ACCESS GRANTED</a></p><p>Give a Hug. Get a Hug.</p></div>"
      });
    } catch (error) {
      console.error("Member email delivery failed", error);
    }
  }

  return new Response("ok");
};
