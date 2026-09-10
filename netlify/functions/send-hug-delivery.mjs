import { getStore } from "@netlify/blobs";
import { Resend } from "resend";


const resend = new Resend(
  process.env.RESEND_API_KEY
);


/* =========================================
   JSON RESPONSE
========================================= */

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


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(value = "") {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================
   MAIN FUNCTION
========================================= */

export default async (req) => {

  if (req.method !== "POST") {

    return json(405, {
      error: "Method not allowed"
    });
  }


  try {

    /* =====================================
       CHECK ENVIRONMENT VARIABLES
    ===================================== */

    if (!process.env.RESEND_API_KEY) {

      return json(500, {
        error: "Missing RESEND_API_KEY"
      });
    }


    if (!process.env.HUGS_FROM_EMAIL) {

      return json(500, {
        error: "Missing HUGS_FROM_EMAIL"
      });
    }


    /* =====================================
       READ REQUEST
    ===================================== */

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


    if (!orderId) {

      return json(400, {
        error: "Missing order_id"
      });
    }


    /* =====================================
       LOAD ORDER
    ===================================== */

    const ordersStore =
      getStore("hugs-orders");


    const order =
      await ordersStore.get(orderId, {
        type: "json"
      });


    if (!order) {

      return json(404, {
        error: "HUG order not found",
        order_id: orderId
      });
    }


    /* =====================================
       REQUIRE PAYMENT
    ===================================== */

    if (order.payment_status !== "paid") {

      return json(409, {
        error: "Order has not been paid",
        order_id: orderId
      });
    }


    /* =====================================
       REQUIRE PERMANENT VIDEO
    ===================================== */

    if (
      order.storage_status !== "stored" ||
      !order.delivery_url
    ) {

      return json(409, {
        error: "HUG video is not ready for delivery",
        order_id: orderId,
        storage_status:
          order.storage_status || null
      });
    }


    /* =====================================
       DUPLICATE PROTECTION
    ===================================== */

    if (
      order.delivery_email_status === "sent"
    ) {

      return json(200, {
        success: true,
        duplicate: true,
        order_id: orderId,
        delivery_email_status: "sent"
      });
    }


    /* =====================================
       CUSTOMER EMAIL
    ===================================== */

    const customerEmail =
      String(
        order.customer_email ||
        order.stripe_customer_email ||
        ""
      ).trim();


    if (!customerEmail) {

      return json(409, {
        error: "No customer email found",
        order_id: orderId
      });
    }


    /* =====================================
       CUSTOMER DETAILS
    ===================================== */

    const recipientName =
      escapeHtml(
        order.recipient_name ||
        "someone special"
      );


    const senderName =
      escapeHtml(
        order.sender_name ||
        order.customer_name ||
        "Someone who cares"
      );


    const occasion =
      escapeHtml(
        order.occasion ||
        "Personalized HUG"
      );


    const safeOrderId =
      escapeHtml(orderId);


    const safeCustomerEmail =
      escapeHtml(customerEmail);


    const deliveryPage =
      "https://hugslinks.com/hug-delivery.html";


    /* =====================================
       SEND EMAIL
    ===================================== */

    const emailResult =
      await resend.emails.send({

        from:
          process.env.HUGS_FROM_EMAIL,

        to: [
          customerEmail
        ],

        subject:
          `Your personalized HUG for ${recipientName} is ready`,

        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">
</head>

<body style="
  margin:0;
  padding:0;
  background:#f6f8fb;
  font-family:Arial,Helvetica,sans-serif;
  color:#0f2742;
">

  <div style="
    max-width:620px;
    margin:0 auto;
    padding:28px 16px;
  ">

    <div style="
      background:#ffffff;
      border-radius:18px;
      padding:30px 24px;
      box-shadow:0 8px 30px rgba(0,0,0,.08);
    ">

      <h1 style="
        margin:0 0 14px;
        font-size:28px;
        line-height:1.2;
      ">
        Your HUG is ready 💙
      </h1>


      <p style="
        font-size:17px;
        line-height:1.6;
      ">
        Your personalized HUG for
        <strong>${recipientName}</strong>
        is finished and ready to watch,
        download, and share.
      </p>


      <p style="
        font-size:16px;
        line-height:1.6;
      ">
        Occasion:
        <strong>${occasion}</strong>
      </p>


      <div style="
        text-align:center;
        margin:30px 0;
      ">

        <a
          href="${deliveryPage}"
          style="
            display:inline-block;
            background:#0f2742;
            color:#ffffff;
            text-decoration:none;
            font-size:18px;
            font-weight:bold;
            padding:15px 28px;
            border-radius:999px;
          "
        >
          Open Your HUG
        </a>

      </div>


      <p style="
        font-size:15px;
        line-height:1.6;
        color:#41566d;
      ">
        On the delivery page, enter:
      </p>


      <p style="
        font-size:15px;
        line-height:1.7;
      ">
        <strong>Order number:</strong><br>
        ${safeOrderId}
      </p>


      <p style="
        font-size:15px;
        line-height:1.7;
      ">
        <strong>Purchase email:</strong><br>
        ${safeCustomerEmail}
      </p>


      <p style="
        font-size:15px;
        line-height:1.6;
        color:#41566d;
      ">
        From there you can watch the full HUG,
        download the video, or share it with
        the person you created it for.
      </p>


      <hr style="
        border:none;
        border-top:1px solid #e2e8ef;
        margin:28px 0;
      ">


      <p style="
        margin:0;
        font-size:15px;
        line-height:1.6;
      ">
        With love,<br>
        <strong>HUGSLinks</strong><br>
        Give a Hug. Get a Hug.
      </p>


      <p style="
        margin-top:20px;
        font-size:13px;
        color:#718096;
      ">
        Created by ${senderName}
      </p>

    </div>

  </div>

</body>
</html>
        `
      });


    if (emailResult?.error) {

      throw new Error(
        emailResult.error.message ||
        "Resend email failed"
      );
    }


    /* =====================================
       SAVE DELIVERY STATUS
    ===================================== */

    order.delivery_email_status =
      "sent";

    order.delivery_email_id =
      emailResult?.data?.id ||
      emailResult?.id ||
      null;

    order.delivery_email_sent_at =
      new Date().toISOString();

    order.fulfillment_status =
      "delivered";


    delete order.delivery_email_error;
    delete order.delivery_email_error_at;


    await ordersStore.setJSON(
      orderId,
      order
    );


    /* =====================================
       SUCCESS
    ===================================== */

    return json(200, {
      success: true,
      order_id: orderId,
      delivery_email_status: "sent",
      email_id:
        order.delivery_email_id
    });


  } catch (error) {

    console.error(
      "send-hug-delivery error:",
      error
    );


    return json(500, {
      error: "Unable to send HUG delivery email",
      details:
        error?.message ||
        "Unknown error"
    });
  }
};
