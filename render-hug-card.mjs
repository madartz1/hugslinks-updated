import { getStore } from "@netlify/blobs";

const SHOTSTACK_TEMPLATE_ID =
  "c314c3f3-dd48-42c2-baea-599c24670b5d";

const SHOTSTACK_CALLBACK_URL =
  "https://hugslinks.com/.netlify/functions/shotstack-hugs-callback";

const SHOTSTACK_BASE =
  "https://api.shotstack.io/edit/v1";

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

    const orderStore = getStore({
      name: "hugs-orders",
      consistency: "strong"
    });

    const order = await orderStore.get(
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
          render_status:
            order.render_status,
          render_id:
            order.render_id || null
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const shotstackHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key":
        process.env.SHOTSTACK_API_KEY
    };

    const templateResponse = await fetch(
      `${SHOTSTACK_BASE}/templates/${SHOTSTACK_TEMPLATE_ID}`,
      {
        method: "GET",
        headers: shotstackHeaders
      }
    );

    const templateData =
      await templateResponse.json();

    if (!templateResponse.ok) {
      console.error(
        "Could not retrieve Shotstack template:",
        templateData
      );

      throw new Error(
        "Could not retrieve Shotstack template"
      );
    }

    const template =
      templateData?.response?.template;

    const templateName =
      templateData?.response?.name ||
      "NYC Ride Callback TEST";

    if (!template) {
      throw new Error(
        "Shotstack template data missing"
      );
    }

    if (
      template.callback !==
      SHOTSTACK_CALLBACK_URL
    ) {
      template.callback =
        SHOTSTACK_CALLBACK_URL;

      const updateTemplateResponse =
        await fetch(
          `${SHOTSTACK_BASE}/templates/${SHOTSTACK_TEMPLATE_ID}`,
          {
            method: "PUT",
            headers: shotstackHeaders,
            body: JSON.stringify({
              name: templateName,
              template
            })
          }
        );

      const updateTemplateData =
        await updateTemplateResponse.json();

      if (!updateTemplateResponse.ok) {
        console.error(
          "Could not add Shotstack callback:",
          updateTemplateData
        );

        throw new Error(
          "Could not configure Shotstack callback"
        );
      }
    }

    const merge = [
      {
        find: "RECIPIENT_NAME",
        replace:
          order.recipient_name || ""
      },
      {
        find: "PERSONAL_MESSAGE",
        replace:
          order.personal_message || ""
      }
    ];

    const renderResponse = await fetch(
      `${SHOTSTACK_BASE}/templates/render`,
      {
        method: "POST",
        headers: shotstackHeaders,
        body: JSON.stringify({
          id: SHOTSTACK_TEMPLATE_ID,
          merge
        })
      }
    );

    const renderData =
      await renderResponse.json();

    if (!renderResponse.ok) {
      console.error(
        "Shotstack render request failed:",
        renderData
      );

      throw new Error(
        "Shotstack rejected render request"
      );
    }

    const renderId =
      renderData?.response?.id;

    if (!renderId) {
      throw new Error(
        "Shotstack render ID missing"
      );
    }

    const renderMapStore =
      getStore({
        name: "hugs-render-map",
        consistency: "strong"
      });

    await renderMapStore.setJSON(
      renderId,
      {
        render_id: renderId,
        order_id,
        created_at:
          new Date().toISOString()
      }
    );

    order.render_status =
      "queued";

    order.fulfillment_status =
      "rendering";

    order.render_id =
      renderId;

    order.render_queued_at =
      new Date().toISOString();

    await orderStore.setJSON(
      order_id,
      order
    );

    console.log(
      "HUG Shotstack TEST render queued:",
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
        render_id: renderId,
        test_template: true
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
        error:
          "Could not start HUG card render"
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
