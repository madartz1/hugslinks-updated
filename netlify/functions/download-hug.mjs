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

function json(payload, status = 200) {

  return Response.json(
    payload,
    {
      status,

      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}


/* =========================================
   SAFE FILE NAME
========================================= */

function safeValue(value = "") {

  return String(value)
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    );
}


/* =========================================
   MAIN FUNCTION
========================================= */

export default async (req) => {

  if (req.method !== "POST") {

    return json(
      {
        error:
          "Method not allowed"
      },
      405
    );
  }


  try {

    /* =====================================
       REQUIRED SETTINGS
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

      return json(
        {
          error:
            "Download service is not configured",

          missing:
            missingEnv
        },
        500
      );
    }


    /* =====================================
       READ REQUEST
    ===================================== */

    let body;

    try {

      body =
        await req.json();

    } catch {

      return json(
        {
          error:
            "Invalid request"
        },
        400
      );
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


    if (!orderId || !email) {

      return json(
        {
          error:
            "Order number and email are required"
        },
        400
      );
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

      return json(
        {
          error:
            "HUG order not found"
        },
        404
      );
    }


    /* =====================================
       VERIFY CUSTOMER EMAIL
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

      return json(
        {
          error:
            "Order number and email do not match"
        },
        403
      );
    }


    /* =====================================
       REQUIRE PAID ORDER
    ===================================== */

    if (
      order.payment_status !== "paid"
    ) {

      return json(
        {
          error:
            "This HUG order has not been paid"
        },
        409
      );
    }


    /* =====================================
       REQUIRE R2 STORAGE
    ===================================== */

    if (
      order.storage_status !== "stored" ||
      !order.delivery_url
    ) {

      return json(
        {
          error:
            "This HUG is not ready for download yet"
        },
        409
      );
    }


    /* =====================================
       DETERMINE R2 OBJECT
    ===================================== */

    const safeOrderId =
      safeValue(orderId);


    const storageKey =
      order.storage_key ||
      `hugs-cards/${safeOrderId}.mp4`;


    const filename =
      `HUGSLinks-${safeOrderId}.mp4`;


    /* =====================================
       CREATE SECURE DOWNLOAD URL

       This does NOT create another video.
       It creates a temporary authenticated
       download link for the existing R2 file.
    ===================================== */

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


    const downloadUrl =
      await getSignedUrl(
        r2,
        command,
        {
          expiresIn: 900
        }
      );


    /* =====================================
       SUCCESS
    ===================================== */

    return json({
      success: true,

      order_id:
        orderId,

      filename:
        filename,

      download_url:
        downloadUrl,

      expires_in:
        900
    });


  } catch (error) {

    console.error(
      "download-hug error:",
      error
    );


    return json(
      {
        error:
          "Unable to prepare HUG download",

        details:
          error?.message ||
          "Unknown error"
      },
      500
    );
  }
};
