// Public Stripe Payment Link: customers choose their support amount.
const SUPPORT_PAYMENT_LINK = "https://buy.stripe.com/cNi28qb9a2A83qf5os8ww09";
const SUGGESTED_AMOUNTS = new Set(["5", "10", "25", "50"]);

function response(message, status, extraHeaders = {}) {
  return new Response(message, { status, headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  } });
}

export default async function supportCheckout(request) {
  if (!["GET", "POST"].includes(request.method)) {
    return response("Method not allowed.", 405, { Allow: "GET, POST" });
  }
  let amount;
  try {
    amount = request.method === "POST"
      ? (await request.formData()).get("amount")
      : new URL(request.url).searchParams.get("amount");
  } catch {
    return response("Invalid support amount.", 400);
  }
  amount = amount ?? "custom";
  if (amount !== "custom" && !SUGGESTED_AMOUNTS.has(amount)) {
    return response("Choose a suggested amount or your own amount.", 400);
  }
  const checkout = new URL(SUPPORT_PAYMENT_LINK);
  if (amount !== "custom") checkout.searchParams.set("prefilled_amount", String(Number(amount) * 100));
  return new Response(null, { status: 303, headers: {
    Location: checkout.toString(),
    "Cache-Control": "no-store"
  } });
}
