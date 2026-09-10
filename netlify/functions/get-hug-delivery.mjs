import { getStore } from "@netlify/blobs";

import {
  S3Client,
  GetObjectCommand
} from "@aws-sdk/client-s3";

import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";


/* =========================================
   R2 CLIENT
========================================= */

const r2 = new S3Client({
  region: "auto",

  endpoint:
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,

  credentials: {
    accessKeyId:
      process.env.R2_ACCESS_KEY_ID,

    secretAccessKey:
      process.env.R2_SECRET_ACCESS_KEY
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
   SAFE FILE NAME
========================================= */

function safeFilename(value = "") {

  return String(value)
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    );
}


/* =========================================
   DETERMINE R2 STORAGE KEY
========================================= */

function getStorageKey(order, orderId) {

  if (order.storage_key) {
    return order.storage_key;
  }


  const safeOrderId =
    safeFilename(orderId);


  return `hugs-cards/${safeOrderId}.mp4`;
}


/* =========================================
   CREATE SIGNED DOWNLOAD URL
========================================= */

async function createDownloadUrl(
  order,
  orderId
) {

  const storageKey =
    getStorageKey(
      order,
      orderId
    );


  const safeOrderId =
    safeFilename(orderId);


  const filename =
    `HUGSLinks-${safeOrderId}.mp4`;


  const command =
    new GetObjectCommand({

      Bucket:
        process.env.R2_BUCKET_NAME,

      Key:
        storageKey,

      ResponseContentType:
        "video/mp4",

      ResponseContentDisposition:
        `attachment; filename="${filename}"`
    });


  /*
    Link expires after one hour.

    The actual HUG video remains stored
    permanently in R2.
  */

  return await getSignedUrl(
    r2,
    command,
    {
      expiresIn: 3600
    }
  );
}


/* =========================================
   MAIN FUNCTION
========================================= */

export default async (req) => {

  if (req.method !== "POST") {

    return json(405, {
      error:
        "Method not allowed"
    });
  }


  try {

    /* =====================================
       CHECK R2 ENVIRONMENT VARIABLES
    ===================================== */

    const requiredEnv = [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME"
    ];


    const missingEnv =
      requiredEnv.filter(
        name =>
          !process.env[name]
      );


    if (missingEnv.length > 0) {

      return json(500, {
        error:
          "Missing R2 environment variables",

        missing:
          missingEnv
      });
    }


    /* =====================================
       READ REQUEST
    ===================================== */

    let body;

    try {

      body =
        await req.json();

    } catch {

      return json(400, {
        error:
          "Invalid JSON body"
      });
    }


    const orderId =
      String(
        body?.order_id || ""
      ).trim();


    const email =
      String(
        body?.email || ""
      )
        .trim()
        .toLowerCase();


    if (!orderId) {

      return json(400, {
        error:
          "Missing order_id"
      });
    }


    if (!email) {

      return json(400, {
        error:
          "Missing email"
      });
    }


    /* =====================================
       LOAD ORDER
    ===================================== */

    const ordersStore =
      getStore("hugs-orders");


    const order =
      await ordersStore.get(
        orderId,
        {
          type: "json"
        }
      );


    if (!order) {

      return json(404, {
        error:
          "HUG order not found"
      });
    }


    /* =====================================
       VERIFY EMAIL
    ===================================== */

    const customerEmail =
      String(
        order.customer_email ||
        order.stripe_customer_email ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      !customerEmail ||
      customerEmail !== email
    ) {

      return json(403, {
        error:
          "Order number and email do not match"
      });
    }


    /* =====================================
       REQUIRE PAYMENT
    ===================================== */

    if (
      order.payment_status !==
      "paid"
    ) {

      return json(409, {
        error:
          "This HUG order has not been paid"
      });
    }


    /* =====================================
       RENDER FAILURE
    ===================================== */

    if (
      order.render_status ===
        "failed" ||
      order.fulfillment_status ===
        "render-error"
    ) {

      return json(500, {
        error:
          "There was a problem preparing this HUG",

        render_status:
          order.render_status ||
          null
      });
    }


    /* =====================================
       NOT READY
    ===================================== */

    if (
      order.render_status !==
      "completed"
    ) {

      return json(202, {
        ready:
          false,

        order_id:
          orderId,

        render_status:
          order.render_status ||
          null,

        fulfillment_status:
          order.fulfillment_status ||
          null,

        message:
          "Your HUG is still being prepared."
      });
    }


    /* =====================================
       SELECT WATCH / STREAM URL
    ===================================== */

    let videoUrl = null;
    let videoSource = null;


    if (
      order.storage_status ===
        "stored" &&
      order.delivery_url
    ) {

      videoUrl =
        order.delivery_url;

      videoSource =
        "r2";

    } else if (
      order.render_url
    ) {

      /*
        Temporary fallback only.

        Permanent customer delivery should
        normally use the R2 copy.
      */

      videoUrl =
        order.render_url;

      videoSource =
        "shotstack";
    }


    if (!videoUrl) {

      return json(202, {
        ready:
          false,

        order_id:
          orderId,

        message:
          "Your HUG is being finalized."
      });
    }


    /* =====================================
       CREATE SECURE DOWNLOAD LINK
    ===================================== */

    let downloadUrl = null;
    let downloadExpiresIn = null;


    if (
      order.storage_status ===
        "stored" &&
      order.delivery_url
    ) {

      try {

        downloadUrl =
          await createDownloadUrl(
            order,
            orderId
          );


        downloadExpiresIn =
          3600;

      } catch (error) {

        console.error(
          "Unable to create signed HUG download URL:",
          error
        );

        /*
          Do not block the customer from
          watching the HUG if signing fails.
        */

        downloadUrl =
          null;
      }
    }


    /* =====================================
       SUCCESS
    ===================================== */

    return json(200, {

      success:
        true,

      ready:
        true,

      order_id:
        orderId,

      recipient_name:
        order.recipient_name ||
        "",

      sender_name:
        order.sender_name ||
        "",

      occasion:
        order.occasion ||
        "",

      video_url:
        videoUrl,

      download_url:
        downloadUrl,

      download_expires_in:
        downloadExpiresIn,

      delivery_url:
        order.delivery_url ||
        null,

      render_url:
        order.render_url ||
        null,

      video_source:
        videoSource,

      storage_status:
        order.storage_status ||
        null,

      fulfillment_status:
        order.fulfillment_status ||
        null,

      download_ready:
        Boolean(downloadUrl)
    });


  } catch (error) {

    console.error(
      "get-hug-delivery error:",
      error
    );


    return json(500, {
      error:
        "Unable to load HUG delivery",

      details:
        error?.message ||
        "Unknown error"
    });
  }
};
