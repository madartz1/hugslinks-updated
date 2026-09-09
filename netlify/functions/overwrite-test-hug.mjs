import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

const TEST_ORDER_ID =
  "HUG-TEST-MTTL0NE5-M4JUS4";

const SOURCE_VIDEO_URL =
  "https://hugslinks.com/assets/nyc-ride-hugs-full.mp4";

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

    /*
     * Download the full NYC Ride video
     * already hosted on HUGSLinks.
     */

    const videoResponse =
      await fetch(
        SOURCE_VIDEO_URL
      );

    if (!videoResponse.ok) {
      throw new Error(
        "Could not download full NYC Ride video"
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
     * Use the exact same R2 object key
     * as the 10-second test video.
     */

    const objectKey =
      `hugs-cards/${TEST_ORDER_ID}.mp4`;

    /*
     * Uploading to the same key
     * overwrites the existing object.
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

    console.log(
      "R2 test HUG overwritten:",
      {
        object_key:
          objectKey,
        bytes:
          videoBuffer.length,
        delivery_url:
          deliveryUrl
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        overwritten: true,
        order_id:
          TEST_ORDER_ID,
        bytes:
          videoBuffer.length,
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
      "Overwrite test HUG error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Could not overwrite test HUG",
        detail:
          error.message
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
