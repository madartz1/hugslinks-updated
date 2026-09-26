import Stripe from "stripe";
import { getStore } from "@netlify/blobs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_MEMBERS = 333;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function memberNumber(number) {
  return String(number).padStart(3, "0");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendMemberEmail({
  email,
  name,
  number,
  sessionId,
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.HUGS_MEMBER_FROM_EMAIL;

  if (!resendKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  if (!fromEmail) {
    throw new Error("Missing HUGS_MEMBER_FROM_EMAIL");
  }

  const safeName = escapeHtml(name || "HUGS Member");
  const safeNumber = escapeHtml(number);

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",

        // Prevent duplicate delivery if the webhook retries.
        "Idempotency-Key": `hugs-333-${sessionId}`,
      },

      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Welcome to HUGS 333 — Member #${safeNumber}`,

        html: `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
</head>

<body style="
  margin:0;
  padding:30px 15px;
  background:#f4f7fb;
  font-family:Arial,Helvetica,sans-serif;
  color:#10233f;
">

  <div style="
    max-width:620px;
    margin:0 auto;
  ">

    <div style="
      background:#ffffff;
      border-radius:20px;
      padding:30px;
      box-shadow:0 8px 30px rgba(16,35,63,.10);
    ">

      <div style="
        text-align:center;
        margin-bottom:20px;
      ">
        <div style="
          font-size:14px;
          letter-spacing:3px;
          font-weight:700;
          color:#497da8;
        ">
          HELP UNDER GOOD SERVICE
        </div>

        <h1 style="
          margin:10px 0 5px;
          font-size:34px;
          color:#10233f;
        ">
          HUGS 333
        </h1>

        <div style="
          font-size:17px;
          color:#5b6b7e;
        ">
          Founding Member
        </div>
      </div>


      <div style="
        background:linear-gradient(135deg,#10233f,#244f79);
        border-radius:22px;
        padding:32px 24px;
        text-align:center;
        color:#ffffff;
        margin:25px 0;
      ">

        <div style="
          font-size:13px;
          letter-spacing:3px;
          opacity:.85;
        ">
          OFFICIAL DIGITAL MEMBER CARD
        </div>

        <div style="
          font-size:22px;
          margin-top:25px;
          font-weight:700;
        ">
          ${safeName}
        </div>

        <div style="
          margin-top:25px;
          font-size:15px;
          opacity:.8;
        ">
          FOUNDING MEMBER
        </div>

        <div style="
          font-size:54px;
          line-height:1;
          margin-top:8px;
          font-weight:800;
          letter-spacing:4px;
        ">
          #${safeNumber}
        </div>

        <div style="
          margin-top:26px;
          font-size:14px;
          letter-spacing:1px;
        ">
          GIVE A HUG • GET A HUG
        </div>

      </div>


      <p style="
        font-size:17px;
        line-height:1.6;
      ">
        Welcome, ${safeName}.
      </p>

      <p style="
        font-size:16px;
        line-height:1.7;
        color:#44566c;
      ">
        Your place in the original HUGS 333 has been
        officially reserved.
      </p>

      <p style="
        font-size:16px;
        line-height:1.7;
        color:#44566c;
      ">
        Your individual founding-member number is
        <strong>#${safeNumber}</strong>.
        This number belongs to your HUGS 333 membership
        record.
      </p>

      <div style="
        border-top:1px solid #e5eaf0;
        margin-top:28px;
        padding-top:22px;
        text-align:center;
        font-size:14px;
        color:#758397;
      ">
        HUGSLinks<br>
        Help Under Good Service<br>
        Give a Hug. Get a Hug.
      </div>

    </div>

  </div>

</body>
</html>
        `,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Resend failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

export default async (req) => {
  /*
   * Stripe must POST to this endpoint.
   */
  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed",
      },
      405
    );
  }

  /*
   * Make sure required server variables exist.
   */
  const requiredVariables = [
    "STRIPE_SECRET_KEY",
    "HUGS_333_STRIPE_WEBHOOK_SECRET",
    "HUGS_MEMBER_PAYMENT_LINK_ID",
    "RESEND_API_KEY",
    "HUGS_MEMBER_FROM_EMAIL",
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      console.error(`Missing environment variable: ${variable}`);

      return json(
        {
          error: "Server configuration error",
        },
        500
      );
    }
  }

  /*
   * Verify Stripe signature using the dedicated
   * HUGS 333 webhook signing secret.
   */
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return json(
      {
        error: "Missing Stripe signature",
      },
      400
    );
  }

  const rawBody = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.HUGS_333_STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(
      "HUGS 333 Stripe signature verification failed:",
      error.message
    );

    return json(
      {
        error: "Invalid Stripe signature",
      },
      400
    );
  }

  /*
   * Only process successful Checkout payments.
   */
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return json({
      received: true,
      ignored: true,
      event_type: event.type,
    });
  }

  try {
    const session = event.data.object;

    /*
     * Do not issue a membership for an unpaid Checkout.
     */
    if (session.payment_status === "unpaid") {
      return json({
        received: true,
        ignored: true,
        payment_status: "unpaid",
      });
    }

    /*
     * IMPORTANT:
     * Only the HUGS 333 Payment Link can create
     * a founding membership.
     */
    const paymentLinkId =
      typeof session.payment_link === "string"
        ? session.payment_link
        : session.payment_link?.id;

    if (
      !paymentLinkId ||
      paymentLinkId !== process.env.HUGS_MEMBER_PAYMENT_LINK_ID
    ) {
      console.log(
        "Checkout ignored — not HUGS 333 Payment Link:",
        paymentLinkId
      );

      return json({
        received: true,
        ignored: true,
        reason: "not_hugs_333_payment_link",
      });
    }

    /*
     * Determine purchaser information.
     */
    const email =
      session.customer_details?.email ||
      session.customer_email;

    if (!email) {
      throw new Error(
        "No customer email on Stripe Checkout Session"
      );
    }

    const name =
      session.customer_details?.name ||
      "HUGS Member";

    /*
     * Site-wide Blob stores persist across deploys.
     */
    const members = getStore({
      name: "hugs-333-members",
      consistency: "strong",
    });

    const payments = getStore({
      name: "hugs-333-payments",
      consistency: "strong",
    });

    /*
     * Duplicate-payment protection.
     *
     * Stripe can retry webhook deliveries.
     * One Stripe Checkout Session must never create
     * multiple HUGS membership numbers.
     */
    const existingPayment = await payments.get(
      session.id,
      {
        type: "json",
        consistency: "strong",
      }
    );

    if (existingPayment?.member_number) {
      return json({
        received: true,
        duplicate: true,
        member_number: existingPayment.member_number,
      });
    }

    /*
     * Claim this Stripe Session.
     *
     * onlyIfNew gives us an atomic conditional write.
     */
    const claim = await payments.setJSON(
      session.id,
      {
        stripe_session_id: session.id,
        stripe_event_id: event.id,
        email,
        name,
        status: "processing",
        created_at: new Date().toISOString(),
      },
      {
        onlyIfNew: true,
      }
    );

    if (!claim.modified) {
      /*
       * Another invocation already claimed this
       * Stripe Checkout Session.
       */
      const existing = await payments.get(
        session.id,
        {
          type: "json",
          consistency: "strong",
        }
      );

      return json({
        received: true,
        duplicate: true,
        processing: existing?.status === "processing",
        member_number:
          existing?.member_number || null,
      });
    }

    /*
     * Reserve the first available number from
     * 001 through 333.
     *
     * We intentionally reserve each slot with
     * onlyIfNew instead of trusting a basic counter.
     */
    let assignedNumber = null;

    for (let i = 1; i <= MAX_MEMBERS; i++) {
      const number = memberNumber(i);

      const reservation = await members.setJSON(
        `member-${number}`,
        {
          member_number: number,
          name,
          email,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          payment_link_id: paymentLinkId,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
          status: "active",
          email_status: "pending",
          joined_at: new Date().toISOString(),
        },
        {
          onlyIfNew: true,
        }
      );

      if (reservation.modified) {
        assignedNumber = number;
        break;
      }
    }

    /*
     * Never create member #334.
     */
    if (!assignedNumber) {
      await payments.setJSON(
        session.id,
        {
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          email,
          name,
          status: "sold-out",
          member_number: null,
          updated_at: new Date().toISOString(),
        }
      );

      console.error(
        "HUGS 333 is sold out. No membership number available."
      );

      return json(
        {
          received: true,
          sold_out: true,
          message: "All 333 memberships have been assigned.",
        },
        200
      );
    }

    /*
     * Save the assigned number against the payment.
     */
    await payments.setJSON(
      session.id,
      {
        stripe_session_id: session.id,
        stripe_event_id: event.id,
        email,
        name,
        payment_link_id: paymentLinkId,
        member_number: assignedNumber,
        payment_status: session.payment_status,
        status: "member-created",
        created_at: new Date().toISOString(),
      }
    );

    /*
     * Send the numbered digital card.
     */
    try {
      const emailResult = await sendMemberEmail({
        email,
        name,
        number: assignedNumber,
        sessionId: session.id,
      });

      const memberRecord = await members.get(
        `member-${assignedNumber}`,
        {
          type: "json",
          consistency: "strong",
        }
      );

      if (memberRecord) {
        memberRecord.email_status = "sent";
        memberRecord.email_sent_at =
          new Date().toISOString();
        memberRecord.resend_email_id =
          emailResult?.id || null;

        await members.setJSON(
          `member-${assignedNumber}`,
          memberRecord
        );
      }

      await payments.setJSON(
        session.id,
        {
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          email,
          name,
          payment_link_id: paymentLinkId,
          member_number: assignedNumber,
          payment_status: session.payment_status,
          status: "complete",
          email_status: "sent",
          completed_at: new Date().toISOString(),
        }
      );

      console.log(
        `HUGS 333 member #${assignedNumber} created for ${email}`
      );

      return json({
        received: true,
        success: true,
        member_number: assignedNumber,
        email_sent: true,
      });
    } catch (emailError) {
      /*
       * IMPORTANT:
       * The member keeps their number even if
       * email delivery temporarily fails.
       */
      console.error(
        "HUGS 333 membership email failed:",
        emailError
      );

      const memberRecord = await members.get(
        `member-${assignedNumber}`,
        {
          type: "json",
          consistency: "strong",
        }
      );

      if (memberRecord) {
        memberRecord.email_status = "failed";
        memberRecord.email_error =
          emailError.message;
        memberRecord.email_error_at =
          new Date().toISOString();

        await members.setJSON(
          `member-${assignedNumber}`,
          memberRecord
        );
      }

      await payments.setJSON(
        session.id,
        {
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          email,
          name,
          payment_link_id: paymentLinkId,
          member_number: assignedNumber,
          payment_status: session.payment_status,
          status: "email-failed",
          email_status: "failed",
          updated_at: new Date().toISOString(),
        }
      );

      /*
       * Return 500 so the failure is visible.
       * The number is already permanently reserved.
       */
      return json(
        {
          received: true,
          member_created: true,
          member_number: assignedNumber,
          email_sent: false,
          error: "Membership created but email delivery failed",
        },
        500
      );
    }
  } catch (error) {
    console.error(
      "HUGS 333 fulfillment error:",
      error
    );

    return json(
      {
        error: "Could not process HUGS 333 membership",
      },
      500
    );
  }
};
