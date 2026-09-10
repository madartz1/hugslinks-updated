import { getStore } from "@netlify/blobs";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";


/* =========================================
   R2 CLIENT
========================================= */

const r2 = new S3Client({
  region: "auto",

  endpoint:
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});


/* =========================================
   JSON RESPONSE HELPER
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
   SEND DELIVERY EMAIL
========================================= */

async function triggerDeliveryEmail(orderId) {

  const siteUrl =
  process.env.DEPLOY_PRIME_URL ||
  process.env.URL ||
  "https://hugslinks-web-build.netlify.app";

  const response = await fetch(
    `${siteUrl}/.netlify/functions/send-hug-delivery`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        order_id: orderId
      })
    }
  );


  let result = {};

  try {
    result = await response.json();
  } catch {
    result = {};
  }


  if (!response.ok) {
    throw new Error(
      result.error ||
      `Delivery email request failed with status ${response.status}`
    );
  }


  return result;
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
       CHECK REQUIRED ENVIRONMENT VARIABLES
    ===================================== */

    const requiredEnv = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_BASE_URL"
    ];


    const missingEnv = requiredEnv.filter(
      (name) => !process.env[name]
    );


    if (missingEnv.length > 0) {
      return json(500, {
        error: "Missing R2 environment variables",
        missing: missingEnv
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
       REQUIRE COMPLETED RENDER
    ===================================== */

    if (
      order.render_status !== "completed" ||
      !order.render_url
    ) {
      return json(409, {
        error: "HUG render is not ready for storage",
        order_id: orderId,
        render_status: order.render_status || null
      });
    }


    /* =====================================
       ALREADY STORED
       ALSO RECOVER EMAIL IF NEEDED
    ===================================== */

    if (
      order.storage_status === "stored" &&
      order.delivery_url
    ) {

      let emailResult = null;


      if (order.delivery_email_status !== "sent") {

        try {

          emailResult =
            await triggerDeliveryEmail(orderId);

        } catch (emailError) {

          const latestOrder =
            await ordersStore.get(orderId, {
              type: "json"
            }) || order;


          latestOrder.delivery_email_status =
            "failed";

          latestOrder.delivery_email_error =
            emailError.message;

          latestOrder.delivery_email_error_at =
            new Date().toISOString();


          await ordersStore.setJSON(
            orderId,
            latestOrder
          );


          return json(200, {
            success: true,
            duplicate: true,
            stored: true,
            order_id: orderId,
            delivery_url: order.delivery_url,
            email_sent: false,
            email_error: emailError.message
          });
        }
      }


      return json(200, {
        success: true,
        duplicate: true,
        stored: true,
        order_id: orderId,
        delivery_url: order.delivery_url,
        email_sent:
          order.delivery_email_status === "sent" ||
          emailResult?.success === true
      });
    }


    /* =====================================
       MARK DOWNLOAD STARTED
    ===================================== */

    order.storage_status = "downloading";
    order.storage_started_at =
      new Date().toISOString();


    await ordersStore.setJSON(
      orderId,
      order
    );


    /* =====================================
       DOWNLOAD SHOTSTACK VIDEO
    ===================================== */

    const videoResponse =
      await fetch(order.render_url);


    if (!videoResponse.ok) {

      order.storage_status = "failed";
      order.storage_error =
        `Unable to download rendered video. HTTP ${videoResponse.status}`;

      order.storage_error_at =
        new Date().toISOString();


      await ordersStore.setJSON(
        orderId,
        order
      );


      return json(502, {
        error: "Unable to download rendered HUG video",
        order_id: orderId
      });
    }


    const arrayBuffer =
      await videoResponse.arrayBuffer();


    const videoBuffer =
      Buffer.from(arrayBuffer);


    if (!videoBuffer.length) {

      order.storage_status = "failed";
      order.storage_error =
        "Downloaded video was empty";

      order.storage_error_at =
        new Date().toISOString();


      await ordersStore.setJSON(
        orderId,
        order
      );


      return json(502, {
        error: "Rendered HUG video was empty",
        order_id: orderId
      });
    }


    /* =====================================
       CREATE SAFE R2 OBJECT KEY
    ===================================== */

    const safeOrderId =
      orderId.replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      );


    const objectKey =
      `hugs-cards/${safeOrderId}.mp4`;


    /* =====================================
       UPLOAD TO CLOUDFLARE R2
    ===================================== */

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,

        Key: objectKey,

        Body: videoBuffer,

        ContentType: "video/mp4",

        CacheControl:
          "public, max-age=31536000, immutable"
      })
    );


    /* =====================================
       BUILD PERMANENT DELIVERY URL
    ===================================== */

    const publicBase =
      process.env.R2_PUBLIC_BASE_URL
        .replace(/\/+$/, "");


    const deliveryUrl =
      `${publicBase}/${objectKey}`;


    /* =====================================
       MARK STORAGE COMPLETE
    ===================================== */

    order.storage_status = "stored";

    order.fulfillment_status =
      "ready-for-delivery";

    order.delivery_url =
      deliveryUrl;

    order.storage_key =
      objectKey;

    order.stored_at =
      new Date().toISOString();

    order.delivery_email_status =
      order.delivery_email_status === "sent"
        ? "sent"
        : "pending";


    delete order.storage_error;
    delete order.storage_error_at;


    await ordersStore.setJSON(
      orderId,
      order
    );


    /* =====================================
       SEND CUSTOMER DELIVERY EMAIL

       IMPORTANT:
       Video is already safely stored.
       Email failure will NOT erase or fail
       the successful R2 upload.
    ===================================== */

    let emailSent = false;
    let emailError = null;


    if (order.delivery_email_status !== "sent") {

      try {

        const emailResult =
          await triggerDeliveryEmail(orderId);


        emailSent =
          emailResult?.success === true;

      } catch (error) {

        emailError =
          error.message ||
          "Unable to send delivery email";


        const latestOrder =
          await ordersStore.get(orderId, {
            type: "json"
          }) || order;


        latestOrder.delivery_email_status =
          "failed";

        latestOrder.delivery_email_error =
          emailError;

        latestOrder.delivery_email_error_at =
          new Date().toISOString();


        await ordersStore.setJSON(
          orderId,
          latestOrder
        );
      }
    }


    /* =====================================
       SUCCESS
    ===================================== */

    return json(200, {
      success: true,
      stored: true,
      order_id: orderId,
      storage_key: objectKey,
      delivery_url: deliveryUrl,
      bytes: videoBuffer.length,
      email_sent: emailSent,
      email_error: emailError
    });


  } catch (error) {

    console.error(
      "store-hug-video error:",
      error
    );


    return json(500, {
      error: "Unable to store HUG video",
      details:
        error?.message ||
        "Unknown error"
    });
  }
};
