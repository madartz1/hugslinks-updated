import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export default async (req) => {
  const signature =
    req.headers.get("stripe-signature");

  const rawBody =
    await req.text();

  let event;

  try {
    event =
      stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_HUGS_WEBHOOK_SECRET
      );
  } catch (error) {
    console.error(
      "Stripe webhook signature failed:",
      error.message
    );

    return new Response(
      JSON.stringify({
        error: "Invalid Stripe signature"
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return new Response(
      JSON.stringify({
        received: true
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    const session =
      event.data.object;

    if (
      session.payment_status === "unpaid"
    ) {
      return new Response(
        JSON.stringify({
          received: true,
          payment_status: "unpaid"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const orderId =
      session.client_reference_id;

    if (!orderId) {
      throw new Error(
        "Missing client_reference_id"
      );
    }

    const store =
      getStore({
        name: "hugs-orders",
        consistency: "strong"
      });

    const order =
      await store.get(
        orderId,
        {
          type: "json",
          consistency: "strong"
        }
      );

    if (!order) {
      throw new Error(
        "HUG order not found: " + orderId
      );
    }

    if (
      order.payment_status === "paid"
    ) {
      return new Response(
        JSON.stringify({
          received: true,
          duplicate: true,
          order_id: orderId,
          render_status:
            order.render_status || null
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    order.payment_status =
      "paid";

    order.stripe_session_id =
      session.id;

    order.stripe_customer_email =
      session.customer_details?.email ||
      session.customer_email ||
      order.customer_email;

    order.paid_at =
      new Date().toISOString();

    order.render_status =
      "not-started";

    order.fulfillment_status =
      "render-pending";

    await store.setJSON(
      orderId,
      order
    );

    console.log(
      "Paid personalized HUG order saved:",
      {
        order_id: orderId,
        customer_email:
          order.customer_email,
        recipient:
          order.recipient_name
      }
    );

    /*
     * Start Shotstack render.
     */

    let renderStarted = false;
    let renderResponseData = null;

    try {
      const siteUrl =
        process.env.URL ||
        "https://hugslinks.com";

      const renderResponse =
        await fetch(
          `${siteUrl}/.netlify/functions/render-hug-card`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              order_id: orderId
            })
          }
        );

      renderResponseData =
        await renderResponse.json();

      if (!renderResponse.ok) {
        throw new Error(
          "Render function returned non-200 response"
        );
      }

      renderStarted = true;

      console.log(
        "Shotstack render function triggered:",
        {
          order_id: orderId,
          render_response:
            renderResponseData
        }
      );
    } catch (renderError) {
      console.error(
        "Could not start Shotstack render:",
        renderError
      );

      const latestOrder =
        await store.get(
          orderId,
          {
            type: "json",
            consistency: "strong"
          }
        );

      if (latestOrder) {
        latestOrder.render_status =
          "start-failed";

        latestOrder.fulfillment_status =
          "render-error";

        latestOrder.render_error_at =
          new Date().toISOString();

        await store.setJSON(
          orderId,
          latestOrder
        );
      }
    }

    return new Response(
      JSON.stringify({
        received: true,
        order_id: orderId,
        payment_status: "paid",
        render_started:
          renderStarted,
        render_response:
          renderResponseData
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error(
      "HUG Stripe fulfillment error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not process HUG payment"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
