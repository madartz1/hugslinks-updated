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
      `Delivery email failed with status ${response.status}`
    );
  }


  return result;
}


/* =========================================
   UPLOAD DOWNLOAD COPY
========================================= */

async function uploadDownloadCopy({
  videoBuffer,
  objectKey,
  filename
}) {

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,

      Key: objectKey,

      Body: videoBuffer,

      ContentType: "video/mp4",

      ContentDisposition:
        `attachment; filename="${filename}"`,

      CacheControl:
        "private, max-age=0, must-revalidate"
    })
  );
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
       ENVIRONMENT VARIABLES
    ===================================== */

    const requiredEnv = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_PUBLIC_BASE_URL"
    ];


    const missingEnv =
      requiredEnv.filter(
        name => !process.env[name]
      );


    if (missingEnv.length > 0) {

      return json(500, {
        error: "Missing R2 environment variables",
        missing: missingEnv
      });
    }


    /* =====================================
       REQUEST
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
        error: "HUG render is not ready",
        order_id: orderId,
        render_status:
          order.render_status || null
      });
    }


    const safeOrderId =
      orderId.replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      );


    const publicBase =
      process.env.R2_PUBLIC_BASE_URL
        .replace(/\/+$/, "");


    const streamingKey =
      `hugs-cards/${safeOrderId}.mp4`;


    const downloadKey =
      `hugs-downloads/${safeOrderId}.mp4`;


    const deliveryUrl =
      `${publicBase}/${streamingKey}`;


    const downloadUrl =
      `${publicBase}/${downloadKey}`;


    const downloadFilename =
      `HUGSLinks-${safeOrderId}.mp4`;


    /* =====================================
       ALREADY STORED

       If this is an older order without
       download_url, create its download
       copy now.
    ===================================== */

    if (
      order.storage_status === "stored" &&
      order.delivery_url
    ) {

      if (!order.download_url) {

        const existingVideo =
          await fetch(order.delivery_url);


        if (!existingVideo.ok) {

          return json(502, {
            error:
              "Unable to prepare downloadable HUG",
            order_id: orderId
          });
        }


        const arrayBuffer =
          await existingVideo.arrayBuffer();


        const videoBuffer =
          Buffer.from(arrayBuffer);


        await uploadDownloadCopy({
          videoBuffer,
          objectKey: downloadKey,
          filename: downloadFilename
        });


        order.download_url =
          downloadUrl;

        order.download_key =
          downloadKey;

        order.download_ready_at =
          new Date().toISOString();


        await ordersStore.setJSON(
          orderId,
          order
        );
      }


      /* ===================================
         RECOVER EMAIL IF NEEDED
      =================================== */

      let emailResult = null;


      if (
        order.delivery_email_status !== "sent"
      ) {

        try {

          emailResult =
            await triggerDeliveryEmail(
              orderId
            );

        } catch (emailError) {

          const latestOrder =
            await ordersStore.get(
              orderId,
              {
                type: "json"
              }
            ) || order;


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
            delivery_url:
              order.delivery_url,
            download_url:
              order.download_url ||
              downloadUrl,
            email_sent: false,
            email_error:
              emailError.message
          });
        }
      }


      return json(200, {
        success: true,
        duplicate: true,
        stored: true,
        order_id: orderId,
        delivery_url:
          order.delivery_url,
        download_url:
          order.download_url ||
          downloadUrl,
        email_sent:
          order.delivery_email_status ===
            "sent" ||
          emailResult?.success === true
      });
    }


    /* =====================================
       MARK STORAGE STARTED
    ===================================== */

    order.storage_status =
      "downloading";

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

      order.storage_status =
        "failed";

      order.storage_error =
        `Unable to download rendered video. HTTP ${videoResponse.status}`;

      order.storage_error_at =
        new Date().toISOString();


      await ordersStore.setJSON(
        orderId,
        order
      );


      return json(502, {
        error:
          "Unable to download rendered HUG video",
        order_id: orderId
      });
    }


    const arrayBuffer =
      await videoResponse.arrayBuffer();


    const videoBuffer =
      Buffer.from(arrayBuffer);


    if (!videoBuffer.length) {

      order.storage_status =
        "failed";

      order.storage_error =
        "Downloaded video was empty";

      order.storage_error_at =
        new Date().toISOString();


      await ordersStore.setJSON(
        orderId,
        order
      );


      return json(502, {
        error:
          "Rendered HUG video was empty",
        order_id: orderId
      });
    }


    /* =====================================
       STREAMING COPY
    ===================================== */

    await r2.send(
      new PutObjectCommand({
        Bucket:
          process.env.R2_BUCKET_NAME,

        Key:
          streamingKey,

        Body:
          videoBuffer,

        ContentType:
          "video/mp4",

        CacheControl:
          "public, max-age=31536000, immutable"
      })
    );


    /* =====================================
       DOWNLOAD COPY
    ===================================== */

    await uploadDownloadCopy({
      videoBuffer,
      objectKey: downloadKey,
      filename: downloadFilename
    });


    /* =====================================
       SAVE STORAGE RESULTS
    ===================================== */

    order.storage_status =
      "stored";

    order.fulfillment_status =
      "ready-for-delivery";

    order.delivery_url =
      deliveryUrl;

    order.storage_key =
      streamingKey;

    order.download_url =
      downloadUrl;

    order.download_key =
      downloadKey;

    order.download_ready_at =
      new Date().toISOString();

    order.stored_at =
      new Date().toISOString();

    order.delivery_email_status =
      order.delivery_email_status ===
        "sent"
        ? "sent"
        : "pending";


    delete order.storage_error;
    delete order.storage_error_at;


    await ordersStore.setJSON(
      orderId,
      order
    );


    /* =====================================
       SEND DELIVERY EMAIL
    ===================================== */

    let emailSent = false;
    let emailError = null;


    if (
      order.delivery_email_status !== "sent"
    ) {

      try {

        const emailResult =
          await triggerDeliveryEmail(
            orderId
          );


        emailSent =
          emailResult?.success === true;

      } catch (error) {

        emailError =
          error.message ||
          "Unable to send delivery email";


        const latestOrder =
          await ordersStore.get(
            orderId,
            {
              type: "json"
            }
          ) || order;


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
      storage_key: streamingKey,
      delivery_url: deliveryUrl,
      download_key: downloadKey,
      download_url: downloadUrl,
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
