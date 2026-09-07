import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export default async (req) => {

  /*
   * Stripe sends the webhook signature
   * in this request header.
   */
  const signature =
    req.headers.get("stripe-signature");

  /*
   * IMPORTANT:
   * Stripe signature verification needs
   * the original raw request body.
   */
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
     * Do not fulfill an unpaid order.
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
     * This is the HUG order ID that
     * personalize-nyc-ride.html attached
     * to Stripe checkout.
     */
    const orderId =
      session.client_reference_id;


    if (!orderId) {

      throw new Error(
        "Stripe session is missing client_reference_id"
      );

    }


    /*
     * Read the saved personalization.
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
     * Prevent duplicate fulfillment.
     *
     * Stripe may retry webhook events.
     */
    if (
      order.render_status === "rendering" ||
      order.render_status === "succeeded" ||
      order.fulfillment_status === "delivered"
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
     * Record successful payment.
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
     * Save payment state first.
     */
    await store.setJSON(
      orderId,
      order
    );


    /*
     * Start personalized video render.
     *
     * These element names must match
     * the dynamic names that we create
     * later inside Creatomate.
     */
    const renderResponse =
      await fetch(
        "https://api.creatomate.com/v2/renders",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${process.env.CREATOMATE_API_KEY}`
          },

          body:
            JSON.stringify({

              template_id:
                process.env.CREATOMATE_TEMPLATE_ID,

              modifications: {

                "Background-Video":
                  "https://hugslinks.com/assets/nyc-ride-hugs-full.mp4",

                "Recipient-Name":
                  `A HUG for ${order.recipient_name}`,

                "Occasion":
                  order.occasion || "",

                "Personal-Message":
                  order.personal_message,

                "Sender-Name":
                  `With Love, ${order.sender_name}`,

                "Special-Closing":
                  order.special_closing || ""

              },

              webhook_url:
                "https://hugslinks.com/.netlify/functions/creatomate-hugs-webhook",

              metadata:
                orderId

            })
        }
      );


    /*
     * Catch rendering-service errors.
     */
    if (!renderResponse.ok) {

      const renderError =
        await renderResponse.text();

      order.render_status =
        "failed-to-start";

      order.render_error =
        renderError;

      await store.setJSON(
        orderId,
        order
      );

      throw new Error(
        "Creatomate render request failed: " +
        renderError
      );

    }


    const renderResult =
      await renderResponse.json();


    /*
     * Creatomate may return an array
     * containing the render.
     */
    const render =
      Array.isArray(renderResult)
        ? renderResult[0]
        : renderResult;


    /*
     * Save render information.
     */
    order.render_status =
      "rendering";

    order.render_id =
      render?.id || "";

    order.render_started_at =
      new Date().toISOString();


    await store.setJSON(
      orderId,
      order
    );


    return new Response(
      JSON.stringify({
        received: true,
        order_id: orderId,
        render_status: "rendering",
        render_id: render?.id || ""
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
          "HUG fulfillment could not start"
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
