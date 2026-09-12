import { getStore } from "@netlify/blobs";
import { Resend } from "resend";

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

export default async (req) => {

  if (req.method !== "POST") {
    return new Response(
      "Method not allowed",
      { status: 405 }
    );
  }

  try {
    const payload =
      await req.json();

    /*
      Creatomate metadata contains
      our HUG order ID.
    */

    const orderId =
      payload.metadata;

    if (!orderId) {
      throw new Error(
        "Missing order metadata"
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
        `Order ${orderId} not found`
      );
    }

    /*
      Avoid sending the same
      delivery email more than once.
    */

    if (
      order.fulfillment_status ===
      "delivered"
    ) {
      return new Response(
        JSON.stringify({
          received: true,
          duplicate: true
        }),
        { status: 200 }
      );
    }

    if (
      payload.status === "failed"
    ) {
      order.render_status =
        "failed";

      order.render_error =
        payload.error_message ||
        "Unknown render error";

      await store.setJSON(
        orderId,
        order
      );

      return new Response(
        JSON.stringify({
          received: true,
          status: "failed"
        }),
        { status: 200 }
      );
    }

    if (
      payload.status !==
      "succeeded"
    ) {
      return new Response(
        JSON.stringify({
          received: true,
          status:
            payload.status
        }),
        { status: 200 }
      );
    }

    const finishedVideoUrl =
      payload.url;

    if (!finishedVideoUrl) {
      throw new Error(
        "Finished video URL missing"
      );
    }

    order.render_status =
      "succeeded";

    order.finished_video_url =
      finishedVideoUrl;

    order.render_completed_at =
      new Date().toISOString();

    /*
      Send customer delivery email.
    */

    const {
      data,
      error
    } =
      await resend.emails.send(
        {
          from:
            "HUGSLinks <hugs@hugslinks.com>",

          to:
            order.customer_email,

          subject:
            `Your HUG for ${order.recipient_name} is ready ❤️`,

          html: `
            <div style="
              font-family:Arial,sans-serif;
              max-width:600px;
              margin:auto;
              color:#23374d;
            ">

              <h1 style="
                color:#0b2f59;
              ">
                Your Personalized HUG is Ready
              </h1>

              <p>
                Thank you for supporting HUGSLinks.
              </p>

              <p>
                Your personalized
                <strong>
                  NYC Ride HUGS Card
                </strong>
                for
                <strong>
                  ${escapeHtml(order.recipient_name)}
                </strong>
                has been completed.
              </p>

              <p style="
                margin:30px 0;
              ">
                <a
                  href="${finishedVideoUrl}"
                  style="
                    display:inline-block;
                    background:#f2b84b;
                    color:#17212c;
                    text-decoration:none;
                    padding:15px 24px;
                    border-radius:999px;
                    font-weight:bold;
                  "
                >
                  Watch & Download Your HUG
                </a>
              </p>

              <p>
                From:
                <strong>
                  ${escapeHtml(order.sender_name)}
                </strong>
              </p>

              <p>
                Give a Hug. Get a Hug.
              </p>

              <p>
                — HUGSLinks
              </p>

            </div>
          `
        },

        {
          idempotencyKey:
            `hugs-delivery/${orderId}`
        }
      );

    if (error) {
      throw new Error(
        JSON.stringify(error)
      );
    }

    order.fulfillment_status =
      "delivered";

    order.delivery_email_id =
      data?.id || "";

    order.delivered_at =
      new Date().toISOString();

    await store.setJSON(
      orderId,
      order
    );

    return new Response(
      JSON.stringify({
        received: true,
        delivered: true
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  } catch (error) {

    console.error(
      "Creatomate webhook error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Webhook processing failed"
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};


function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
