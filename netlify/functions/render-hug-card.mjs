import { getStore } from "@netlify/blobs";

const SHOTSTACK_TEMPLATE_ID =
  "dcbf5c47-a34c-4f75-b1f0-2ed4a2074ee4";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    const { order_id } = await req.json();

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

    if (!process.env.SHOTSTACK_API_KEY) {
      throw new Error(
        "SHOTSTACK_API_KEY environment variable is missing"
      );
    }

    const store = getStore({
      name: "hugs-orders",
      consistency: "strong"
    });

    const order = await store.get(order_id, {
      type: "json",
      consistency: "strong"
    });

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

    if (order.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          error: "Order has not been paid"
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
      order.render_status === "queued" ||
      order.render_status === "rendering" ||
      order.render_status === "completed"
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          order_id,
          render_status: order.render_status,
          render_id: order.render_id || null
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const merge = [
      {
        find: "RECIPIENT_NAME",
        replace: order.recipient_name || ""
      },
      {
        find: "OCCASION",
        replace: order.occasion || "Just Because"
      },
      {
        find: "PERSONAL_MESSAGE",
        replace: order.personal_message || ""
      },
      {
        find: "SENDER_NAME",
        replace: order.sender_name || ""
      },
      {
        find: "SPECIAL_CLOSING",
        replace: order.special_closing || ""
      }
    ];

    const shotstackResponse = await fetch(
      "https://api.shotstack.io/edit/v1/templates/render",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": process.env.SHOTSTACK_API_KEY
        },
        body: JSON.stringify({
          id: SHOTSTACK_TEMPLATE_ID,
          merge
        })
      }
    );

    const shotstackData = await shotstackResponse.json();

    if (!shotstackResponse.ok) {
      console.error(
        "Shotstack render request failed:",
        shotstackData
      );

      throw new Error(
        "Shotstack rejected the render request"
      );
    }

    const renderId = shotstackData?.response?.id;

    if (!renderId) {
      console.error(
        "Shotstack response missing render ID:",
        shotstackData
      );

      throw new Error(
        "Shotstack render ID missing"
      );
    }

    order.render_status = "queued";
    order.fulfillment_status = "rendering";
    order.render_id = renderId;
    order.render_queued_at =
      new Date().toISOString();

    await store.setJSON(order_id, order);

    console.log(
      "HUG Shotstack render queued:",
      {
        order_id,
        render_id: renderId
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        render_status: "queued",
        render_id: renderId
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
      "Render HUG card error:",
      error
    );

    return new Response(
      JSON.stringify({
        error: "Could not start HUG card render"
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
