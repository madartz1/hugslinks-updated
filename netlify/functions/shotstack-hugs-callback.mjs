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

    const renderId =
      payload.id;

    const status =
      payload.status;

    const renderUrl =
      payload.url || null;

    const renderError =
      payload.error || null;

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

    const renderMapStore =
      getStore({
        name: "hugs-render-map",
        consistency: "strong"
      });

    const renderMap =
      await renderMapStore.get(
        renderId,
        {
          type: "json",
          consistency: "strong"
        }
      );

    if (!renderMap?.order_id) {
      console.error(
        "No HUG order mapping found for render:",
        renderId
      );

      return new Response(
        JSON.stringify({
          error: "Render mapping not found"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const orderId =
      renderMap.order_id;

    const orderStore =
      getStore({
        name: "hugs-orders",
        consistency: "strong"
      });

    const order =
      await orderStore.get(
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
      order.render_status =
        "completed";

      order.fulfillment_status =
        "render-complete";

      order.render_url =
        renderUrl;

      order.render_completed_at =
        new Date().toISOString();

      order.storage_status =
        "pending";

      await orderStore.setJSON(
        orderId,
        order
      );

      console.log(
        "Personalized HUG render completed:",
        {
          order_id: orderId,
          render_id: renderId,
          render_url: renderUrl
        }
      );

      /*
       * Send completed video to R2 storage.
       */

      try {
        const siteUrl =
          process.env.URL ||
          "https://hugslinks.com";

        const storageResponse =
          await fetch(
            `${siteUrl}/.netlify/functions/store-hug-video`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                order_id: orderId
              })
            }
          );

        const storageData =
          await storageResponse.json();

        if (!storageResponse.ok) {
          throw new Error(
            storageData.error ||
            "Storage function failed"
          );
        }

        console.log(
          "HUG video storage triggered:",
          {
            order_id: orderId,
            delivery_url:
              storageData.delivery_url || null
          }
        );

      } catch (storageError) {
        console.error(
          "Could not store HUG video:",
          storageError
        );

        const latestOrder =
          await orderStore.get(
            orderId,
            {
              type: "json",
              consistency: "strong"
            }
          );

        if (latestOrder) {
          latestOrder.storage_status =
            "failed";

          latestOrder.storage_error_at =
            new Date().toISOString();

          await orderStore.setJSON(
            orderId,
            latestOrder
          );
        }
      }
    }

    else if (status === "failed") {
      order.render_status =
        "failed";

      order.fulfillment_status =
        "render-error";

      order.render_error =
        renderError ||
        "Shotstack render failed";

      order.render_failed_at =
        new Date().toISOString();

      await orderStore.setJSON(
        orderId,
        order
      );

      console.error(
        "Personalized HUG render failed:",
        {
          order_id: orderId,
          render_id: renderId,
          error: order.render_error
        }
      );
    }

    else {
      order.render_status =
        status || "rendering";

      order.fulfillment_status =
        "rendering";

      await orderStore.setJSON(
        orderId,
        order
      );

      console.log(
        "Personalized HUG render update:",
        {
          order_id: orderId,
          render_id: renderId,
          status: order.render_status
        }
      );
    }

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
