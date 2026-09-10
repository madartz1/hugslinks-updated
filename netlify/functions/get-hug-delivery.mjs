import { getStore } from "@netlify/blobs";


function json(statusCode, payload) {
  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify(payload)
  };
}


export default async (req) => {

  if (req.method !== "POST") {
    return json(405, {
      error: "Method not allowed"
    });
  }


  try {

    let body;

    try {
      body = await req.json();
    } catch {
      return json(400, {
        error: "Invalid JSON body"
      });
    }


    const orderId =
      String(body?.order_id || "").trim();


    const email =
      String(body?.email || "")
        .trim()
        .toLowerCase();


    if (!orderId || !email) {
      return json(400, {
        error:
          "Order number and email are required"
      });
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
      return json(404, {
        error: "HUG order not found"
      });
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
      return json(403, {
        error:
          "Order number and email do not match"
      });
    }


    if (
      order.payment_status !== "paid"
    ) {
      return json(409, {
        error:
          "This HUG order has not been paid"
      });
    }


    if (
      order.render_status === "failed" ||
      order.fulfillment_status ===
        "render-error"
    ) {
      return json(500, {
        error:
          "There was a problem preparing this HUG"
      });
    }


    if (
      order.render_status !== "completed"
    ) {
      return json(202, {
        ready: false,
        message:
          "Your HUG is still being prepared."
      });
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
      return json(202, {
        ready: false,
        message:
          "Your HUG is being finalized."
      });
    }


    return json(200, {

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


    return json(500, {
      error:
        "Unable to open this HUG."
    });
  }
};
