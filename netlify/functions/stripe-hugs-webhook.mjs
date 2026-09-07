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


  /*
   * Only process completed payments.
   */

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


    /*
     * Do not fulfill unpaid orders.
     */

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


    /*
     * Get HUG order ID from Stripe.
     */

    const orderId =
      session.client_reference_id;


    if (!orderId) {

      throw new Error(
        "Missing client_reference_id"
      );

    }


    /*
     * Open saved HUG orders.
     */

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


    /*
     * Avoid duplicate processing.
     */

    if (
      order.payment_status === "paid"
    ) {

      return new Response(
        JSON.stringify({
          received: true,
          duplicate: true,
          order_id: orderId
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

    }


    /*
     * Mark order paid.
     */

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


    /*
     * Until automated rendering
     * is connected, this order
     * waits for manual fulfillment.
     */

    order.render_status =
      "not-started";

    order.fulfillment_status =
      "manual-pending";


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


    return new Response(
      JSON.stringify({
        received: true,
        order_id: orderId,
        payment_status: "paid",
        fulfillment_status:
          "manual-pending"
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
