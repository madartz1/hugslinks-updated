import { getStore } from "@netlify/blobs";


function json(payload, status = 200) {
  return Response.json(
    payload,
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}


export default async (req) => {

  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed"
      },
      405
    );
  }


  try {

    let body;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: "Invalid JSON body"
        },
        400
      );
    }


    const orderId =
      String(
        body?.order_id || ""
      ).trim();


    const email =
      String(
        body?.email || ""
      )
        .trim()
        .toLowerCase();


    if (!orderId || !email) {
      return json(
        {
          error:
            "Order number and email are required"
        },
        400
      );
    }


    const ordersStore =
      getStore("hugs-orders");


    const order =
      await ordersStore.get(
        orderId,
        {
          type: "json"
        }
      );


    if (!order) {
      return json(
        {
          error:
            "HUG order not found"
        },
        404
      );
    }


    const customerEmail =
      String(
        order.customer_email ||
        order.stripe_customer_email ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      !customerEmail ||
      customerEmail !== email
    ) {
      return json(
        {
          error:
            "Order number and email do not match"
        },
        403
      );
    }


    if (
      order.payment_status !== "paid"
    ) {
      return json(
        {
          error:
            "This HUG order has not been paid"
        },
        409
      );
    }


    if (
      order.render_status === "failed" ||
      order.fulfillment_status ===
        "render-error"
    ) {
      return json(
        {
          error:
            "There was a problem preparing this HUG"
        },
        500
      );
    }


    if (
      order.render_status !== "completed"
    ) {
      return json(
        {
          ready: false,
          message:
            "Your HUG is still being prepared."
        },
        202
      );
    }


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

    } else if (order.render_url) {

      videoUrl =
        order.render_url;

      videoSource =
        "shotstack";
    }


    if (!videoUrl) {
      return json(
        {
          ready: false,
          message:
            "Your HUG is being finalized."
        },
        202
      );
    }


    return json({
      success: true,
      ready: true,

      order_id:
        orderId,

      recipient_name:
        order.recipient_name || "",

      sender_name:
        order.sender_name || "",

      occasion:
        order.occasion || "",

      video_url:
        videoUrl,

      delivery_url:
        order.delivery_url || null,

      video_source:
        videoSource,

      storage_status:
        order.storage_status || null,

      fulfillment_status:
        order.fulfillment_status || null
    });


  } catch (error) {

    console.error(
      "get-hug-delivery error:",
      error
    );


    return json(
      {
        error:
          "Unable to open this HUG.",

        details:
          error?.message ||
          "Unknown error"
      },
      500
    );
  }
};
