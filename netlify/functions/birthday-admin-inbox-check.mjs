import { createHash, timingSafeEqual } from "node:crypto";
import send from "./admin-send-birthday-hug.mjs";

const origin = "https://hugslinks.com";
const digest = Buffer.from("7df41d840c83fc2a3d91f371d2a5d629357a901fbfe66c789dfeef2ac9ee4a23", "hex");
const expires = Date.parse("2026-11-26T18:27:03.638Z");

export default async request => {
  const actual = createHash("sha256").update(request.headers.get("authorization") || "").digest();
  if (request.method !== "POST" || new URL(request.url).origin !== origin || Date.now() > expires ||
      !timingSafeEqual(actual, digest) || !process.env.HUGS_ADMIN_TOKEN) {
    return new Response(null, { status: 404 });
  }
  return send(new Request(origin + "/.netlify/functions/admin-send-birthday-hug", {
    method: "POST",
    headers: {
      Origin: origin,
      Authorization: "Bearer " + process.env.HUGS_ADMIN_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: "b7e1b630-282e-4da3-a2a4-ab1335009b18",
      email: "hugslinkscards@gmail.com",
      sender: "HUGSLinks",
      recipient: "HUGSLinks Test Inbox",
      card: 0,
      color: "navy",
      message: "This Birthday HUG was sent from Owner Workspace without payment."
    })
  }));
};
