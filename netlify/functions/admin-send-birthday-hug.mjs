import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getDesign } from "../function-libs/ready-made-card-catalog.mjs";
import { adminAuthorized } from "../function-libs/_motion-hugs.mjs";
import { dependencies } from "./_shared/hugs-card-links.mjs";

const origin = "https://hugslinks.com";
const cardAppOrigin = "https://hugslinks-card-app.netlify.app";
const grantTime = 30 * 60 * 1000;
function allowedOrigin(value) {
  return value === origin || value === cardAppOrigin;
}
function testGrant(email, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ email, exp: now + grantTime })).toString("base64url");
  const signature = createHmac("sha256", secret).update("owner-card-test:" + payload).digest("base64url");
  return payload + "." + signature;
}
function readTestGrant(token, secret, now = Date.now()) {
  if (!secret || token.length > 1024 || !/^[\w-]+\.[\w-]+$/.test(token)) return null;
  const [body, signature] = token.split(".");
  const proof = createHmac("sha256", secret).update("owner-card-test:" + body).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== proof.length || !timingSafeEqual(supplied, proof)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof data.email === "string" && emailPattern.test(data.email) &&
      Number.isFinite(data.exp) && data.exp > now && data.exp <= now + grantTime ? data : null;
  } catch {
    return null;
  }
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const colors = ["navy", "mist", "electric"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reply = (status, body) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
});
const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const escape = value => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function messageFor(card, link) {
  const design = getDesign(card.collection || "birthday", card.card);
  const title = escape(design.title);
  const artwork = escape(new URL(design.cover, origin).href);
  const sender = escape(card.sender || "HUGSLinks");
  return {
    subject: "HUGSLinks card delivery test · " + design.title,
    html: '<div style="max-width:520px;margin:auto;background:#0b1c42;color:#eff8ff;text-align:center;padding:24px;font-family:Arial,sans-serif">' +
      '<p>HUGSLinks Cards</p><h1>' + title + '</h1><p>' + sender + ' sent you a HUGS Card.</p>' +
      '<a href="' + link + '"><img alt="Open your HUG" src="' + artwork + '" width="320" style="width:100%;max-width:320px;height:auto"></a>' +
      '<p><a href="' + link + '" style="display:inline-block;background:#8cd9ff;color:#102347;padding:14px 24px;border-radius:22px;text-decoration:none">Open Your HUG</a></p></div>'
  };
}

export function makeBirthdayAdminHandler({ getStore, authorize, mail, secret = () => process.env.HUGS_ADMIN_TOKEN }) {
  return async request => {
    const url = new URL(request.url);
    const token = url.searchParams.get("hug");
    if (request.method === "GET" && token !== null) {
      if (!uuid.test(token)) return reply(404, { error: "This HUG could not be found." });
      const store = getStore({ name: "birthday-admin-sends", consistency: "strong" });
      const card = await store.get("card/" + token, { type: "json" });
      const design = card && getDesign(card.collection || "birthday", card.card);
      return design ? reply(200, { card, design }) : reply(404, { error: "This HUG could not be found." });
    }
    const requestOrigin = request.headers.get("origin");
    const crossOrigin = requestOrigin === cardAppOrigin;
    const respond = (status, body) => {
      const response = reply(status, body);
      if (crossOrigin) {
        response.headers.set("Access-Control-Allow-Origin", cardAppOrigin);
        response.headers.set("Vary", "Origin");
      }
      return response;
    };
    if (request.method === "OPTIONS" && crossOrigin) {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": cardAppOrigin, "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization", "Vary": "Origin"
      } });
    }
    const requestingGrant = url.searchParams.has("grant");
    const admin = requestOrigin === origin && authorize(request);
    const authorization = request.headers.get("authorization") || "";
    const grant = !requestingGrant && authorization.startsWith("Bearer ") ?
      readTestGrant(authorization.slice(7), secret()) : null;
    if (!admin && !grant) return respond(401, { error: "Start a new delivery test from Owner Workspace." });
    if (request.method !== "POST") return respond(405, { error: "Method not allowed." });
    if (url.origin !== origin || !allowedOrigin(requestOrigin)) {
      return respond(403, { error: "Send from a HUGSLinks card page." });
    }
    try {
      if (Number(request.headers.get("content-length")) > 8000) return respond(413, { error: "Request too large." });
      const raw = await request.text();
      if (raw.length > 8000) return respond(413, { error: "Request too large." });
      let body;
      try { body = JSON.parse(raw); } catch { return respond(400, { error: "Invalid request." }); }
      const email = clean(body?.email, 255).toLowerCase();
      if (email.length > 254 || !emailPattern.test(email) || /[\r\n]/.test(email)) {
        return respond(400, { error: "Enter a valid recipient email." });
      }
      if (requestingGrant) return respond(200, { ok: true, token: testGrant(email, secret()) });
      if (grant && grant.email !== email) return respond(403, { error: "Use the test inbox selected in Owner Workspace." });
      const { id, card, color, collection = "birthday" } = body;
      if (typeof id !== "string" || !uuid.test(id) || !Number.isInteger(card) || !getDesign(collection, card) || !colors.includes(color)) {
        return respond(400, { error: "Select a card and envelope." });
      }
      const payload = { card, color, collection, recipient: clean(body.recipient, 80), sender: clean(body.sender, 80), message: clean(body.message, 600) };
      const store = getStore({ name: "birthday-admin-sends", consistency: "strong" });
      const key = "send/" + id;
      await store.setJSON(key, { email, payload, token: randomUUID() }, { onlyIfNew: true });
      const saved = await store.get(key, { type: "json" });
      if (saved.email !== email || JSON.stringify({ collection: "birthday", ...saved.payload }) !== JSON.stringify({ collection, ...payload })) {
        return respond(409, { error: "This send has different card details. Edit the form before retrying." });
      }
      const link = origin + "/app/birthday-hugs.html#complimentary=" + saved.token;
      if (!saved.sent) {
        await store.setJSON("card/" + saved.token, saved.payload, { onlyIfNew: true });
        await mail(email, messageFor(saved.payload, link), "birthday-admin/" + id);
        await store.setJSON(key, { ...saved, sent: true });
      }
      return respond(200, { ok: true, link });
    } catch (error) {
      console.error("admin-send-birthday-hug", error.code || error.message);
      return respond(502, { error: "The email service could not confirm the send. Retry from this form." });
    }
  };
}

export default makeBirthdayAdminHandler({
  getStore,
  authorize: adminAuthorized,
  mail: (...args) => {
    const delivery = dependencies();
    if (!delivery.configured) throw new Error("Card delivery is not configured.");
    return delivery.send(...args);
  }
});
