import Stripe from "stripe";

const FIXED_AMOUNTS = new Set([5, 10, 25, 50]);
const SITE_ORIGIN = "https://hugslinks.com";

function response(message, status = 200) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function redirect(location) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store"
    }
  });
}

function validPaymentLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "buy.stripe.com";
  } catch {
    return false;
  }
}

async function requestedAmount(request) {
  const url = new URL(request.url);

  if (request.method === "GET") {
    return url.searchParams.get("amount") || "custom";
  }

  if (request.method === "POST") {
    const form = await request.formData();
    return String(form.get("amount") || "").trim();
  }

  return null;
}

export default async (request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return response("Method not allowed", 405);
  }

  let amount;
  try {
    amount = await requestedAmount(request);
  } catch {
    return response("Invalid support request", 400);
  }

  if (amount === "custom") {
    const paymentLink =
      String(process.env.HUGS_SUPPORT_PAYMENT_LINK_URL || "").trim();

    if (!validPaymentLink(paymentLink)) {
      return response(
        "The choose-your-amount support link is not active yet.",
        503
      );
    }

    return redirect(paymentLink);
  }

  const dollars = Number(amount);

  if (!FIXED_AMOUNTS.has(dollars)) {
    return response("Choose $5, $10, $25, $50, or Your Amount.", 400);
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!secretKey) {
    return response("Stripe checkout is not active yet.", 503);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-08-26.dahlia"
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "pay",
      integration_identifier: "hugs_support_qjrmvtxa",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: dollars * 100,
            product_data: {
              name: "Support the HUGSLinks Mission",
              description:
                "One-time support for HUGSLinks projects, outreach, creative work and development."
            }
          }
        }
      ],
      metadata: {
        hugslinks_payment_type: "mission_support",
        support_amount: String(dollars)
      },
      success_url:
        `${SITE_ORIGIN}/support-hugs.html?support=thank-you` +
        "&session_id={CHECKOUT_SESSION_ID}#direct-support",
      cancel_url:
        `${SITE_ORIGIN}/support-hugs.html#direct-support`
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    return redirect(session.url);
  } catch (error) {
    console.error(
      "HUGSLinks support Checkout creation failed:",
      error?.message || error
    );

    return response(
      "We could not open Stripe Checkout. Please try again.",
      502
    );
  }
};
