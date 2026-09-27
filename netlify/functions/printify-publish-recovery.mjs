const SHOP_ID = "29095637";
const PRODUCT_ID = "6ab83eeaa0d25cd82a0c9f20";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export default async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token) return json({ error: "Printify is not configured" }, 503);

  const base = (process.env.URL || "https://hugslinks.com").replace(/\/$/, "");
  const response = await fetch(
    `https://api.printify.com/v1/shops/${SHOP_ID}/products/${PRODUCT_ID}/publishing_succeeded.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json;charset=utf-8",
        "User-Agent": "HUGSLinks/1.0"
      },
      body: JSON.stringify({
        external: {
          id: PRODUCT_ID,
          handle: `${base}/shop.html#hugs-square-keychain`
        }
      })
    }
  );

  const body = await response.text();
  if (!response.ok) {
    console.error("Printify publish recovery failed", response.status, body);
    return json({ ok: false, status: response.status, error: "Printify rejected publish recovery" }, 502);
  }

  return json({
    ok: true,
    product_id: PRODUCT_ID,
    shop_id: Number(SHOP_ID),
    unlocked: true,
    note: "Printify publishing marked succeeded. No order was created and nothing was sent to production."
  });
};
