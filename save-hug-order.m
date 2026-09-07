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
    const data = await req.json();

    const {
      order_id,
      customer_name,
      customer_email,
      recipient_name,
      sender_name,
      occasion,
      personal_message,
      special_closing,
      special_instructions
    } = data;

    if (
      !order_id ||
      !customer_name ||
      !customer_email ||
      !recipient_name ||
      !sender_name ||
      !personal_message
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required personalization fields"
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

    const order = {
      order_id,

      product:
        "NYC Ride Personalized HUGS Card",

      price:
        "16.99",

      card_asset:
        "https://hugslinks.com/assets/nyc-ride-hugs-full.mp4",

      customer_name,

      customer_email,

      recipient_name,

      sender_name,

      occasion:
        occasion || "Just Because",

      personal_message,

      special_closing:
        special_closing || "",

      special_instructions:
        special_instructions || "",

      payment_status:
        "awaiting-payment",

      render_status:
        "not-started",

      fulfillment_status:
        "pending",

      created_at:
        new Date().toISOString()
    };

    await store.setJSON(
      order_id,
      order
    );

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order_id
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
      "Save HUG order error:",
      error
    );

    return new Response(
      JSON.stringify({
        error: "Could not save order"
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
