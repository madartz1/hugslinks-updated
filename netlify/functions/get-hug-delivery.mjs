import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    const {
      order_id,
      email
    } = await req.json();

    if (
      !order_id ||
      !email
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Order number and email are required."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const store = getStore({
      name: "hugs-orders",
      consistency: "strong"
    });

    const order = await store.get(
      order_id.trim(),
      {
        type: "json",
        consistency: "strong"
      }
    );

    if (!order) {
      return new Response(
        JSON.stringify({
          error:
            "We could not find that HUG order."
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const suppliedEmail =
      email
        .trim()
        .toLowerCase();

    const customerEmail =
      (
        order.customer_email ||
        ""
      )
        .trim()
        .toLowerCase();

    const stripeEmail =
      (
        order.stripe_customer_email ||
        ""
      )
        .trim()
        .toLowerCase();

    const emailMatches =
      suppliedEmail === customerEmail ||
      suppliedEmail === stripeEmail;

    if (!emailMatches) {
      return new Response(
        JSON.stringify({
          error:
            "The email does not match this HUG order."
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (
      order.payment_status !== "paid"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "This HUG order has not been paid."
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (
      order.render_status === "failed"
    ) {
      return new Response(
        JSON.stringify({
          ready: false,
          failed: true,
          render_status: "failed",
          message:
            "There was a problem creating your HUG. Please contact HUGSLinks for assistance."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (
      order.render_status !== "completed"
    ) {
      return new Response(
        JSON.stringify({
          ready: false,
          render_status:
            order.render_status ||
            "pending",
          storage_status:
            order.storage_status ||
            "pending",
          message:
            "Your personalized HUG is still being created. Please check again shortly."
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    /*
     * Prefer permanent R2 storage.
     */

    let videoUrl = null;
    let videoSource = null;

    if (
      order.storage_status === "stored" &&
      order.delivery_url
    ) {
      videoUrl =
        order.delivery_url;

      videoSource =
        "r2";
    }

    /*
     * Temporary fallback:
     * use Shotstack URL if R2 storage
     * has not completed yet.
     */

    else if (
      order.render_url
    ) {
      videoUrl =
        order.render_url;

      videoSource =
        "shotstack";
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({
          ready: false,
          render_status:
            order.render_status,
          storage_status:
            order.storage_status ||
            "pending",
          message:
            "Your HUG finished rendering and is being prepared for delivery. Please check again shortly."
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        ready: true,

        order_id:
          order.order_id,

        recipient_name:
          order.recipient_name ||
          "",

        sender_name:
          order.sender_name ||
          "",

        occasion:
          order.occasion ||
          "",

        video_url:
          videoUrl,

        delivery_url:
          order.delivery_url ||
          null,

        render_url:
          order.render_url ||
          null,

        video_source:
          videoSource,

        storage_status:
          order.storage_status ||
          "pending",

        fulfillment_status:
          order.fulfillment_status ||
          null
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error(
      "Get HUG delivery error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not retrieve your HUG."
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
