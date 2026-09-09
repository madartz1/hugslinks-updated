import { getStore } from "@netlify/blobs";
import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

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
      order_id
    } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({
          error: "Missing order_id"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY is missing"
      );
    }

    if (!process.env.HUGS_FROM_EMAIL) {
      throw new Error(
        "HUGS_FROM_EMAIL is missing"
      );
    }

    const store = getStore({
      name: "hugs-orders",
      consistency: "strong"
    });

    const order = await store.get(
      order_id,
      {
        type: "json",
        consistency: "strong"
      }
    );

    if (!order) {
      return new Response(
        JSON.stringify({
          error: "HUG order not found"
        }),
        {
          status: 404,
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
          error: "Order is not paid"
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
      order.storage_status !== "stored" ||
      !order.delivery_url
    ) {
      return new Response(
        JSON.stringify({
          error:
            "HUG video is not ready for delivery"
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
      order.delivery_email_status ===
      "sent"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          order_id,
          email_status: "sent"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const customerEmail =
      order.customer_email ||
      order.stripe_customer_email;

    if (!customerEmail) {
      throw new Error(
        "Customer email is missing"
      );
    }

    const deliveryPage =
      "https://hugslinks.com/hug-delivery.html";

    const recipientName =
      order.recipient_name ||
      "someone special";

    const senderName =
      order.sender_name ||
      "Someone who cares";

    const subject =
      `Your personalized HUG for ${recipientName} is ready`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body
        style="
          margin:0;
          padding:0;
          background:#f8f5ee;
          font-family:Arial,Helvetica,sans-serif;
          color:#23374d;
        "
      >
        <div
          style="
            max-width:620px;
            margin:0 auto;
            padding:34px 18px;
          "
        >

          <div
            style="
              background:#ffffff;
              border-radius:24px;
              padding:30px 24px;
              text-align:center;
              border:1px solid #dce8f2;
            "
          >

            <div
              style="
                font-size:13px;
                font-weight:800;
                color:#74b9f4;
                text-transform:uppercase;
                letter-spacing:.7px;
                margin-bottom:12px;
              "
            >
              HUGSLinks
            </div>

            <h1
              style="
                margin:0 0 16px;
                color:#0b2f59;
                font-size:34px;
              "
            >
              Your HUG Is Ready
            </h1>

            <p
              style="
                font-size:17px;
                line-height:1.65;
                margin:0 0 20px;
              "
            >
              Your personalized HUGS Card for
              <strong>${escapeHtml(recipientName)}</strong>
              has finished rendering and is ready to watch,
              download and share.
            </p>

            <a
              href="${deliveryPage}"
              style="
                display:inline-block;
                background:#0b2f59;
                color:#ffffff;
                text-decoration:none;
                padding:15px 24px;
                border-radius:999px;
                font-weight:800;
                margin:8px 0 22px;
              "
            >
              Open Your HUG
            </a>

            <div
              style="
                background:#eef7ff;
                border-radius:16px;
                padding:16px;
                margin-top:12px;
                text-align:left;
                line-height:1.6;
              "
            >
              <strong>HUG Order Number</strong><br />
              ${escapeHtml(order_id)}

              <br /><br />

              <strong>Purchase Email</strong><br />
              ${escapeHtml(customerEmail)}
            </div>

            <p
              style="
                font-size:14px;
                line-height:1.6;
                color:#60758a;
                margin-top:22px;
              "
            >
              On the delivery page, enter the order number
              and purchase email above. You can then stream,
              download or share your personalized HUG.
            </p>

            <p
              style="
                font-size:15px;
                margin-top:26px;
                color:#0b2f59;
                font-weight:700;
              "
            >
              Sent with love from ${escapeHtml(senderName)}
            </p>

            <p
              style="
                font-size:13px;
                color:#74889b;
                margin-top:28px;
              "
            >
              Give a Hug. Get a Hug.<br />
              HUGSLinks
            </p>

          </div>

        </div>
      </body>
      </html>
    `;

    const {
      data,
      error
    } = await resend.emails.send({
      from:
        process.env.HUGS_FROM_EMAIL,

      to: [
        customerEmail
      ],

      subject,

      html
    });

    if (error) {
      console.error(
        "Resend delivery email error:",
        error
      );

      throw new Error(
        "Resend could not send email"
      );
    }

    order.delivery_email_status =
      "sent";

    order.delivery_email_id =
      data?.id || null;

    order.delivery_email_sent_at =
      new Date().toISOString();

    order.fulfillment_status =
      "delivered";

    await store.setJSON(
      order_id,
      order
    );

    console.log(
      "HUG delivery email sent:",
      {
        order_id,
        email:
          customerEmail,
        resend_id:
          data?.id || null
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        email_status: "sent",
        email_id:
          data?.id || null
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
      "Send HUG delivery error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not send HUG delivery email"
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


function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
