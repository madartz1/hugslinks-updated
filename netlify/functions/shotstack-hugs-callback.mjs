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
    const payload = await req.json();

    const renderId = payload.id;
    const status = payload.status;
    const renderUrl = payload.url || null;
    const renderError = payload.error || null;

    if (!renderId) {
      return new Response(
        JSON.stringify({
          error: "Missing Shotstack render ID"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const orderId =
      new URL(req.url).searchParams.get("order_id");

    if (!orderId) {
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

    const store = getStore({
      name: "hugs-orders",
      consistency: "strong"
    });

    const order = await store.get(
      orderId,
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
      order.render_id &&
      order.render_id !== renderId
    ) {
      return new Response(
        JSON.stringify({
          error: "Render ID does not match order"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (status === "done") {
      order.render_status = "completed";
      order.fulfillment_status =
        "render-complete";

      order.render_url = renderUrl;

      order.render_completed_at =
        new Date().toISOString();

      console.log(
        "Personalized HUG render completed:",
        {
          order_id: orderId,
          render_id: renderId
        }
      );
    } else if (status === "failed") {
      order.render_status = "failed";
      order.fulfillment_status =
        "render-error";

      order.render_error =
        renderError ||
        "Shotstack render failed";

      order.render_failed_at =
        new Date().toISOString();

      console.error(
        "Personalized HUG render failed:",
        {
          order_id: orderId,
          render_id: renderId,
          error: order.render_error
        }
      );
    } else {
      order.render_status =
        status || "rendering";

      order.fulfillment_status =
        "rendering";
    }

    await store.setJSON(
      orderId,
      order
    );

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        render_id: renderId,
        render_status:
          order.render_status
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
      "Shotstack callback error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not process Shotstack callback"
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
