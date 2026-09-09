import { getStore } from "@netlify/blobs";
import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

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
    const {
      order_id
    } = await req.json();

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

    if (
      !process.env.R2_ACCOUNT_ID ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_BUCKET_NAME ||
      !process.env.R2_PUBLIC_BASE_URL
    ) {
      throw new Error(
        "R2 environment variables are missing"
      );
    }

    const orderStore =
      getStore({
        name: "hugs-orders",
        consistency: "strong"
      });

    const order =
      await orderStore.get(
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

    if (
      order.render_status !== "completed"
    ) {
      return new Response(
        JSON.stringify({
          error:
            "HUG render is not completed yet"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    if (!order.render_url) {
      return new Response(
        JSON.stringify({
          error:
            "Shotstack render URL is missing"
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
      order.storage_status === "stored" &&
      order.delivery_url
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          order_id,
          delivery_url:
            order.delivery_url
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    order.storage_status =
      "downloading";

    await orderStore.setJSON(
      order_id,
      order
    );

    /*
     * Download finished video
     * from Shotstack.
     */

    const videoResponse =
      await fetch(
        order.render_url
      );

    if (!videoResponse.ok) {
      throw new Error(
        "Could not download Shotstack video"
      );
    }

    const contentType =
      videoResponse.headers.get(
        "content-type"
      ) ||
      "video/mp4";

    const videoBuffer =
      Buffer.from(
        await videoResponse.arrayBuffer()
      );

    /*
     * Create permanent file path.
     */

    const safeOrderId =
      order_id.replace(
        /[^a-zA-Z0-9-_]/g,
        ""
      );

    const objectKey =
      `hugs-cards/${safeOrderId}.mp4`;

    /*
     * Upload to Cloudflare R2.
     */

    await r2.send(
      new PutObjectCommand({
        Bucket:
          process.env.R2_BUCKET_NAME,

        Key:
          objectKey,

        Body:
          videoBuffer,

        ContentType:
          contentType,

        CacheControl:
          "public, max-age=31536000"
      })
    );

    const publicBase =
      process.env.R2_PUBLIC_BASE_URL
        .replace(/\/$/, "");

    const deliveryUrl =
      `${publicBase}/${objectKey}`;

    /*
     * Save permanent delivery URL.
     */

    order.storage_status =
      "stored";

    order.fulfillment_status =
      "ready-for-delivery";

    order.delivery_url =
      deliveryUrl;

    order.storage_key =
      objectKey;

    order.stored_at =
      new Date().toISOString();

    await orderStore.setJSON(
      order_id,
      order
    );

    console.log(
      "HUG video stored in R2:",
      {
        order_id,
        storage_key:
          objectKey,
        delivery_url:
          deliveryUrl
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        storage_status:
          "stored",
        delivery_url:
          deliveryUrl
      }),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  } catch (error) {
    console.error(
      "Store HUG video error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not store HUG video"
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};
