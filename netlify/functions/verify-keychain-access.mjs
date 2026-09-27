import { getStore } from "@netlify/blobs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
  });
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request" }, 400); }

  const accessNumber = String(body.access_number || "").trim().toUpperCase();
  const email = normalizeEmail(body.email);

  if (!/^HUG-RISE-[A-F0-9]{8}$/.test(accessNumber) || !email) {
    return json({ ok: false, error: "Enter your HUGS Access Number and checkout email." }, 400);
  }

  const store = getStore({ name: "hugs-keychain-access", consistency: "strong" });
  const record = await store.get(`access:${accessNumber}`, { type: "json", consistency: "strong" });

  if (!record || record.access_status !== "active" || normalizeEmail(record.email) !== email) {
    return json({ ok: false, error: "We could not verify that HUGS Access Number with this email." }, 404);
  }

  return json({
    ok: true,
    access_number: record.access_number,
    name: record.name,
    purchased_at: record.created_at,
    card_access: "rise-nyc-hug"
  });
};
