import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { cards } from "../../app/birthday-hugs-cards.mjs";
import { adminAuthorized } from "../function-libs/_motion-hugs.mjs";
import { dependencies } from "./_shared/hugs-card-links.mjs";

const origin = "https://hugslinks.com";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const colors = ["navy", "mist", "electric"];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const reply = (status, body) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
});
const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const escape = value => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function messageFor(card, link) {
  const title = escape(cards[card.card].title);
  const artwork = origin + "/assets/birthday-hugs/card-" + String(card.card + 1).padStart(2, "0") + ".webp";
  const sender = escape(card.sender || "HUGSLinks");
  return {
    subject: "A Birthday HUG for you from HUGSLinks",
    html: '<div style="max-width:520px;margin:auto;background:#0b1c42;color:#eff8ff;text-align:center;padding:24px;font-family:Arial,sans-serif">' +
      '<p>HUGSLinks Cards</p><h1>' + title + '</h1><p>' + sender + ' sent you a birthday card.</p>' +
      '<a href="' + link + '"><img alt="Open your Birthday HUG" src="' + artwork + '" width="320" style="width:100%;max-width:320px;height:auto"></a>' +
      '<p><a href="' + link + '" style="display:inline-block;background:#8cd9ff;color:#102347;padding:14px 24px;border-radius:22px;text-decoration:none">Open Your HUG</a></p></div>'
  };
}

export function makeBirthdayAdminHandler({ getStore, authorize, mail }) {
  return async request => {
    const url = new URL(request.url);
    const token = url.searchParams.get("hug");
    if (request.method === "GET" && token !== null) {
      if (!uuid.test(token)) return reply(404, { error: "This HUG could not be found." });
      const store = getStore({ name: "birthday-admin-sends", consistency: "strong" });
      const card = await store.get("card/" + token, { type: "json" });
      return card ? reply(200, { card }) : reply(404, { error: "This HUG could not be found." });
    }
    if (!authorize(request)) return reply(401, { error: "Owner Workspace is locked." });
    if (request.method === "GET") {
      return reply(200, { ok: true, cards: cards.map(({ title, greeting }) => ({ title, greeting })) });
    }
    if (request.method !== "POST") return reply(405, { error: "Method not allowed." });
    if (url.origin !== origin || request.headers.get("origin") !== origin) {
      return reply(403, { error: "Send from HUGSLinks.com." });
    }
    try {
      if (Number(request.headers.get("content-length")) > 8000) return reply(413, { error: "Request too large." });
      const raw = await request.text();
      if (raw.length > 8000) return reply(413, { error: "Request too large." });
      let body;
      try { body = JSON.parse(raw); } catch { return reply(400, { error: "Invalid request." }); }
      const email = clean(body?.email, 255).toLowerCase();
      if (email.length > 254 || !emailPattern.test(email) || /[\r\n]/.test(email)) {
        return reply(400, { error: "Enter a valid recipient email." });
      }
      const { id, card, color } = body;
      if (typeof id !== "string" || !uuid.test(id) || !Number.isInteger(card) || !cards[card] || !colors.includes(color)) {
        return reply(400, { error: "Select a Birthday HUG and envelope." });
      }
      const payload = { card, color, recipient: clean(body.recipient, 80), sender: clean(body.sender, 80), message: clean(body.message, 600) };
      const store = getStore({ name: "birthday-admin-sends", consistency: "strong" });
      const key = "send/" + id;
      await store.setJSON(key, { email, payload, token: randomUUID() }, { onlyIfNew: true });
      const saved = await store.get(key, { type: "json" });
      if (saved.email !== email || JSON.stringify(saved.payload) !== JSON.stringify(payload)) {
        return reply(409, { error: "This send has different card details. Edit the form before retrying." });
      }
      const link = origin + "/app/birthday-hugs.html#complimentary=" + saved.token;
      if (!saved.sent) {
        await store.setJSON("card/" + saved.token, saved.payload, { onlyIfNew: true });
        await mail(email, messageFor(saved.payload, link), "birthday-admin/" + id);
        await store.setJSON(key, { ...saved, sent: true });
      }
      return reply(200, { ok: true, link });
    } catch (error) {
      console.error("admin-send-birthday-hug", error.code || error.message);
      return reply(502, { error: "The email service could not confirm the send. Retry from this form." });
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
